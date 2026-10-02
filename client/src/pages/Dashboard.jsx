import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import DashboardSkeleton from '../components/DashboardSkeleton';

const RANGES = [
  { key: 'week', label: 'Weekly' },
  { key: '2weeks', label: '2 Weeks' },
  { key: '30days', label: 'Last 30 Days' },
];

const money = (n, currency) => `${currency} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const ALERTS_PER_PAGE = 10;

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [feedManure, setFeedManure] = useState([]);
  const [range, setRange] = useState('week');
  const [loading, setLoading] = useState(true);
  const [alertPage, setAlertPage] = useState(0);
  const [feedCostBasis, setFeedCostBasis] = useState('consumed'); // 'consumed' | 'produced'

  const loadSummary = async () => {
    try {
      const res = await api.get('/dashboard/summary');
      setSummary(res.data);
    } catch (err) {
      toast.error('Failed to load dashboard summary');
    }
  };

  const loadWeekly = async (r) => {
    try {
      const res = await api.get(`/dashboard/weekly?range=${r}`);
      setWeekly(res.data);
    } catch (err) {
      toast.error('Failed to load chart data');
    }
  };

  const dateKey = (d) => new Date(d).toISOString().slice(0, 10);

  const loadFeedManure = async () => {
    try {
      const [feedingRes, manureRes] = await Promise.all([
        api.get('/feeding-logs'),
        api.get('/manure-logs'),
      ]);

      const feedByDay = {};
      feedingRes.data.forEach((l) => {
        const k = dateKey(l.date);
        feedByDay[k] = (feedByDay[k] || 0) + l.quantityKg;
      });
      const manureByDay = {};
      manureRes.data.forEach((l) => {
        const k = dateKey(l.date);
        manureByDay[k] = (manureByDay[k] || 0) + l.quantityKg;
      });

      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = dateKey(d);
        days.push({
          date: key,
          feedKg: feedByDay[key] || 0,
          manureKg: manureByDay[key] || 0,
        });
      }
      setFeedManure(days);
    } catch (err) {
      toast.error('Failed to load feed vs manure data');
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadSummary(), loadWeekly(range), loadFeedManure()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadWeekly(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  if (loading || !summary) return <DashboardSkeleton />;

  const currency = summary.settings?.currency || 'KSh';
  const profitTone = summary.today.profit >= 0 ? 'positive' : 'negative';

  const totalFeedCost = feedCostBasis === 'consumed' ? summary.allTime.totalFeedCostConsumed : summary.allTime.totalFeedCostProduced;
  const expectedProfit = feedCostBasis === 'consumed' ? summary.allTime.expectedProfitConsumed : summary.allTime.expectedProfitProduced;
  const allTimeProfitTone = expectedProfit >= 0 ? 'positive' : 'negative';

  const totalAlertPages = Math.ceil(summary.lowStockIngredients.length / ALERTS_PER_PAGE) || 1;
  const currentAlertPage = Math.min(alertPage, totalAlertPages - 1);
  const pagedAlerts = summary.lowStockIngredients.slice(
    currentAlertPage * ALERTS_PER_PAGE,
    currentAlertPage * ALERTS_PER_PAGE + ALERTS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <h1 className="page-title">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Eggs Collected Today" value={summary.today.eggsCollected} />
        <StatCard label="Feed Consumed Today (kg)" value={summary.today.feedConsumedKg.toFixed(2)} />
        <StatCard
          label="Feed In Store (kg)"
          value={summary.feedStock.stockKg.toFixed(2)}
          tone={summary.feedStock.stockKg <= summary.feedStock.minStockKg ? 'negative' : undefined}
        />
        <StatCard label="Revenue Today" value={money(summary.today.revenue, currency)} />
        <StatCard label="Profit Today" value={money(summary.today.profit, currency)} tone={profitTone} />
        <StatCard label="Birds Sold Today" value={summary.today.birdsSold} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Poultry Totals (All Time)</h2>
          <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setFeedCostBasis('consumed')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                feedCostBasis === 'consumed' ? 'bg-accent-600 text-white' : 'text-neutral-500'
              }`}
            >
              By Feed Consumed
            </button>
            <button
              onClick={() => setFeedCostBasis('produced')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                feedCostBasis === 'produced' ? 'bg-accent-600 text-white' : 'text-neutral-500'
              }`}
            >
              By Feed Purchased
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Eggs Collected" value={summary.allTime.totalEggsCollected} />
          <StatCard label="Total Feed Cost" value={money(totalFeedCost, currency)} />
          <StatCard label="Total Revenue" value={money(summary.allTime.totalRevenue, currency)} />
          <StatCard label="Expected Profit" value={money(expectedProfit, currency)} tone={allTimeProfitTone} />
          <StatCard label="Total Birds Sold" value={summary.allTime.totalBirdsSold} />
          <StatCard label="Current Flock Size" value={summary.allTime.currentFlockSize} />
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          "By Feed Consumed" costs only the feed actually fed out so far ({summary.allTime.totalFeedConsumedKg.toFixed(2)}kg).
          "By Feed Purchased" costs every kg ever added to the store, including feed still sitting unused.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="app-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Weekly Production</h2>
            <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--border)' }}>
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold ${
                    range === r.key ? 'bg-accent-600 text-white' : 'text-neutral-500'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="feedConsumedKg" name="Feed Consumed (kg)" fill="#a3a3f7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="eggsCollected" name="Eggs" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="app-card">
          <h2 className="font-semibold mb-4">Low Stock Alerts</h2>
          {summary.feedStock.stockKg <= summary.feedStock.minStockKg && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2 mb-2">
              ⚠ Finished feed stock low: {summary.feedStock.stockKg.toFixed(1)}kg (min {summary.feedStock.minStockKg}kg)
            </div>
          )}
          {summary.lowStockIngredients.length === 0 && summary.feedStock.stockKg > summary.feedStock.minStockKg ? (
            <div className="flex items-center gap-2 text-sm text-accent-700 bg-accent-50 dark:bg-accent-500/10 rounded-lg px-3 py-2">
              ✅ All stock levels are adequate.
            </div>
          ) : (
            <>
              {pagedAlerts.map((ing) => (
                <div
                  key={ing._id}
                  className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2 mb-2"
                >
                  ⚠ {ing.name}: {ing.stock}{ing.unit} (min {ing.minStock}{ing.unit})
                </div>
              ))}
              {totalAlertPages > 1 && (
                <div className="flex items-center justify-between pt-1 text-xs text-neutral-500">
                  <button
                    className="btn-secondary px-2 py-1 disabled:opacity-40"
                    disabled={currentAlertPage === 0}
                    onClick={() => setAlertPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </button>
                  <span>Page {currentAlertPage + 1} of {totalAlertPages}</span>
                  <button
                    className="btn-secondary px-2 py-1 disabled:opacity-40"
                    disabled={currentAlertPage >= totalAlertPages - 1}
                    onClick={() => setAlertPage((p) => Math.min(totalAlertPages - 1, p + 1))}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="app-card">
        <h2 className="font-semibold mb-4">Feed vs Manure — Last 7 Days</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={feedManure}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="feedKg" name="Feed Given (kg)" fill="#a3a3f7" radius={[4, 4, 0, 0]} />
            <Bar dataKey="manureKg" name="Manure (kg)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-neutral-500 mt-2">
          A rising manure-to-feed ratio over time can flag spillage, waste, or a health issue worth a
          closer look — full daily breakdown and totals are on the Manure / Waste page.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;