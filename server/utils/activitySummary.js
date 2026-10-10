// Pure function — no DB access — so it can be tested in isolation.
// Takes a user's audit-log entries (any order) and condenses them into
// the numbers the "User Activity" dashboard shows.

const dateStr = (d) => new Date(d).toISOString().slice(0, 10);

const summarizeLogs = (logs, days, now = new Date()) => {
  // Pre-fill every day in the window with 0 so quiet days show up as
  // gaps in the chart instead of silently disappearing.
  const byDay = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    byDay[dateStr(d)] = 0;
  }

  const byAction = {};
  const byEntity = {};

  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    byEntity[log.entityType] = (byEntity[log.entityType] || 0) + 1;
    const day = dateStr(log.timestamp);
    if (day in byDay) byDay[day] += 1;
  }

  const timestamps = logs.map((l) => new Date(l.timestamp).getTime());

  return {
    totalActions: logs.length,
    logins: byAction.login || 0,
    created: byAction.create || 0,
    updated: (byAction.update || 0) + (byAction.stock_adjust || 0),
    deleted: (byAction.delete || 0) + (byAction.permanent_delete || 0),
    activeDays: Object.values(byDay).filter((n) => n > 0).length,
    byAction,
    byEntity,
    byDay: Object.entries(byDay).map(([date, count]) => ({ date, count })),
    firstActivity: timestamps.length ? new Date(Math.min(...timestamps)) : null,
    lastActivity: timestamps.length ? new Date(Math.max(...timestamps)) : null,
  };
};

module.exports = { summarizeLogs };
