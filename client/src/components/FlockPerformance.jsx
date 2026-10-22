import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api/axios';

const STATUS = {
  normal: { label: 'Normal', cls: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' },
  watch: { label: 'Watch', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  alert: { label: 'Alert', cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
  unknown: { label: 'Not enough data yet', cls: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300' },
};

const statusMessage = (d) => {
  const t = d.thresholds;
  if (d.status === 'watch' || d.status === 'alert') {
    return `Laying rate fell ${d.drop} points — from ${d.baseline.rate}% (the ${t.baselineDays} days before) to ${d.recent.rate}% (the last ${t.recentDays} days). A drop like this can be an early sign of stress or illness: check feed, water, heat and the birds themselves.`;
  }
  if (d.status === 'normal') {
    const change = d.drop < 0 ? `up ${Math.abs(d.drop)} points` : `down ${d.drop} points`;
    return `Steady — ${d.recent.rate}% over the last ${t.recentDays} days, ${change} on the ${d.baseline.rate}% before.`;
  }
  return 'Log eggs every day — the early warning needs a few days of history to compare against.';
};

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

const Tile = ({ label, value, children }) => (
  <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className="stat-value">{value}</div>
    <div className="text-xs text-neutral-500 mt-1 space-y-0.5">{children}</div>
  </div>
);

const FlockPerformance = () => {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'error'

  useEffect(() => {
    let cancelled = false;
    api.get('/flock-performance', { params: { days: 14 } })
      .then((res) => { if (!cancelled) { setData(res.data); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading') {
    return <div data-testid="fp-loading" className="app-card h-64 animate-pulse" />;
  }
  if (state === 'error' || !data) {
    return (
      <div className="app-card text-sm text-neutral-500">
        Flock performance could not be loaded right now. The rest of the dashboard is unaffected.
      </div>
    );
  }

  const s = STATUS[data.status] || STATUS.unknown;
  const f7 = data.fcr.d7;
  const f30 = data.fcr.d30;
  const cur = data.currency;

  return (
    <section className="app-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Flock Performance</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
      </div>

      <p className={`text-sm ${data.status === 'alert' ? 'text-red-600' : data.status === 'watch' ? 'text-amber-600' : 'text-neutral-500'}`}>
        {statusMessage(data)}
      </p>
      {data.overHundred && (
        <p className="text-xs text-amber-600">
          A day in the last week shows more than 100% — the eggs entered or the layer count on the Flock page may be off.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile label="Laying rate — latest" value={pct(data.latest?.rate)}>
          {data.latest
            ? <p>{data.latest.date} · {data.latest.eggs} eggs from {data.latest.layers} layers</p>
            : <p>No egg entries yet</p>}
        </Tile>
        <Tile label="Laying rate — 7 days" value={pct(data.avg7?.rate)}>
          {data.avg7 ? <p>{data.avg7.loggedDays} of 7 days recorded</p> : <p>No recorded days</p>}
        </Tile>
        <Tile label="Feed per egg — 7 days" value={f7 ? `${f7.gramsPerEgg} g` : '—'}>
          {f7 ? (
            <>
              <p>{f7.kgPerEgg} kg per egg</p>
              <p>
                Feed cost {cur} {f7.feedCostPerEgg} per egg · price {cur} {f7.eggPrice}
                {' '}
                <span className={f7.margin < 0 ? 'font-semibold text-red-600' : 'font-semibold text-green-700 dark:text-green-400'}>
                  ({f7.margin < 0 ? 'losing' : 'leaves'} {cur} {Math.abs(f7.margin)})
                </span>
              </p>
              {f7.daysWithoutFeed > 0 && (
                <p className="text-amber-600">
                  {f7.daysWithoutFeed} recorded {f7.daysWithoutFeed === 1 ? 'day has' : 'days have'} no feed entered, so the real figure is probably higher.
                </p>
              )}
              {f30 && <p>30 days: {f30.gramsPerEgg} g per egg</p>}
            </>
          ) : <p>Needs recorded eggs and feed</p>}
        </Tile>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Daily laying rate — last 14 days</div>
        <div data-testid="fp-chart">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, (max) => Math.max(100, Math.ceil(max))]} unit="%" allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => (v === null || v === undefined ? 'not recorded' : `${v}%`)} />
              <Line type="monotone" dataKey="layingRate" name="Laying rate" stroke="#16a34a" strokeWidth={2} dot connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-neutral-500 mt-1">Days with no egg entry are left as gaps, not shown as 0%.</p>
      </div>
    </section>
  );
};

export default FlockPerformance;
