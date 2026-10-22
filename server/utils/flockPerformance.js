// Pure calculations (no database) behind the "Flock Performance" card:
// laying rate, an early-warning check, and feed per egg.

const DAY_MS = 86400000;

// Early warning: compare the most recent days with the days just before them.
const RECENT_DAYS = 3;
const BASELINE_DAYS = 7;
const MIN_BASELINE_LOGGED_DAYS = 3;
const WATCH_DROP_POINTS = 10;
const ALERT_DROP_POINTS = 20;

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
const addDays = (key, n) => dayKey(Date.parse(`${key}T00:00:00.000Z`) + n * DAY_MS);
const round = (n, dp = 1) => { const f = 10 ** dp; return Math.round(n * f) / f; };

// How a flock-history entry changes the number of birds.
const txDelta = (t) => {
  if (t.type === 'hatched' || t.type === 'purchased') return t.quantity;
  if (t.type === 'sold' || t.type === 'died' || t.type === 'culled') return -t.quantity;
  return 0;
};

// Layers alive at the END of a day, worked backwards from today's count by
// undoing every layer change that happened after that day.
const layersAtEndOfDay = (currentLayers, transactions, key) => {
  const end = Date.parse(`${key}T23:59:59.999Z`);
  const after = transactions
    .filter((t) => t.birdType === 'layer' && new Date(t.date).getTime() > end)
    .reduce((sum, t) => sum + txDelta(t), 0);
  const layers = currentLayers - after;
  return layers > 0 ? layers : null; // negative/zero => history doesn't add up; don't guess
};

const buildDailyRows = ({ endDay, window, eggLogs, feedingLogs, currentLayers, transactions }) => {
  const eggs = {}; const logged = new Set(); const feed = {};
  eggLogs.forEach((l) => { const k = dayKey(l.date); eggs[k] = (eggs[k] || 0) + l.quantityCollected; logged.add(k); });
  feedingLogs.forEach((l) => { const k = dayKey(l.date); feed[k] = (feed[k] || 0) + l.quantityKg; });

  return Array.from({ length: window }, (_, i) => {
    const date = addDays(endDay, i - (window - 1));
    const layers = layersAtEndOfDay(currentLayers, transactions, date);
    const isLogged = logged.has(date); // an entry exists (even if it says 0 eggs)
    const eggCount = eggs[date] || 0;
    return {
      date,
      eggs: eggCount,
      logged: isLogged,
      feedKg: round(feed[date] || 0, 2),
      layers,
      // No entry that day = "not recorded", which is NOT the same as 0%.
      layingRate: isLogged && layers ? round((eggCount / layers) * 100, 1) : null,
    };
  });
};

// Rate over several days = total eggs / total layer-days, so a big flock day
// counts for more than a small one. Only days that were actually recorded.
const aggregateRate = (rows) => {
  const usable = rows.filter((r) => r.logged && r.layers);
  if (usable.length === 0) return null;
  const eggs = usable.reduce((s, r) => s + r.eggs, 0);
  const layerDays = usable.reduce((s, r) => s + r.layers, 0);
  return { rate: round((eggs / layerDays) * 100, 1), loggedDays: usable.length };
};

const feedPerEgg = (rows, { costPerKg, eggPrice }) => {
  const days = rows.filter((r) => r.logged); // only days where eggs were recorded
  const eggs = days.reduce((s, r) => s + r.eggs, 0);
  if (days.length === 0 || eggs === 0) return null;
  const feedKg = days.reduce((s, r) => s + r.feedKg, 0);
  const kgPerEgg = round(feedKg / eggs, 3);
  const feedCostPerEgg = round(kgPerEgg * costPerKg, 2);
  return {
    kgPerEgg,
    gramsPerEgg: Math.round(kgPerEgg * 1000),
    feedCostPerEgg,
    eggPrice,
    margin: round(eggPrice - feedCostPerEgg, 2),
    loggedDays: days.length,
    // Eggs recorded but no feed recorded that day would make feed per egg look better than it is.
    daysWithoutFeed: days.filter((r) => r.feedKg === 0).length,
  };
};

const buildFlockPerformance = ({ endDay, days, eggLogs, feedingLogs, currentLayers, transactions, costPerKg, eggPrice, currency }) => {
  const window = Math.max(days, 30);
  const rows = buildDailyRows({ endDay, window, eggLogs, feedingLogs, currentLayers, transactions });

  const recent = aggregateRate(rows.slice(-RECENT_DAYS));
  const baseline = aggregateRate(rows.slice(-(RECENT_DAYS + BASELINE_DAYS), -RECENT_DAYS));
  let status = 'unknown';
  let drop = null;
  if (recent && baseline && baseline.loggedDays >= MIN_BASELINE_LOGGED_DAYS) {
    drop = round(baseline.rate - recent.rate, 1);
    status = drop >= ALERT_DROP_POINTS ? 'alert' : drop >= WATCH_DROP_POINTS ? 'watch' : 'normal';
  }

  const latestRow = [...rows].reverse().find((r) => r.logged && r.layers);
  const costs = { costPerKg, eggPrice };

  return {
    asOf: endDay,
    currentLayers,
    series: rows.slice(-days),
    latest: latestRow ? { date: latestRow.date, eggs: latestRow.eggs, layers: latestRow.layers, rate: latestRow.layingRate } : null,
    avg7: aggregateRate(rows.slice(-7)),
    recent, baseline, drop, status,
    overHundred: rows.slice(-7).some((r) => r.layingRate !== null && r.layingRate > 100),
    fcr: { d7: feedPerEgg(rows.slice(-7), costs), d30: feedPerEgg(rows.slice(-30), costs) },
    thresholds: { watch: WATCH_DROP_POINTS, alert: ALERT_DROP_POINTS, recentDays: RECENT_DAYS, baselineDays: BASELINE_DAYS },
    currency,
  };
};

module.exports = { buildFlockPerformance, buildDailyRows, aggregateRate, feedPerEgg, layersAtEndOfDay, dayKey, addDays };
