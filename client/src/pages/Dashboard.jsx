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

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [range, setRange] = useState('week');
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadSummary(), loadWeekly(range)]);
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
  const allTimeProfitTone = summary.allTime.expectedProfit >= 0 ? 'positive' : 'negative';

  return (
    <div className="space-y-6">
      <h1 className="page-title">Dashboard</h1>

      {/* Row 1 — Today's stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Eggs Collected Today" value={summary.today.eggsCollected} />
        <StatCard label="Feed Consumed Today (kg)" value={summary.today.feedConsumedKg.toFixed(2)} />
        <StatCard label="Revenue Today" value={money(summary.today.revenue, currency)} />
        <StatCard label="Profit Today" value={money(summary.today.profit, currency)} tone={profitTone} />
        <StatCard label="Birds Sold Today" value={summary.today.birdsSold} />
      </div>

      {/* Poultry Totals (All Time) */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-2">Poultry Totals (All Time)</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Eggs Collected" value={summary.allTime.totalEggsCollected} />
          <StatCard label="Total Feed Cost" value={money(summary.allTime.totalFeedCost, currency)} />
          <StatCard label="Total Revenue" value={money(summary.allTime.totalRevenue, currency)} />
          <StatCard label="Expected Profit" value={money(summary.allTime.expectedProfit, currency)} tone={allTimeProfitTone} />
          <StatCard label="Total Birds Sold" value={summary.allTime.totalBirdsSold} />
          <StatCard label="Current Flock Size" value={summary.allTime.currentFlockSize} />
        </div>
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
              <Bar dataKey="feedConsumedKg" name="Feed (kg)" fill="#a3a3f7" radius={[4, 4, 0, 0]} />
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
            summary.lowStockIngredients.map((ing) => (
              <div
                key={ing._id}
                className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2 mb-2"
              >
                ⚠ {ing.name}: {ing.stock}{ing.unit} (min {ing.minStock}{ing.unit})
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
