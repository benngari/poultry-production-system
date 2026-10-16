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
