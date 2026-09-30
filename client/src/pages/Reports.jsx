import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import TableSkeleton from '../components/TableSkeleton';

const SOURCES = [
  { key: 'egg-logs', label: 'Egg Collection' },
  { key: 'feed-batches', label: 'Feed Batches' },
  { key: 'feeding-logs', label: 'Daily Feeding' },
  { key: 'manure-logs', label: 'Manure / Waste' },
  { key: 'bird-sales', label: 'Bird Sales' },
];

const OMIT_KEYS = ['_id', '__v', 'isDeleted', 'deletedAt', 'deletedBy', 'ingredientsUsed'];

// Populated user references (producedBy, recordedBy) arrive as
// { _id, name } objects. Show just the name — the raw object (with its
// Mongo _id hash) is what was leaking into Reports as "database hashname
// instead of username".
const formatCell = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (typeof v.name === 'string') return v.name;
    return JSON.stringify(v);
  }
  return v;
};

const Reports = () => {
  const [source, setSource] = useState('egg-logs');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/${source}`)
      .then((res) => setRows(res.data))
      .catch(() => toast.error('Failed to load report data'))
      .finally(() => setLoading(false));
  }, [source]);

  // Shared row-shaping so CSV, Excel, and the on-screen table all agree on
  // which columns exist and how nested/object values get flattened.
  const buildAoa = () => {
    const keys = Object.keys(rows[0]).filter((k) => !OMIT_KEYS.includes(k));
    const header = keys;
    const body = rows.map((r) => keys.map((k) => formatCell(r[k])));
    return [header, ...body];
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const aoa = buildAoa();
    const csv = aoa.map((row) => row.map((cell) => JSON.stringify(cell ?? '')).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${source}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (rows.length === 0) return;
    const aoa = buildAoa();
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // Auto-size columns roughly to their longest cell, so the sheet
    // doesn't open with every column crushed to default width.
    const colWidths = aoa[0].map((_, colIdx) =>
      Math.min(
        40,
        Math.max(10, ...aoa.map((row) => String(row[colIdx] ?? '').length))
      )
    );
    worksheet['!cols'] = colWidths.map((w) => ({ wch: w }));

    const workbook = XLSX.utils.book_new();
    const sheetName = SOURCES.find((s) => s.key === source)?.label.slice(0, 31) || 'Report';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${source}-report.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Reports</h1>
        <div className="flex gap-2 items-center">
          <select className="input-field w-auto" value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button className="btn-secondary" onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </button>
          <button className="btn-primary" onClick={exportExcel} disabled={rows.length === 0}>
            Export Excel
          </button>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <TableSkeleton columns={5} />
        ) : rows.length === 0 ? (
          <EmptyState message="No data for this report yet." />
        ) : (
          <table>
            <thead>
              <tr>
                {Object.keys(rows[0]).filter((k) => !OMIT_KEYS.includes(k)).map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  {Object.keys(r).filter((k) => !OMIT_KEYS.includes(k)).map((k) => (
                    <td key={k}>{String(formatCell(r[k]))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Reports;