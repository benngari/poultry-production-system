import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import TableSkeleton from '../components/TableSkeleton';
import { useAuth } from '../context/AuthContext';

const CAN_LOG = ['Administrator', 'Manager', 'Flock Operator'];
const todayStr = () => new Date().toISOString().slice(0, 10);

const SOURCE_STYLES = {
  auto: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  manual: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
};

const SourceBadge = ({ source }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${SOURCE_STYLES[source]}`}>
    {source}
  </span>
);

const FeedingLogPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: todayStr(), quantityKg: '', note: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/feeding-logs');
      setLogs(res.data);
    } catch (err) {
      toast.error('Failed to load feeding log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      // Reuses the flock feed-deduction endpoint — it deducts current
      // FeedStock AND writes the FeedingLog entry in one call.
      await api.post('/flock/manual-feed-deduction', {
        quantityKg: form.quantityKg,
        note: form.note,
        date: form.date,
      });
      toast.success('Feed given logged');
      setForm({ date: todayStr(), quantityKg: '', note: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log feed given');
    }
  };

  const remove = async (log) => {
    if (!window.confirm('Move this entry to Trash?')) return;
    try {
      await api.delete(`/feeding-logs/${log._id}`);
      toast.success('Moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const todayTotal = logs
    .filter((l) => new Date(l.date).toISOString().slice(0, 10) === todayStr())
    .reduce((sum, l) => sum + l.quantityKg, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Daily Feeding</h1>
        <div className="stat-card !py-2 !px-4">
          <div className="stat-label">Fed Today</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{todayTotal.toFixed(2)}kg</div>
        </div>
      </div>

      <p className="text-xs text-neutral-500 -mt-2">
        Feed is deducted from finished-feed stock automatically every night based on live flock size
        (Settings → feed per bird). Use the form below only to log an extra feeding, a correction, or
        a day the automatic run needs backing up.
      </p>

      {CAN_LOG.includes(user?.role) && (
        <form onSubmit={submit} className="app-card grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input required type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input required type="number" step="0.01" placeholder="Quantity (kg)" className="input-field" value={form.quantityKg} onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} />
          <input placeholder="Note (optional)" className="input-field" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button type="submit" className="btn-primary">Log Feed Given</button>
        </form>
      )}

      <div className="table-wrap">
        {loading ? (
          <TableSkeleton columns={5} />
        ) : logs.length === 0 ? (
          <EmptyState message="No feeding entries yet." />
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Quantity</th><th>Source</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td>{new Date(l.date).toLocaleDateString()}</td>
                  <td>{l.quantityKg.toFixed(2)}kg</td>
                  <td><SourceBadge source={l.source} /></td>
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
    </div>
  );
};

export default FeedingLogPage;