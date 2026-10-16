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
