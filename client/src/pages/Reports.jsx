import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import TableSkeleton from '../components/TableSkeleton';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const SOURCES = [
  { key: 'egg-logs', label: 'Egg Collection' },
  { key: 'feed-batches', label: 'Compounded Feed' },
  { key: 'feeding-logs', label: 'Daily Feeding' },
  { key: 'manure-logs', label: 'Manure / Waste' },
  { key: 'bird-sales', label: 'Bird Sales' },
];

// Small spinning ring shown inside a button while its action is running.
const ButtonSpinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

// While ANY action is running (`busy` is not null) every button is disabled,
// so a slow server can't be hit by repeated taps. The tapped button shows a
// spinner and its working label; the others just dim.
const ActionButton = ({ kind, busy, disabled, color, idleLabel, busyLabel, onClick }) => {
  const active = busy === kind;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!busy || disabled}
      aria-busy={active}
      className={`${color} text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${
        active ? 'cursor-wait' : 'disabled:opacity-50 disabled:cursor-not-allowed'
      }`}
    >
      {active && <ButtonSpinner />}
      {active ? busyLabel : idleLabel}
    </button>
  );
};

// Kept OUTSIDE Reports so it stays a stable component and never remounts
// when the parent re-renders.
const ExportButtons = ({
  onExportCsv, onExportPDF, onExportExcel,
  waFormat, setWaFormat, busy, slow, disabled, onSendWhatsApp,
  waStatus, onShareNow, onSaveFile,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <button type="button" className="btn-secondary" onClick={onExportCsv} disabled={disabled || !!busy}>
      Export CSV
    </button>
    <ActionButton kind="pdf" busy={busy} disabled={disabled} onClick={onExportPDF}
      color="bg-red-600" idleLabel="Export PDF" busyLabel="Preparing PDF..." />
    <ActionButton kind="excel" busy={busy} disabled={disabled} onClick={onExportExcel}
      color="bg-green-700" idleLabel="Export Excel" busyLabel="Preparing Excel..." />
    <div className="flex items-center gap-1">
      <select
        value={waFormat}
        onChange={(e) => setWaFormat(e.target.value)}
        disabled={!!busy}
        aria-label="File format to share on WhatsApp"
        className="input-field w-auto disabled:opacity-50"
      >
        <option value="pdf">PDF</option>
        <option value="excel">Excel</option>
      </select>
      <ActionButton kind="whatsapp" busy={busy} disabled={disabled} onClick={onSendWhatsApp}
        color="bg-emerald-600" idleLabel="Send via WhatsApp" busyLabel="Preparing..." />
    </div>

    {/* Shown only if an action is taking a while (e.g. the server was asleep),
        so a slow response doesn't look like the tap did nothing. */}
    {busy && slow && (
      <p role="status" className="w-full text-xs text-neutral-500">
        Still working... if the server was asleep this can take up to a minute. Please don&apos;t tap again.
      </p>
    )}

    {/* The browser wanted a fresh tap to open the share sheet (the server took
        a while). The file is already prepared — one more tap. */}
    {waStatus?.kind === 'ready' && (
      <div className="w-full flex flex-wrap items-center gap-2 app-card !p-3 text-sm">
        <span>Your {waStatus.label} is ready.</span>
        <button type="button" onClick={onShareNow} disabled={!!busy}
          className="bg-emerald-600 text-white px-3 py-1 rounded-lg disabled:opacity-50">
          Share now
        </button>
      </div>
    )}

    {/* This browser won't attach this kind of file to WhatsApp itself (phones
        are stricter about spreadsheets than PDFs). Both options start from a
        real tap, so the browser never blocks them as pop-ups. */}
    {waStatus?.kind === 'fallback' && (
      <div className="w-full flex flex-wrap items-center gap-2 app-card !p-3 text-sm">
        <span>This browser can&apos;t attach {waStatus.fileKind} files to WhatsApp directly.</span>
        {waStatus.waLink && (
          <a href={waStatus.waLink} target="_blank" rel="noreferrer"
            className="bg-emerald-600 text-white px-3 py-1 rounded-lg">
            Send link on WhatsApp
          </a>
        )}
        <button type="button" onClick={onSaveFile} className="btn-secondary !py-1">
          Save file
        </button>
      </div>
    )}
  </div>
);

const formatCell = (col, v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (col.type === 'money') return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (col.type === 'number') return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
};

// Proper CSV quoting: wrap in quotes when needed and double any quote inside.
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const Reports = () => {
  const [source, setSource] = useState('egg-logs');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [waFormat, setWaFormat] = useState('pdf');
  // Which action is running right now (null = none).
  const [busy, setBusy] = useState(null); // null | 'pdf' | 'excel' | 'whatsapp' | 'share'
  const [slow, setSlow] = useState(false); // true once an action has run for 4s+
  const busyRef = useRef(null);
  const [waStatus, setWaStatus] = useState(null); // null | {kind:'ready'|'fallback', file, label, ...}

  const rangeInvalid = !!(startDate && endDate && startDate > endDate);

  // One endpoint feeds the table, the PDF and the Excel file, so they always agree.
  useEffect(() => {
    if (rangeInvalid) { setData(null); setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    api.get('/reports/data', {
      params: { type: source, startDate: startDate || undefined, endDate: endDate || undefined },
    })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        toast.error(err.response?.data?.message || 'Failed to load report');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [source, startDate, endDate, rangeInvalid]);

  // A prepared file is stale as soon as the report, dates or format change.
  useEffect(() => { setWaStatus(null); }, [source, startDate, endDate, waFormat]);

  // Still running after 4 seconds? Show the "still working" hint.
  useEffect(() => {
    if (!busy) { setSlow(false); return undefined; }
    const timer = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(timer);
  }, [busy]);

  const buildExportParams = () => {
    const params = new URLSearchParams();
    params.append('type', source);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return params;
  };

  // Runs ONE export/share action at a time. The ref (not just state) is what
  // blocks a second tap that lands before React has disabled the buttons.
  const runBusy = async (kind, action) => {
    if (busyRef.current) return;
    busyRef.current = kind;
    setBusy(kind);
    try {
      await action();
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  const handleExportCsv = () => {
    if (!data || data.rowCount === 0) return;
    const header = data.columns.map((c) => csvCell(c.label)).join(',');
    const lines = data.rows.map((r) => data.columns.map((c) => csvCell(r[c.key])).join(','));
    // BOM so Excel reads accents/Swahili text correctly.
    downloadBlob(new Blob([`\ufeff${[header, ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), `${source}_report.csv`);
  };

  const handleExportPDF = () => runBusy('pdf', async () => {
    try {
      const res = await api.get(`/reports/export/pdf?${buildExportParams()}`, { responseType: 'blob' });
      downloadBlob(new Blob([res.data], { type: 'application/pdf' }), `${source}_report.pdf`);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error('Error exporting PDF');
    }
  });

  const handleExportExcel = () => runBusy('excel', async () => {
    try {
      const res = await api.get(`/reports/export/excel?${buildExportParams()}`, { responseType: 'blob' });
      downloadBlob(new Blob([res.data], { type: XLSX_MIME }), `${source}_report.xlsx`);
      toast.success('Excel downloaded');
    } catch (err) {
      toast.error('Error exporting Excel');
    }
  });

  // Builds the real PDF/Excel file (same authenticated endpoints as the
  // Export buttons) as a File object ready to share.
  const buildReportFile = async () => {
    const isExcel = waFormat === 'excel';
    const res = await api.get(`/reports/export/${isExcel ? 'excel' : 'pdf'}?${buildExportParams()}`, { responseType: 'blob' });
    const stamp = new Date().toISOString().split('T')[0];
    const file = new File([res.data], `${source}_report_${stamp}.${isExcel ? 'xlsx' : 'pdf'}`, {
      type: isExcel ? XLSX_MIME : 'application/pdf',
    });
    const name = SOURCES.find((s) => s.key === source)?.label.toLowerCase() || source;
    return { file, label: `${name} report` };
  };

  // Sends the REAL file through the device's share sheet, where WhatsApp
  // appears as an option; you then pick any chat or group. Where the browser
  // refuses the file (e.g. Excel on many phones, or desktop browsers), you get
  // a one-tap WhatsApp link plus a Save file button instead.
  const handleSendWhatsApp = () => runBusy('whatsapp', async () => {
    setWaStatus(null);
    try {
      const { file, label } = await buildReportFile();

      const canShareFiles =
        typeof navigator.canShare === 'function' &&
        typeof navigator.share === 'function' &&
        navigator.canShare({ files: [file] });

      if (!canShareFiles) {
        let waLink = null;
        try {
          const linkRes = await api.post('/reports/share-link', {
            type: source,
            format: waFormat,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          });
          const message = `Here's the ${label}: ${linkRes.data.url}\n\n(Link expires in 48 hours)`;
          waLink = `https://wa.me/?text=${encodeURIComponent(message)}`;
        } catch (e) { /* no link available (e.g. your role can't create one): "Save file" still works */ }
        setWaStatus({ kind: 'fallback', label, file, waLink, fileKind: waFormat === 'excel' ? 'Excel' : 'PDF' });
        return;
      }

      try {
        await navigator.share({ files: [file], title: label, text: label });
      } catch (err) {
        if (err.name === 'AbortError') return; // you closed the share sheet
        if (err.name === 'NotAllowedError') {
          // The server took long enough that the browser no longer treats this
          // as a direct result of your tap — ask for one more.
          setWaStatus({ kind: 'ready', file, label });
          return;
        }
        throw err;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not prepare the report');
    }
  });

  const handleShareNow = () => runBusy('share', async () => {
    if (waStatus?.kind !== 'ready') return;
    try {
      await navigator.share({ files: [waStatus.file], title: waStatus.label, text: waStatus.label });
      setWaStatus(null);
    } catch (err) {
      if (err.name !== 'AbortError') toast.error('Could not open the share sheet');
    }
  });

  const handleSaveFile = () => {
    if (waStatus?.kind !== 'fallback') return;
    downloadBlob(waStatus.file, waStatus.file.name);
    toast.success('File saved to your device');
  };

  const noData = loading || rangeInvalid || !data || data.rowCount === 0;
  const labelFor = (key) => data?.columns.find((c) => c.key === key)?.label || key;

  return (
    <div className="space-y-4">
      <h1 className="page-title">Reports</h1>

      <div className="app-card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-neutral-500 mb-1 block">Report</label>
            <select className="input-field w-auto" value={source} onChange={(e) => setSource(e.target.value)}>
              {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 mb-1 block">From</label>
            <input type="date" aria-label="From date" className="input-field w-auto" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-neutral-500 mb-1 block">To</label>
            <input type="date" aria-label="To date" className="input-field w-auto" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          {(startDate || endDate) && (
            <button type="button" className="btn-secondary" onClick={() => { setStartDate(''); setEndDate(''); }}>
              Clear dates
            </button>
          )}
        </div>

        {rangeInvalid && (
          <p role="alert" className="text-xs text-red-600">The “From” date must be on or before the “To” date.</p>
        )}

        <ExportButtons
          onExportCsv={handleExportCsv}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          waFormat={waFormat} setWaFormat={setWaFormat}
          busy={busy} slow={slow} disabled={noData}
          onSendWhatsApp={handleSendWhatsApp}
          waStatus={waStatus} onShareNow={handleShareNow} onSaveFile={handleSaveFile}
        />
      </div>

      <div className="table-wrap responsive-cards">
        {loading ? (
          <TableSkeleton columns={5} />
        ) : !data || data.rowCount === 0 ? (
          <EmptyState message={rangeInvalid ? 'Fix the date range to see this report.' : 'No data for this report yet.'} />
        ) : (
          <table>
            <thead>
              <tr>{data.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={i}>
                  {data.columns.map((c) => (
                    <td key={c.key} data-label={c.label}>{formatCell(c, r[c.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.rowCount > 0 && !loading && (
        <div className="text-xs text-neutral-500 space-y-1">
          <p>
            {data.rowCount} {data.rowCount === 1 ? 'entry' : 'entries'} · {data.periodLabel}
            {Object.keys(data.totals).length > 0 && ' · Totals: '}
            {Object.entries(data.totals).map(([key, total], i) => (
              <span key={key}>
                {i > 0 && ', '}
                <span className="font-semibold">{labelFor(key)}</span> {Number(total).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            ))}
          </p>
          {data.truncated && (
            <p className="text-amber-600">
              Showing the most recent {data.maxRows} records only. Narrow the date range to see the rest.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
