// Adds "Flock Performance" (laying rate, early warning, feed per egg) to Poultry Pro.
// Run from your PROJECT ROOT:   node install-flock-performance.js
// It checks every patch point FIRST and changes nothing if any of them has moved.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FILES = {
  "server/utils/flockPerformance.js": "// Pure calculations (no database) behind the \"Flock Performance\" card:\n// laying rate, an early-warning check, and feed per egg.\n\nconst DAY_MS = 86400000;\n\n// Early warning: compare the most recent days with the days just before them.\nconst RECENT_DAYS = 3;\nconst BASELINE_DAYS = 7;\nconst MIN_BASELINE_LOGGED_DAYS = 3;\nconst WATCH_DROP_POINTS = 10;\nconst ALERT_DROP_POINTS = 20;\n\nconst dayKey = (d) => new Date(d).toISOString().slice(0, 10);\nconst addDays = (key, n) => dayKey(Date.parse(`${key}T00:00:00.000Z`) + n * DAY_MS);\nconst round = (n, dp = 1) => { const f = 10 ** dp; return Math.round(n * f) / f; };\n\n// How a flock-history entry changes the number of birds.\nconst txDelta = (t) => {\n  if (t.type === 'hatched' || t.type === 'purchased') return t.quantity;\n  if (t.type === 'sold' || t.type === 'died' || t.type === 'culled') return -t.quantity;\n  return 0;\n};\n\n// Layers alive at the END of a day, worked backwards from today's count by\n// undoing every layer change that happened after that day.\nconst layersAtEndOfDay = (currentLayers, transactions, key) => {\n  const end = Date.parse(`${key}T23:59:59.999Z`);\n  const after = transactions\n    .filter((t) => t.birdType === 'layer' && new Date(t.date).getTime() > end)\n    .reduce((sum, t) => sum + txDelta(t), 0);\n  const layers = currentLayers - after;\n  return layers > 0 ? layers : null; // negative/zero => history doesn't add up; don't guess\n};\n\nconst buildDailyRows = ({ endDay, window, eggLogs, feedingLogs, currentLayers, transactions }) => {\n  const eggs = {}; const logged = new Set(); const feed = {};\n  eggLogs.forEach((l) => { const k = dayKey(l.date); eggs[k] = (eggs[k] || 0) + l.quantityCollected; logged.add(k); });\n  feedingLogs.forEach((l) => { const k = dayKey(l.date); feed[k] = (feed[k] || 0) + l.quantityKg; });\n\n  return Array.from({ length: window }, (_, i) => {\n    const date = addDays(endDay, i - (window - 1));\n    const layers = layersAtEndOfDay(currentLayers, transactions, date);\n    const isLogged = logged.has(date); // an entry exists (even if it says 0 eggs)\n    const eggCount = eggs[date] || 0;\n    return {\n      date,\n      eggs: eggCount,\n      logged: isLogged,\n      feedKg: round(feed[date] || 0, 2),\n      layers,\n      // No entry that day = \"not recorded\", which is NOT the same as 0%.\n      layingRate: isLogged && layers ? round((eggCount / layers) * 100, 1) : null,\n    };\n  });\n};\n\n// Rate over several days = total eggs / total layer-days, so a big flock day\n// counts for more than a small one. Only days that were actually recorded.\nconst aggregateRate = (rows) => {\n  const usable = rows.filter((r) => r.logged && r.layers);\n  if (usable.length === 0) return null;\n  const eggs = usable.reduce((s, r) => s + r.eggs, 0);\n  const layerDays = usable.reduce((s, r) => s + r.layers, 0);\n  return { rate: round((eggs / layerDays) * 100, 1), loggedDays: usable.length };\n};\n\nconst feedPerEgg = (rows, { costPerKg, eggPrice }) => {\n  const days = rows.filter((r) => r.logged); // only days where eggs were recorded\n  const eggs = days.reduce((s, r) => s + r.eggs, 0);\n  if (days.length === 0 || eggs === 0) return null;\n  const feedKg = days.reduce((s, r) => s + r.feedKg, 0);\n  const kgPerEgg = round(feedKg / eggs, 3);\n  const feedCostPerEgg = round(kgPerEgg * costPerKg, 2);\n  return {\n    kgPerEgg,\n    gramsPerEgg: Math.round(kgPerEgg * 1000),\n    feedCostPerEgg,\n    eggPrice,\n    margin: round(eggPrice - feedCostPerEgg, 2),\n    loggedDays: days.length,\n    // Eggs recorded but no feed recorded that day would make feed per egg look better than it is.\n    daysWithoutFeed: days.filter((r) => r.feedKg === 0).length,\n  };\n};\n\nconst buildFlockPerformance = ({ endDay, days, eggLogs, feedingLogs, currentLayers, transactions, costPerKg, eggPrice, currency }) => {\n  const window = Math.max(days, 30);\n  const rows = buildDailyRows({ endDay, window, eggLogs, feedingLogs, currentLayers, transactions });\n\n  const recent = aggregateRate(rows.slice(-RECENT_DAYS));\n  const baseline = aggregateRate(rows.slice(-(RECENT_DAYS + BASELINE_DAYS), -RECENT_DAYS));\n  let status = 'unknown';\n  let drop = null;\n  if (recent && baseline && baseline.loggedDays >= MIN_BASELINE_LOGGED_DAYS) {\n    drop = round(baseline.rate - recent.rate, 1);\n    status = drop >= ALERT_DROP_POINTS ? 'alert' : drop >= WATCH_DROP_POINTS ? 'watch' : 'normal';\n  }\n\n  const latestRow = [...rows].reverse().find((r) => r.logged && r.layers);\n  const costs = { costPerKg, eggPrice };\n\n  return {\n    asOf: endDay,\n    currentLayers,\n    series: rows.slice(-days),\n    latest: latestRow ? { date: latestRow.date, eggs: latestRow.eggs, layers: latestRow.layers, rate: latestRow.layingRate } : null,\n    avg7: aggregateRate(rows.slice(-7)),\n    recent, baseline, drop, status,\n    overHundred: rows.slice(-7).some((r) => r.layingRate !== null && r.layingRate > 100),\n    fcr: { d7: feedPerEgg(rows.slice(-7), costs), d30: feedPerEgg(rows.slice(-30), costs) },\n    thresholds: { watch: WATCH_DROP_POINTS, alert: ALERT_DROP_POINTS, recentDays: RECENT_DAYS, baselineDays: BASELINE_DAYS },\n    currency,\n  };\n};\n\nmodule.exports = { buildFlockPerformance, buildDailyRows, aggregateRate, feedPerEgg, layersAtEndOfDay, dayKey, addDays };\n",
  "server/routes/flockPerformanceRoutes.js": "const express = require('express');\nconst asyncHandler = require('express-async-handler');\nconst EggLog = require('../models/EggLog');\nconst FeedingLog = require('../models/FeedingLog');\nconst Flock = require('../models/Flock');\nconst Settings = require('../models/Settings');\nconst { protect } = require('../middleware/auth');\nconst { buildFlockPerformance, dayKey, addDays } = require('../utils/flockPerformance');\n\nconst router = express.Router();\nrouter.use(protect);\n\n// GET /api/flock-performance?days=14   (days: whole number, 7 to 60)\n// Laying rate (eggs / layers alive that day), an early-warning status, and\n// feed per egg. Read-only, so every logged-in role can see it.\nrouter.get(\n  '/',\n  asyncHandler(async (req, res) => {\n    const raw = req.query.days;\n    const days = raw === undefined ? 14 : typeof raw === 'string' && /^\\d+$/.test(raw) ? Number(raw) : NaN;\n    if (!Number.isInteger(days) || days < 7 || days > 60) {\n      res.status(400);\n      throw new Error('days must be a whole number from 7 to 60');\n    }\n\n    const endDay = dayKey(new Date());\n    const from = new Date(`${addDays(endDay, -(Math.max(days, 30) - 1))}T00:00:00.000Z`);\n    const range = { isDeleted: { $ne: true }, date: { $gte: from } };\n\n    const [eggLogs, feedingLogs, flock, settings] = await Promise.all([\n      EggLog.find(range).select('date quantityCollected').lean(),\n      FeedingLog.find(range).select('date quantityKg').lean(),\n      Flock.getSingleton(),\n      Settings.getSingleton(),\n    ]);\n\n    res.json(\n      buildFlockPerformance({\n        endDay,\n        days,\n        eggLogs,\n        feedingLogs,\n        currentLayers: flock.liveLayerCount,\n        transactions: (flock.transactions || []).map((t) => ({ type: t.type, birdType: t.birdType, quantity: t.quantity, date: t.date })),\n        costPerKg: settings.compoundedFeedCostPerKg,\n        eggPrice: settings.eggSellingPrice,\n        currency: settings.currency || 'KSh',\n      })\n    );\n  })\n);\n\nmodule.exports = router;\n",
  "client/src/components/FlockPerformance.jsx": "import React, { useEffect, useState } from 'react';\nimport { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';\nimport api from '../api/axios';\n\nconst STATUS = {\n  normal: { label: 'Normal', cls: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' },\n  watch: { label: 'Watch', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },\n  alert: { label: 'Alert', cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' },\n  unknown: { label: 'Not enough data yet', cls: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300' },\n};\n\nconst statusMessage = (d) => {\n  const t = d.thresholds;\n  if (d.status === 'watch' || d.status === 'alert') {\n    return `Laying rate fell ${d.drop} points \u2014 from ${d.baseline.rate}% (the ${t.baselineDays} days before) to ${d.recent.rate}% (the last ${t.recentDays} days). A drop like this can be an early sign of stress or illness: check feed, water, heat and the birds themselves.`;\n  }\n  if (d.status === 'normal') {\n    const change = d.drop < 0 ? `up ${Math.abs(d.drop)} points` : `down ${d.drop} points`;\n    return `Steady \u2014 ${d.recent.rate}% over the last ${t.recentDays} days, ${change} on the ${d.baseline.rate}% before.`;\n  }\n  return 'Log eggs every day \u2014 the early warning needs a few days of history to compare against.';\n};\n\nconst pct = (v) => (v === null || v === undefined ? '\u2014' : `${v}%`);\n\nconst Tile = ({ label, value, children }) => (\n  <div className=\"stat-card\">\n    <div className=\"stat-label\">{label}</div>\n    <div className=\"stat-value\">{value}</div>\n    <div className=\"text-xs text-neutral-500 mt-1 space-y-0.5\">{children}</div>\n  </div>\n);\n\nconst FlockPerformance = () => {\n  const [data, setData] = useState(null);\n  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'error'\n\n  useEffect(() => {\n    let cancelled = false;\n    api.get('/flock-performance', { params: { days: 14 } })\n      .then((res) => { if (!cancelled) { setData(res.data); setState('ready'); } })\n      .catch(() => { if (!cancelled) setState('error'); });\n    return () => { cancelled = true; };\n  }, []);\n\n  if (state === 'loading') {\n    return <div data-testid=\"fp-loading\" className=\"app-card h-64 animate-pulse\" />;\n  }\n  if (state === 'error' || !data) {\n    return (\n      <div className=\"app-card text-sm text-neutral-500\">\n        Flock performance could not be loaded right now. The rest of the dashboard is unaffected.\n      </div>\n    );\n  }\n\n  const s = STATUS[data.status] || STATUS.unknown;\n  const f7 = data.fcr.d7;\n  const f30 = data.fcr.d30;\n  const cur = data.currency;\n\n  return (\n    <section className=\"app-card space-y-4\">\n      <div className=\"flex flex-wrap items-center justify-between gap-2\">\n        <h2 className=\"font-semibold\">Flock Performance</h2>\n        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>\n      </div>\n\n      <p className={`text-sm ${data.status === 'alert' ? 'text-red-600' : data.status === 'watch' ? 'text-amber-600' : 'text-neutral-500'}`}>\n        {statusMessage(data)}\n      </p>\n      {data.overHundred && (\n        <p className=\"text-xs text-amber-600\">\n          A day in the last week shows more than 100% \u2014 the eggs entered or the layer count on the Flock page may be off.\n        </p>\n      )}\n\n      <div className=\"grid grid-cols-1 gap-3 sm:grid-cols-3\">\n        <Tile label=\"Laying rate \u2014 latest\" value={pct(data.latest?.rate)}>\n          {data.latest\n            ? <p>{data.latest.date} \u00b7 {data.latest.eggs} eggs from {data.latest.layers} layers</p>\n            : <p>No egg entries yet</p>}\n        </Tile>\n        <Tile label=\"Laying rate \u2014 7 days\" value={pct(data.avg7?.rate)}>\n          {data.avg7 ? <p>{data.avg7.loggedDays} of 7 days recorded</p> : <p>No recorded days</p>}\n        </Tile>\n        <Tile label=\"Feed per egg \u2014 7 days\" value={f7 ? `${f7.gramsPerEgg} g` : '\u2014'}>\n          {f7 ? (\n            <>\n              <p>{f7.kgPerEgg} kg per egg</p>\n              <p>\n                Feed cost {cur} {f7.feedCostPerEgg} per egg \u00b7 price {cur} {f7.eggPrice}\n                {' '}\n                <span className={f7.margin < 0 ? 'font-semibold text-red-600' : 'font-semibold text-green-700 dark:text-green-400'}>\n                  ({f7.margin < 0 ? 'losing' : 'leaves'} {cur} {Math.abs(f7.margin)})\n                </span>\n              </p>\n              {f7.daysWithoutFeed > 0 && (\n                <p className=\"text-amber-600\">\n                  {f7.daysWithoutFeed} recorded {f7.daysWithoutFeed === 1 ? 'day has' : 'days have'} no feed entered, so the real figure is probably higher.\n                </p>\n              )}\n              {f30 && <p>30 days: {f30.gramsPerEgg} g per egg</p>}\n            </>\n          ) : <p>Needs recorded eggs and feed</p>}\n        </Tile>\n      </div>\n\n      <div>\n        <div className=\"text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2\">Daily laying rate \u2014 last 14 days</div>\n        <div data-testid=\"fp-chart\">\n          <ResponsiveContainer width=\"100%\" height={200}>\n            <LineChart data={data.series}>\n              <CartesianGrid strokeDasharray=\"3 3\" stroke=\"var(--border)\" />\n              <XAxis dataKey=\"date\" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11 }} />\n              <YAxis domain={[0, (max) => Math.max(100, Math.ceil(max))]} unit=\"%\" allowDecimals={false} tick={{ fontSize: 11 }} />\n              <Tooltip formatter={(v) => (v === null || v === undefined ? 'not recorded' : `${v}%`)} />\n              <Line type=\"monotone\" dataKey=\"layingRate\" name=\"Laying rate\" stroke=\"#16a34a\" strokeWidth={2} dot connectNulls={false} />\n            </LineChart>\n          </ResponsiveContainer>\n        </div>\n        <p className=\"text-xs text-neutral-500 mt-1\">Days with no egg entry are left as gaps, not shown as 0%.</p>\n      </div>\n    </section>\n  );\n};\n\nexport default FlockPerformance;\n"
};

// Each patch inserts text next to a line that must appear exactly once.
const PATCHES = [
  {
    file: 'server/server.js', marker: 'flockPerformanceRoutes',
    anchor: "const dashboardRoutes = require('./routes/dashboardRoutes');", where: 'after',
    insert: "const flockPerformanceRoutes = require('./routes/flockPerformanceRoutes');",
  },
  {
    file: 'server/server.js', marker: "'/api/flock-performance'",
    anchor: "app.use('/api/dashboard', dashboardRoutes);", where: 'after',
    insert: "app.use('/api/flock-performance', flockPerformanceRoutes);",
  },
  {
    file: 'client/src/pages/Dashboard.jsx', marker: "import FlockPerformance",
    anchor: "import DashboardSkeleton from '../components/DashboardSkeleton';", where: 'after',
    insert: "import FlockPerformance from '../components/FlockPerformance';",
  },
  {
    file: 'client/src/pages/Dashboard.jsx', marker: '<FlockPerformance />',
    anchor: '<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">', where: 'before',
    insert: '<FlockPerformance />', indentAfter: true,
  },
];

const fail = (msg) => { console.error('\nSTOPPED - nothing was changed.\n' + msg + '\n'); process.exit(1); };
const countOf = (text, needle) => text.split(needle).length - 1;

if (!fs.existsSync('server/server.js') || !fs.existsSync('client/src')) {
  fail('Run this from the poultry-production-system folder (the one that contains "client" and "server").');
}

// ---- Phase 1: work out every change in memory; touch nothing yet.
const pending = {};
const read = (f) => (pending[f] !== undefined ? pending[f] : fs.readFileSync(f, 'utf8'));
const report = [];
for (const p of PATCHES) {
  if (!fs.existsSync(p.file)) fail(`Cannot find ${p.file}.`);
  let text = read(p.file);
  if (text.includes(p.marker)) { report.push(`already done  ${p.file}: ${p.marker}`); pending[p.file] = text; continue; }
  const n = countOf(text, p.anchor);
  if (n !== 1) {
    fail(`In ${p.file} I expected the line below exactly once but found it ${n} time(s):\n    ${p.anchor}\n` +
         'The file has changed since this installer was written. Send me that file and I will adjust it.');
  }
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  let replacement;
  if (p.where === 'after') replacement = p.anchor + nl + p.insert;
  else {
    // keep the new line aligned with the line it sits above
    const idx = text.indexOf(p.anchor);
    const lineStart = text.lastIndexOf('\n', idx) + 1;
    const indent = text.slice(lineStart, idx);
    replacement = p.insert + nl + nl + indent + p.anchor;
  }
  pending[p.file] = text.replace(p.anchor, () => replacement);
  report.push(`will patch    ${p.file}: ${p.insert}`);
}

// ---- Phase 2: everything checked out, so write.
for (const [rel, content] of Object.entries(FILES)) {
  fs.mkdirSync(path.dirname(rel), { recursive: true });
  fs.writeFileSync(rel, content, 'utf8');
  console.log('wrote         ' + rel);
}
for (const [file, text] of Object.entries(pending)) fs.writeFileSync(file, text, 'utf8');
report.forEach((l) => console.log(l));

if (process.argv.includes('--no-git')) { console.log('\nDone (git skipped).'); process.exit(0); }
try {
  execSync('git add .', { stdio: 'inherit' });
  execSync('git commit -m "Add Flock Performance: laying rate, early warning, feed per egg"', { stdio: 'inherit' });
  execSync('git push', { stdio: 'inherit' });
  console.log('\nDone. Wait for Render and Vercel to finish deploying, then hard-refresh the app.');
} catch (e) {
  console.error('\nThe files were installed, but git did not finish. Run: git status');
  process.exit(1);
}
