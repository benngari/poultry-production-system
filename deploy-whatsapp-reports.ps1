# WhatsApp / PDF / Excel report sharing for Poultry Pro.
# Run this from your PROJECT ROOT (the folder containing 'client' and 'server').
$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'server\server.js') -or -not (Test-Path 'client\src')) {
  Write-Host 'Stop: run this from the poultry-production-system folder (the one containing client and server).' -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path "client\src\pages" | Out-Null
New-Item -ItemType Directory -Force -Path "server\models" | Out-Null
New-Item -ItemType Directory -Force -Path "server\routes" | Out-Null
New-Item -ItemType Directory -Force -Path "server\utils" | Out-Null

@'
const crypto = require('crypto');

// Signed, expiring download links — so a report can be opened by someone who
// has no login (e.g. the person you sent it to on WhatsApp).
//
// A token is  <payload>.<signature>.  The payload only says WHICH report
// (type, format, date range) and WHEN the link dies. It is signed with an
// HMAC, so it cannot be edited or invented without the server secret, and the
// signature is checked BEFORE the payload is even parsed.

const SHARE_LINK_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const FORMATS = ['pdf', 'excel'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const signingKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  // Derived key: a share-link signature can never be mistaken for, or be
  // forged from, anything else the app signs with the same secret.
  return crypto.createHmac('sha256', secret).update('poultry-share-link-v1').digest();
};

const sign = (payload) => crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');

const createShareToken = ({ type, format, startDate, endDate }, { now = Date.now(), ttlMs = SHARE_LINK_TTL_MS } = {}) => {
  const expiresAt = now + ttlMs;
  const payload = Buffer.from(
    JSON.stringify({ t: type, f: format, a: startDate || null, b: endDate || null, e: expiresAt })
  ).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(expiresAt) };
};

const MALFORMED = { ok: false, reason: 'malformed' };

const verifyShareToken = (token, { now = Date.now() } = {}) => {
  if (typeof token !== 'string' || token.length === 0 || token.length > 1000) return MALFORMED;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return MALFORMED;
  const [payload, signature] = parts;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'bad-signature' };
  }

  // From here the payload is authentic, but validate its shape anyway.
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return MALFORMED;
  }
  const dateOk = (v) => v === null || (typeof v === 'string' && DATE_RE.test(v));
  if (
    !data || typeof data !== 'object' ||
    typeof data.t !== 'string' || !FORMATS.includes(data.f) ||
    !dateOk(data.a) || !dateOk(data.b) ||
    typeof data.e !== 'number' || !Number.isFinite(data.e)
  ) {
    return MALFORMED;
  }

  if (now >= data.e) return { ok: false, reason: 'expired' };

  return { ok: true, data: { type: data.t, format: data.f, startDate: data.a, endDate: data.b, expiresAt: data.e } };
};

module.exports = { createShareToken, verifyShareToken, SHARE_LINK_TTL_MS, FORMATS };
'@ | Out-File -Encoding utf8 "server\utils\shareToken.js"
Write-Host "wrote server/utils/shareToken.js"

@'
const EggLog = require('../models/EggLog');
const FeedBatch = require('../models/FeedBatch');
const FeedingLog = require('../models/FeedingLog');
const ManureLog = require('../models/ManureLog');
const BirdSale = require('../models/BirdSale');
const Settings = require('../models/Settings');

// One definition per report. The on-screen table, the PDF and the Excel file
// are ALL built from the output of buildReport(), so they can never disagree.

const MAX_ROWS = 5000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const REPORTS = {
  'egg-logs': {
    title: 'Egg Collection',
    model: EggLog,
    softDelete: true,
    populate: 'recordedBy',
    columns: [
      { key: 'date', label: 'Date', type: 'date', weight: 2 },
      { key: 'eggs', label: 'Eggs Collected', type: 'number', weight: 2, sum: true },
      { key: 'by', label: 'Recorded By', type: 'text', weight: 3 },
    ],
    toRow: (d) => ({ date: d.date, eggs: d.quantityCollected, by: d.recordedBy?.name || '' }),
  },
  'feed-batches': {
    title: 'Compounded Feed Added to Store',
    model: FeedBatch,
    softDelete: false,
    populate: 'producedBy',
    columns: [
      { key: 'date', label: 'Date', type: 'date', weight: 2 },
      { key: 'kg', label: 'Total (kg)', type: 'number', weight: 2, sum: true },
      { key: 'costPerKg', label: 'Cost per kg', type: 'money', weight: 2 },
      { key: 'totalCost', label: 'Total Cost', type: 'money', weight: 2, sum: true },
      { key: 'by', label: 'Logged By', type: 'text', weight: 3 },
      { key: 'notes', label: 'Notes', type: 'text', weight: 4 },
    ],
    toRow: (d) => ({
      date: d.date, kg: d.totalKg, costPerKg: d.costPerKg, totalCost: d.totalCost,
      by: d.producedBy?.name || '', notes: d.notes || '',
    }),
  },
  'feeding-logs': {
    title: 'Daily Feeding',
    model: FeedingLog,
    softDelete: true,
    populate: 'recordedBy',
    columns: [
      { key: 'date', label: 'Date', type: 'date', weight: 2 },
      { key: 'kg', label: 'Feed Given (kg)', type: 'number', weight: 2, sum: true },
      { key: 'source', label: 'Source', type: 'text', weight: 2 },
      { key: 'by', label: 'Recorded By', type: 'text', weight: 3 },
      { key: 'note', label: 'Note', type: 'text', weight: 4 },
    ],
    toRow: (d) => ({
      date: d.date, kg: d.quantityKg, source: capitalise(d.source),
      by: d.recordedBy?.name || (d.source === 'auto' ? 'System' : ''), note: d.note || '',
    }),
  },
  'manure-logs': {
    title: 'Manure / Waste',
    model: ManureLog,
    softDelete: true,
    populate: 'recordedBy',
    columns: [
      { key: 'date', label: 'Date', type: 'date', weight: 2 },
      { key: 'kg', label: 'Manure (kg)', type: 'number', weight: 2, sum: true },
      { key: 'by', label: 'Recorded By', type: 'text', weight: 3 },
      { key: 'note', label: 'Note', type: 'text', weight: 4 },
    ],
    toRow: (d) => ({ date: d.date, kg: d.quantityKg, by: d.recordedBy?.name || '', note: d.note || '' }),
  },
  'bird-sales': {
    title: 'Bird Sales',
    model: BirdSale,
    softDelete: true,
    populate: 'recordedBy',
    columns: [
      { key: 'date', label: 'Date', type: 'date', weight: 2 },
      { key: 'birdType', label: 'Type', type: 'text', weight: 2 },
      { key: 'qty', label: 'Quantity', type: 'number', weight: 1.5, sum: true },
      { key: 'price', label: 'Price per Bird', type: 'money', weight: 2 },
      { key: 'total', label: 'Total', type: 'money', weight: 2, sum: true },
      { key: 'by', label: 'Recorded By', type: 'text', weight: 3 },
      { key: 'notes', label: 'Notes', type: 'text', weight: 3 },
    ],
    toRow: (d) => ({
      date: d.date, birdType: capitalise(d.birdType), qty: d.quantity, price: d.pricePerUnit, total: d.totalPrice,
      by: d.recordedBy?.name || '', notes: d.notes || '',
    }),
  },
};

class ReportInputError extends Error {}

const isReportType = (type) => typeof type === 'string' && Object.prototype.hasOwnProperty.call(REPORTS, type);

// Accepts only a real calendar day written YYYY-MM-DD (so "2026-02-31" is out).
const isRealDate = (v) =>
  typeof v === 'string' && DATE_RE.test(v) &&
  !Number.isNaN(Date.parse(`${v}T00:00:00.000Z`)) &&
  new Date(`${v}T00:00:00.000Z`).toISOString().slice(0, 10) === v;

const normalizeFilters = ({ type, startDate, endDate } = {}) => {
  if (!isReportType(type)) throw new ReportInputError('Unknown report type');
  const start = startDate || null;
  const end = endDate || null;
  if (start !== null && !isRealDate(start)) throw new ReportInputError('Start date must be a real date written YYYY-MM-DD');
  if (end !== null && !isRealDate(end)) throw new ReportInputError('End date must be a real date written YYYY-MM-DD');
  if (start && end && start > end) throw new ReportInputError('Start date must be on or before the end date');
  return { type, startDate: start, endDate: end };
};

const round2 = (n) => Math.round(n * 100) / 100;

const periodLabelFor = (start, end) => {
  if (start && end) return `${start} to ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Up to ${end}`;
  return 'All records';
};

const buildReport = async (filters) => {
  const { type, startDate, endDate } = normalizeFilters(filters);
  const def = REPORTS[type];
  const settings = await Settings.getSingleton();
  const currency = settings.currency || 'KSh';

  const query = {};
  if (def.softDelete) query.isDeleted = { $ne: true };
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(`${startDate}T00:00:00.000Z`);
    if (endDate) query.date.$lte = new Date(`${endDate}T23:59:59.999Z`);
  }

  // Newest first so the row cap keeps the MOST RECENT rows; then flip to
  // oldest-first, which is how a period report reads.
  let docs = await def.model.find(query).sort({ date: -1 }).limit(MAX_ROWS + 1).populate(def.populate, 'name').lean();
  const truncated = docs.length > MAX_ROWS;
  docs = docs.slice(0, MAX_ROWS).reverse();

  const columns = def.columns.map((c) => ({
    key: c.key,
    label: c.type === 'money' ? `${c.label} (${currency})` : c.label,
    type: c.type,
    weight: c.weight,
    sum: !!c.sum,
  }));
  const rows = docs.map(def.toRow);

  const totals = {};
  columns.filter((c) => c.sum).forEach((c) => {
    totals[c.key] = round2(rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0));
  });

  return {
    type,
    title: `${def.title} Report`,
    periodLabel: periodLabelFor(startDate, endDate),
    currency,
    company: {
      name: settings.companyName || 'Poultry Farm',
      address: settings.address || '',
      phone: settings.phone || '',
      email: settings.email || '',
    },
    columns,
    rows,
    totals,
    rowCount: rows.length,
    truncated,
    maxRows: MAX_ROWS,
  };
};

const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

// Plain-JSON form for the on-screen table: dates become YYYY-MM-DD strings.
const toClientReport = (report) => {
  const dateKeys = report.columns.filter((c) => c.type === 'date').map((c) => c.key);
  return {
    type: report.type,
    title: report.title,
    periodLabel: report.periodLabel,
    currency: report.currency,
    columns: report.columns.map(({ key, label, type }) => ({ key, label, type })),
    rows: report.rows.map((r) => {
      const out = { ...r };
      dateKeys.forEach((k) => { out[k] = isoDay(r[k]); });
      return out;
    }),
    totals: report.totals,
    rowCount: report.rowCount,
    truncated: report.truncated,
    maxRows: report.maxRows,
  };
};

// Text form used by the PDF.
const formatValue = (col, v) => {
  if (v === null || v === undefined || v === '') return '';
  if (col.type === 'date') return isoDay(v);
  if (col.type === 'money') return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (col.type === 'number') return Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return String(v);
};

module.exports = { buildReport, normalizeFilters, toClientReport, formatValue, ReportInputError, REPORTS, MAX_ROWS };
'@ | Out-File -Encoding utf8 "server\utils\reportData.js"
Write-Host "wrote server/utils/reportData.js"

@'
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { formatValue } = require('./reportData');

const todayLabel = () => new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

// ---------------------------------------------------------------- PDF ----

const renderPdf = (report, generatedBy) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const LEFT = 40;
    const WIDTH = 515; // A4 width 595 minus 2 x 40 margin
    const PAD = 4;
    const FONT_SIZE = 8.5;
    const FOOTER_RESERVE = 60;
    const { columns, rows, totals, company } = report;

    // Letterhead
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#000000').text(company.name, LEFT, 40);
    const contact = [company.address, company.phone, company.email].filter(Boolean).join('  •  ');
    if (contact) doc.font('Helvetica').fontSize(9).fillColor('#555555').text(contact);
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000').text(report.title);
    doc.font('Helvetica').fontSize(10).fillColor('#555555').text(report.periodLabel);
    doc.text(`Generated by ${generatedBy} on ${todayLabel()}`);
    doc.moveDown(0.8);
    doc.moveTo(LEFT, doc.y).lineTo(LEFT + WIDTH, doc.y).lineWidth(0.5).strokeColor('#cccccc').stroke();
    doc.moveDown(0.8);
    doc.fillColor('#000000');

    // Column geometry
    const totalWeight = columns.reduce((s, c) => s + (c.weight || 1), 0);
    const widths = columns.map((c) => ((c.weight || 1) / totalWeight) * WIDTH);
    const xs = widths.map((_, i) => LEFT + widths.slice(0, i).reduce((a, b) => a + b, 0));
    const aligns = columns.map((c) => (c.type === 'number' || c.type === 'money' ? 'right' : 'left'));

    const setFont = (bold) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE);

    const rowHeight = (cells, bold) => {
      setFont(bold);
      return Math.max(...cells.map((t, i) => doc.heightOfString(t, { width: widths[i] - 2 * PAD }))) + 2 * PAD;
    };

    const drawRow = (cells, y, h, { bold = false, fill = null } = {}) => {
      cells.forEach((text, i) => {
        doc.lineWidth(0.5).strokeColor('#bbbbbb');
        if (fill) doc.rect(xs[i], y, widths[i], h).fillAndStroke(fill, '#bbbbbb');
        else doc.rect(xs[i], y, widths[i], h).stroke();
        setFont(bold);
        doc.fillColor('#000000').text(text, xs[i] + PAD, y + PAD, {
          width: widths[i] - 2 * PAD,
          align: aligns[i],
          lineBreak: true,
        });
      });
    };

    const bottomLimit = () => doc.page.height - FOOTER_RESERVE;
    let y = doc.y;
    const headerCells = columns.map((c) => c.label);

    const drawHeader = () => {
      const h = rowHeight(headerCells, true);
      drawRow(headerCells, y, h, { bold: true, fill: '#eaf3ea' });
      y += h;
    };

    if (rows.length === 0) {
      doc.font('Helvetica').fontSize(11).fillColor('#555555').text('No records for this period.', LEFT, y);
    } else {
      drawHeader();
      rows.forEach((r) => {
        const cells = columns.map((c) => formatValue(c, r[c.key]));
        const h = rowHeight(cells, false);
        if (y + h > bottomLimit()) {
          doc.addPage();
          y = doc.page.margins.top;
          drawHeader();
        }
        drawRow(cells, y, h);
        y += h;
      });

      // Totals row
      if (columns.some((c) => c.sum)) {
        const cells = columns.map((c, i) => {
          if (i === 0) return `TOTAL (${report.rowCount})`;
          return c.sum ? formatValue(c, totals[c.key]) : '';
        });
        const h = rowHeight(cells, true);
        if (y + h > bottomLimit()) {
          doc.addPage();
          y = doc.page.margins.top;
          drawHeader();
        }
        drawRow(cells, y, h, { bold: true, fill: '#f3f4f3' });
        y += h;
      }

      if (report.truncated) {
        y += 8;
        doc.font('Helvetica').fontSize(8.5).fillColor('#b45309')
          .text(`Showing the most recent ${report.maxRows} records only. Narrow the date range to see the rest.`, LEFT, y, { width: WIDTH });
      }
    }

    // Footer on every page ("Page X of Y"). The bottom margin is lowered while
    // writing so pdfkit doesn't spill the footer onto an extra blank page.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor('#888888')
        .text(`${company.name}  •  ${report.title}  •  Page ${i - range.start + 1} of ${range.count}`,
          LEFT, doc.page.height - 30, { width: WIDTH, align: 'center', lineBreak: false });
      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });

// -------------------------------------------------------------- Excel ----

const sheetName = (title) => title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Report';

const renderExcel = async (report) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = report.company.name;
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName(report.title));

  const { columns, rows, totals } = report;
  const lastCol = columns.length;

  ws.getCell('A1').value = report.company.name;
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A2').value = report.title;
  ws.getCell('A2').font = { bold: true, size: 12 };
  ws.getCell('A3').value = report.periodLabel;
  ws.getCell('A3').font = { color: { argb: 'FF555555' } };

  const HEADER_ROW = 5;
  const headerRow = ws.getRow(HEADER_ROW);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF3EA' } };
    cell.alignment = { horizontal: c.type === 'number' || c.type === 'money' ? 'right' : 'left', vertical: 'middle', wrapText: true };
  });

  const NUM_FMT = { number: '#,##0.##', money: '#,##0.00', date: 'yyyy-mm-dd' };
  const border = { style: 'thin', color: { argb: 'FFBBBBBB' } };
  const boxed = { top: border, left: border, bottom: border, right: border };

  rows.forEach((r, ri) => {
    const row = ws.getRow(HEADER_ROW + 1 + ri);
    columns.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      const v = r[c.key];
      if (c.type === 'date') cell.value = v ? new Date(`${new Date(v).toISOString().slice(0, 10)}T00:00:00.000Z`) : null;
      else if (c.type === 'number' || c.type === 'money') cell.value = v === null || v === undefined || v === '' ? null : Number(v);
      else cell.value = v === null || v === undefined ? '' : String(v);
      if (NUM_FMT[c.type]) cell.numFmt = NUM_FMT[c.type];
      cell.alignment = { horizontal: c.type === 'number' || c.type === 'money' ? 'right' : 'left', vertical: 'top', wrapText: c.type === 'text' };
      cell.border = boxed;
    });
  });

  let nextRow = HEADER_ROW + 1 + rows.length;
  if (rows.length > 0 && columns.some((c) => c.sum)) {
    const row = ws.getRow(nextRow);
    columns.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      if (ci === 0) cell.value = `TOTAL (${report.rowCount})`;
      else if (c.sum) { cell.value = totals[c.key]; cell.numFmt = NUM_FMT[c.type]; }
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F3' } };
      cell.alignment = { horizontal: c.type === 'number' || c.type === 'money' ? 'right' : 'left' };
      cell.border = boxed;
    });
    nextRow += 1;
  }
  if (rows.length === 0) ws.getCell(`A${nextRow}`).value = 'No records for this period.';
  if (report.truncated) {
    ws.getCell(`A${nextRow + 1}`).value = `Showing the most recent ${report.maxRows} records only. Narrow the date range to see the rest.`;
    ws.getCell(`A${nextRow + 1}`).font = { color: { argb: 'FFB45309' } };
  }

  columns.forEach((c, i) => {
    const longest = Math.max(
      c.label.length,
      ...rows.slice(0, 200).map((r) => formatValue(c, r[c.key]).length)
    );
    ws.getColumn(i + 1).width = Math.min(Math.max(longest + 3, 12), c.type === 'text' ? 45 : 22);
  });

  ws.views = [{ state: 'frozen', ySplit: HEADER_ROW }];
  if (rows.length > 0) ws.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + rows.length, column: lastCol } };

  return Buffer.from(await wb.xlsx.writeBuffer());
};

module.exports = { renderPdf, renderExcel };
'@ | Out-File -Encoding utf8 "server\utils\reportFiles.js"
Write-Host "wrote server/utils/reportFiles.js"

@'
const express = require('express');
const asyncHandler = require('express-async-handler');
const PDFDocument = require('pdfkit');
const EggLog = require('../models/EggLog');
const DailyEggStock = require('../models/DailyEggStock');
const BirdSale = require('../models/BirdSale');
const FeedingLog = require('../models/FeedingLog');
const ManureLog = require('../models/ManureLog');
const Flock = require('../models/Flock');
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');
const logAction = require('../utils/logAction');
const { buildReport, normalizeFilters, toClientReport, ReportInputError } = require('../utils/reportData');
const { renderPdf, renderExcel } = require('../utils/reportFiles');
const { createShareToken, verifyShareToken } = require('../utils/shareToken');

const router = express.Router();

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Builds the file and sends it as a download.
const sendReportFile = async (res, report, format, generatedBy) => {
  const isExcel = format === 'excel';
  const buffer = isExcel ? await renderExcel(report) : await renderPdf(report, generatedBy);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', isExcel ? XLSX_MIME : 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${report.type}_report_${stamp}.${isExcel ? 'xlsx' : 'pdf'}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
};

// Plain page for the person who opens a dead link — static text only.
const linkPage = (title, message) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
  `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#292524">` +
  `<h1 style="font-size:1.25rem">${title}</h1><p>${message}</p></body></html>`;

// PUBLIC — deliberately registered BEFORE router.use(protect): the person
// who gets this link on WhatsApp has no login. The signed token is the only
// thing guarding it; see utils/shareToken.js.
router.get(
  '/shared/:token',
  asyncHandler(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const result = verifyShareToken(req.params.token);
    if (!result.ok) {
      if (result.reason === 'expired') {
        return res.status(410).type('html').send(linkPage('This link has expired', 'Ask the sender to share the report again.'));
      }
      return res.status(403).type('html').send(linkPage('This link is not valid', 'Check that the whole link was copied, or ask the sender to share it again.'));
    }

    const { type, format, startDate, endDate } = result.data;
    let report;
    try {
      report = await buildReport({ type, startDate, endDate });
    } catch (err) {
      if (err instanceof ReportInputError) {
        return res.status(403).type('html').send(linkPage('This link is not valid', 'Ask the sender to share it again.'));
      }
      throw err;
    }
    await sendReportFile(res, report, format, 'Shared link');
  })
);

// Anything that goes wrong on the PUBLIC link route ends up here, so a person
// opening a link never sees a raw JSON error or a stack trace. A malformed
// link (e.g. a broken %-escape, which Express reports as a 400) reads as "not
// valid"; anything else is a generic problem and nothing is leaked to them.
router.use('/shared', (err, req, res, next) => {
  if (res.headersSent) return next(err);
  res.setHeader('Cache-Control', 'private, no-store');
  if (err instanceof URIError || err.status === 400 || err.statusCode === 400) {
    return res.status(403).type('html').send(linkPage('This link is not valid', 'Check that the whole link was copied, or ask the sender to share it again.'));
  }
  console.error('Shared report link failed:', err);
  return res.status(500).type('html').send(linkPage('Something went wrong', 'The report could not be prepared. Please try again in a minute.'));
});

router.use(protect);

const dateStr = (d) => new Date(d).toISOString().slice(0, 10);
const startOfDay = (d) => new Date(`${dateStr(d)}T00:00:00.000Z`);
const endOfDay = (d) => new Date(`${dateStr(d)}T23:59:59.999Z`);

// Totals for one calendar day — used both for the daily report and as a
// building block for each row of the weekly report's day-by-day table.
const dayTotals = async (day) => {
  const [eggAgg, feedingLogs, stockRow, birdSales, manureLogs] = await Promise.all([
    EggLog.aggregate([
      { $match: { isDeleted: { $ne: true }, date: { $gte: startOfDay(day), $lte: endOfDay(day) } } },
      { $group: { _id: null, total: { $sum: '$quantityCollected' } } },
    ]),
    FeedingLog.find({ isDeleted: { $ne: true }, date: { $gte: startOfDay(day), $lte: endOfDay(day) } }),
    DailyEggStock.findOne({ date: dateStr(day), isDeleted: { $ne: true } }),
    BirdSale.find({ isDeleted: { $ne: true }, date: { $gte: startOfDay(day), $lte: endOfDay(day) } }),
    ManureLog.find({ isDeleted: { $ne: true }, date: { $gte: startOfDay(day), $lte: endOfDay(day) } }),
  ]);

  const feedKg = feedingLogs.reduce((s, l) => s + l.quantityKg, 0);
  const manureKg = manureLogs.reduce((s, l) => s + l.quantityKg, 0);
  const eggRevenue = stockRow ? stockRow.revenue : 0;
  const birdRevenue = birdSales.reduce((s, b) => s + b.totalPrice, 0);
  const birdsSold = birdSales.reduce((s, b) => s + b.quantity, 0);

  return {
    date: dateStr(day),
    eggsCollected: eggAgg[0]?.total || 0,
    feedKg,
    manureKg,
    eggRevenue,
    birdRevenue,
    revenue: eggRevenue + birdRevenue,
    birdsSold,
  };
};

const drawLetterhead = (doc, settings, title, rangeLabel, generatedBy) => {
  doc.fontSize(18).font('Helvetica-Bold').text(settings.companyName || 'Poultry Farm', { align: 'left' });
  doc.fontSize(9).font('Helvetica').fillColor('#555555');
  const contactLine = [settings.address, settings.phone, settings.email].filter(Boolean).join('  •  ');
  if (contactLine) doc.text(contactLine);
  doc.moveDown(0.8);
  doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text(title);
  doc.fontSize(10).font('Helvetica').fillColor('#555555').text(rangeLabel);
  doc.text(`Generated by ${generatedBy} on ${new Date().toLocaleString()}`);
  doc.fillColor('#000000');
  doc.moveDown(1);
  const y = doc.y;
  doc.moveTo(40, y).lineTo(555, y).strokeColor('#cccccc').stroke();
  doc.moveDown(1);
};

const drawStatRow = (doc, label, value) => {
  const startX = 40;
  doc.font('Helvetica').fontSize(10).fillColor('#555555').text(label, startX, doc.y, { continued: false });
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text(String(value), startX, doc.y - 14, { align: 'right', width: 515 });
  doc.moveDown(0.3);
};

// GET /api/reports/summary-pdf?range=daily|weekly&date=YYYY-MM-DD
router.get(
  '/summary-pdf',
  asyncHandler(async (req, res) => {
    const range = req.query.range === 'weekly' ? 'weekly' : 'daily';
    const endDate = req.query.date ? new Date(req.query.date) : new Date();
    if (isNaN(endDate.getTime())) {
      res.status(400);
      throw new Error('Invalid date');
    }

    const settings = await Settings.getSingleton();
    const currency = settings.currency || 'KSh';
    const flock = await Flock.getSingleton();

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const filename = `poultry-${range}-summary-${dateStr(endDate)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    if (range === 'daily') {
      const totals = await dayTotals(endDate);
      const feedCost = totals.feedKg * settings.compoundedFeedCostPerKg;
      const profit = totals.revenue - feedCost;

      drawLetterhead(doc, settings, 'Daily Production & Financial Summary', dateStr(endDate), req.user.name);

      drawStatRow(doc, 'Eggs collected', totals.eggsCollected);
      drawStatRow(doc, 'Feed consumed (kg)', totals.feedKg.toFixed(2));
      drawStatRow(doc, `Feed cost (${currency})`, feedCost.toFixed(2));
      drawStatRow(doc, 'Manure produced (kg)', totals.manureKg.toFixed(2));
      drawStatRow(doc, 'Birds sold', totals.birdsSold);
      doc.moveDown(0.3);
      drawStatRow(doc, `Egg revenue (${currency})`, totals.eggRevenue.toFixed(2));
      drawStatRow(doc, `Bird sale revenue (${currency})`, totals.birdRevenue.toFixed(2));
      drawStatRow(doc, `Total revenue (${currency})`, totals.revenue.toFixed(2));
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(profit >= 0 ? '#15803d' : '#dc2626');
      doc.text(`Profit: ${currency} ${profit.toFixed(2)}`, 40, doc.y, { align: 'right', width: 515 });
      doc.fillColor('#000000');

      doc.moveDown(1.5);
      doc.font('Helvetica').fontSize(9).fillColor('#777777');
      doc.text(
        `Current flock: ${flock.liveLayerCount} layers, ${flock.liveRoosterCount} roosters, ${flock.liveChickCount} chicks (${
          flock.liveLayerCount + flock.liveRoosterCount + flock.liveChickCount
        } total).`
      );
    } else {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(endDate);
        d.setDate(d.getDate() - i);
        days.push(d);
      }
      const rows = await Promise.all(days.map((d) => dayTotals(d)));

      const weekFeedKg = rows.reduce((s, r) => s + r.feedKg, 0);
      const weekFeedCost = weekFeedKg * settings.compoundedFeedCostPerKg;
      const weekRevenue = rows.reduce((s, r) => s + r.revenue, 0);
      const weekEggs = rows.reduce((s, r) => s + r.eggsCollected, 0);
      const weekManure = rows.reduce((s, r) => s + r.manureKg, 0);
      const weekBirdsSold = rows.reduce((s, r) => s + r.birdsSold, 0);
      const weekProfit = weekRevenue - weekFeedCost;

      drawLetterhead(
        doc,
        settings,
        'Weekly Production & Financial Summary',
        `${dateStr(days[0])} to ${dateStr(days[6])}`,
        req.user.name
      );

      drawStatRow(doc, 'Total eggs collected', weekEggs);
      drawStatRow(doc, 'Total feed consumed (kg)', weekFeedKg.toFixed(2));
      drawStatRow(doc, `Total feed cost (${currency})`, weekFeedCost.toFixed(2));
      drawStatRow(doc, 'Total manure produced (kg)', weekManure.toFixed(2));
      drawStatRow(doc, 'Total birds sold', weekBirdsSold);
      drawStatRow(doc, `Total revenue (${currency})`, weekRevenue.toFixed(2));
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(weekProfit >= 0 ? '#15803d' : '#dc2626');
      doc.text(`Profit: ${currency} ${weekProfit.toFixed(2)}`, 40, doc.y, { align: 'right', width: 515 });
      doc.fillColor('#000000');

      doc.moveDown(1.2);
      doc.font('Helvetica-Bold').fontSize(11).text('Day-by-day breakdown');
      doc.moveDown(0.3);

      const colX = [40, 140, 230, 330, 440];
      const colW = [95, 85, 95, 100, 115];
      const headers = ['Date', 'Eggs', 'Feed (kg)', 'Manure (kg)', `Revenue (${currency})`];
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555');
      // Same direct-positioning approach as the data rows below — NOT
      // chained `continued: true` calls, which wrap unpredictably and
      // throw off doc.y when a header is wider than its column.
      const headerY = doc.y;
      headers.forEach((h, i) => doc.text(h, colX[i], headerY, { width: colW[i], lineBreak: false }));
      doc.y = headerY + 14;
      const headerLineY = doc.y;
      doc.moveTo(40, headerLineY).lineTo(555, headerLineY).strokeColor('#cccccc').stroke();
      doc.moveDown(0.3);

      doc.font('Helvetica').fontSize(9).fillColor('#000000');
      rows.forEach((r) => {
        const rowY = doc.y;
        doc.text(r.date, colX[0], rowY, { width: colW[0], lineBreak: false });
        doc.text(String(r.eggsCollected), colX[1], rowY, { width: colW[1], lineBreak: false });
        doc.text(r.feedKg.toFixed(2), colX[2], rowY, { width: colW[2], lineBreak: false });
        doc.text(r.manureKg.toFixed(2), colX[3], rowY, { width: colW[3], lineBreak: false });
        doc.text(r.revenue.toFixed(2), colX[4], rowY, { width: colW[4], lineBreak: false });
        doc.y = rowY + 14;
      });

      doc.moveDown(1);
      doc.font('Helvetica').fontSize(9).fillColor('#777777');
      doc.text(
        `Current flock: ${flock.liveLayerCount} layers, ${flock.liveRoosterCount} roosters, ${flock.liveChickCount} chicks (${
          flock.liveLayerCount + flock.liveRoosterCount + flock.liveChickCount
        } total).`
      );
    }

    doc.end();
  })
);

// ---- Reports page: one data source behind the table, PDF, Excel and sharing ----

const filtersFromQuery = (res, query) => {
  try {
    return normalizeFilters({ type: query.type, startDate: query.startDate, endDate: query.endDate });
  } catch (err) {
    if (err instanceof ReportInputError) res.status(400);
    throw err;
  }
};

// GET /api/reports/data?type=egg-logs&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get(
  '/data',
  asyncHandler(async (req, res) => {
    const filters = filtersFromQuery(res, req.query);
    res.json(toClientReport(await buildReport(filters)));
  })
);

// GET /api/reports/export/pdf|excel?type=...&startDate=...&endDate=...
router.get(
  '/export/:format',
  asyncHandler(async (req, res) => {
    const { format } = req.params;
    if (format !== 'pdf' && format !== 'excel') {
      res.status(404);
      throw new Error('Unknown export format');
    }
    const filters = filtersFromQuery(res, req.query);
    await sendReportFile(res, await buildReport(filters), format, req.user.name);
  })
);

// POST /api/reports/share-link  { type, format, startDate, endDate }
// Creates a public download link that works for 48 hours. Limited to
// Administrator and Manager, since it hands report data to someone with no
// login. (Everyone can still send the FILE itself from their own phone.)
router.post(
  '/share-link',
  authorize('Administrator', 'Manager'),
  asyncHandler(async (req, res) => {
    const { format } = req.body;
    if (format !== 'pdf' && format !== 'excel') {
      res.status(400);
      throw new Error('format must be "pdf" or "excel"');
    }
    const filters = filtersFromQuery(res, req.body);
    const { token, expiresAt } = createShareToken({ ...filters, format });

    const base =
      (process.env.PUBLIC_API_URL || '').replace(/\/+$/, '') ||
      `${(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim()}://${req.get('host')}`;

    await logAction(req, {
      action: 'create',
      entityType: 'Report',
      entityLabel: `${filters.type} (${format}) public link`,
      details: `Anyone with the link can open it until ${expiresAt.toISOString()}. Range: ${filters.startDate || 'start'} to ${filters.endDate || 'now'}.`,
    });

    res.status(201).json({ url: `${base}/api/reports/shared/${token}`, expiresAt });
  })
);

module.exports = router;
'@ | Out-File -Encoding utf8 "server\routes\reportRoutes.js"
Write-Host "wrote server/routes/reportRoutes.js"

@'
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, default: 'System' },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'restore', 'permanent_delete', 'role_change', 'password_reset', 'activate', 'deactivate', 'stock_adjust', 'login', 'logout', 'register'],
      required: true,
    },
    entityType: {
      type: String,
      enum: ['FeedBatch', 'FeedIngredient', 'Flock', 'EggLog', 'DailyEggStock', 'BirdSale', 'Settings', 'User', 'HealthLog', 'Report'],
      required: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    entityLabel: { type: String, default: '' },
    details: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
'@ | Out-File -Encoding utf8 "server\models\AuditLog.js"
Write-Host "wrote server/models/AuditLog.js"

@'
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
'@ | Out-File -Encoding utf8 "client\src\pages\Reports.jsx"
Write-Host "wrote client/src/pages/Reports.jsx"

Push-Location server
npm install exceljs
Pop-Location

git add .
git commit -m "Reports: PDF/Excel export, send via WhatsApp (share sheet + 48h signed link), date filters"
git push
Write-Host "Done. Wait for Render and Vercel to finish deploying, then hard-refresh the app." -ForegroundColor Green