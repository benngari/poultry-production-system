import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import TableSkeleton from '../components/TableSkeleton';
import { useAuth } from '../context/AuthContext';

const CAN_LOG = ['Administrator', 'Manager', 'Flock Operator'];
const todayStr = () => new Date().toISOString().slice(0, 10);
const dateKey = (d) => new Date(d).toISOString().slice(0, 10);

const ManureLogPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [feedingLogs, setFeedingLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: todayStr(), quantityKg: '', note: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [manureRes, feedingRes] = await Promise.all([
        api.get('/manure-logs'),
        api.get('/feeding-logs'),
      ]);
      setLogs(manureRes.data);
      setFeedingLogs(feedingRes.data);
    } catch (err) {
      toast.error('Failed to load manure log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/manure-logs', form);
      toast.success('Manure entry logged');
      setForm({ date: todayStr(), quantityKg: '', note: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log manure');
    }
  };

  const remove = async (log) => {
    if (!window.confirm('Move this entry to Trash?')) return;
    try {
      await api.delete(`/manure-logs/${log._id}`);
      toast.success('Moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  // Feed vs manure, last 14 calendar days — joined client-side by date since
  // both logs are small collections for a farm this size.
  const comparisonRows = (() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(dateKey(d));
    }
    const feedByDay = {};
    feedingLogs.forEach((l) => {
      const k = dateKey(l.date);
      feedByDay[k] = (feedByDay[k] || 0) + l.quantityKg;
    });
    const manureByDay = {};
    logs.forEach((l) => {
      const k = dateKey(l.date);
      manureByDay[k] = (manureByDay[k] || 0) + l.quantityKg;
    });
    return days.map((day) => {
      const feed = feedByDay[day] || 0;
      const manure = manureByDay[day] || 0;
      return { day, feed, manure, ratio: feed > 0 ? manure / feed : null };
    });
  })();

  return (
    <div className="space-y-4">
      <h1 className="page-title">Manure / Waste Log</h1>

      {CAN_LOG.includes(user?.role) && (
        <form onSubmit={submit} className="app-card grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input required type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input required type="number" step="0.01" placeholder="Quantity (kg)" className="input-field" value={form.quantityKg} onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} />
          <input placeholder="Note (optional)" className="input-field" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button type="submit" className="btn-primary">Log Manure</button>
        </form>
      )}

      <div className="table-wrap">
        {loading ? (
          <TableSkeleton columns={4} />
        ) : logs.length === 0 ? (
          <EmptyState message="No manure entries yet." />
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Quantity</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td>{new Date(l.date).toLocaleDateString()}</td>
                  <td>{l.quantityKg.toFixed(2)}kg</td>
                  <td className="text-neutral-500">{l.note || '—'}</td>
                  <td>
                    {['Administrator', 'Manager'].includes(user?.role) && (
                      <button className="text-red-600 text-xs font-semibold" onClick={() => remove(l)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-2">
          Feed vs Manure — Last 14 Days
        </h2>
        <div className="table-wrap">
          {loading ? (
            <TableSkeleton columns={4} rows={14} />
          ) : (
            <table>
              <thead><tr><th>Date</th><th>Feed Given (kg)</th><th>Manure (kg)</th><th>Manure : Feed</th></tr></thead>
              <tbody>
                {comparisonRows.map((r) => (
                  <tr key={r.day}>
                    <td>{r.day}</td>
                    <td>{r.feed.toFixed(2)}</td>
                    <td>{r.manure.toFixed(2)}</td>
                    <td className="text-neutral-500">{r.ratio === null ? '—' : `${(r.ratio * 100).toFixed(0)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          A rising ratio over time can flag feed spillage, waste, or a health issue worth a closer look —
          it isn't a fixed target, since it depends on feed composition and moisture content.
        </p>
      </div>
    </div>
  );
};

export default ManureLogPage;