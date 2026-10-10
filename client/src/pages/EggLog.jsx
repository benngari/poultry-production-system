import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import TableSkeleton from '../components/TableSkeleton';

const CAN_LOG = ['Administrator', 'Manager', 'Flock Operator'];

const todayStr = () => new Date().toISOString().slice(0, 10);

// UTC date arithmetic so adding days never drifts across DST/timezone edges.
const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayLabel = (dateStr) =>
  new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });

const EggLogPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [form, setForm] = useState({ date: todayStr(), quantityCollected: '' });

  // Bulk mode: default window is the last 7 days ending today — the usual
  // "I was away, catch me up" case.
  const [weekStart, setWeekStart] = useState(addDays(todayStr(), -6));
  const [bulkValues, setBulkValues] = useState({});
  const [savingBulk, setSavingBulk] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Egg Log entries are additive (two entries for one day add together), so
  // flag days that already have eggs logged — otherwise a catch-up entry
  // would quietly double-count them.
  const loggedByDate = logs.reduce((acc, l) => {
    const key = new Date(l.date).toISOString().slice(0, 10);
    acc[key] = (acc[key] || 0) + l.quantityCollected;
    return acc;
  }, {});

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/egg-logs');
      setLogs(res.data);
    } catch (err) {
      toast.error('Failed to load egg logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/egg-logs', form);
      toast.success('Egg collection logged');
      setForm({ date: todayStr(), quantityCollected: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log');
    }
  };

  const submitBulk = async (e) => {
    e.preventDefault();
    const entries = weekDays
      .filter((d) => bulkValues[d] !== undefined && bulkValues[d] !== '')
      .map((d) => ({ date: d, quantityCollected: bulkValues[d] }));

    if (entries.length === 0) {
      toast.error('Enter a quantity for at least one day');
      return;
    }

    const overlapping = entries.filter((en) => loggedByDate[en.date] !== undefined);
    if (overlapping.length > 0) {
      const list = overlapping.map((en) => `${en.date} (already ${loggedByDate[en.date]})`).join(', ');
      const proceed = window.confirm(
        `These days already have eggs logged: ${list}.\n\nSaving ADDS to them rather than replacing them, so those days will be counted twice. Continue anyway?`
      );
      if (!proceed) return;
    }

    setSavingBulk(true);
    try {
      await api.post('/egg-logs/bulk', { entries });
      toast.success(`Saved ${entries.length} day${entries.length === 1 ? '' : 's'}`);
      setBulkValues({});
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save bulk entry');
    } finally {
      setSavingBulk(false);
    }
  };

  const changeWeekStart = (value) => {
    setWeekStart(value);
    setBulkValues({}); // different dates, so previously typed values no longer apply
  };

  const remove = async (log) => {
    if (!window.confirm('Move this entry to Trash?')) return;
    try {
      await api.delete(`/egg-logs/${log._id}`);
      toast.success('Moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const filledDays = weekDays.filter((d) => bulkValues[d] !== undefined && bulkValues[d] !== '');
  const bulkTotal = filledDays.reduce((sum, d) => sum + (Number(bulkValues[d]) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">Egg Log</h1>
        {CAN_LOG.includes(user?.role) && (
          <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setMode('single')}
              className={`px-3 py-1 rounded-md text-xs font-semibold ${
                mode === 'single' ? 'bg-accent-600 text-white' : 'text-neutral-500'
              }`}
            >
              Single Entry
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={`px-3 py-1 rounded-md text-xs font-semibold ${
                mode === 'bulk' ? 'bg-accent-600 text-white' : 'text-neutral-500'
              }`}
            >
              Bulk Entry (Week)
            </button>
          </div>
        )}
      </div>

      {CAN_LOG.includes(user?.role) && mode === 'single' && (
        <form onSubmit={submit} className="app-card grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input required type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input required type="number" placeholder="Eggs collected" className="input-field" value={form.quantityCollected} onChange={(e) => setForm({ ...form, quantityCollected: e.target.value })} />
          <button type="submit" className="btn-primary">Log Collection</button>
        </form>
      )}

      {CAN_LOG.includes(user?.role) && mode === 'bulk' && (
        <form onSubmit={submitBulk} className="app-card space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Week starting</label>
              <input
                type="date"
                className="input-field"
                value={weekStart}
                onChange={(e) => changeWeekStart(e.target.value)}
              />
            </div>
            <p className="text-xs text-neutral-500 pb-2">
              Fill in only the days you have numbers for — blank days are skipped.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {weekDays.map((d) => (
              <div key={d} className="flex items-center gap-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                <div className="w-24 shrink-0">
                  <div className="text-sm font-semibold">{weekdayLabel(d)}</div>
                  <div className="text-xs text-neutral-500">{d}</div>
                  {loggedByDate[d] !== undefined && (
                    <div className="text-xs font-semibold text-amber-600">Already logged: {loggedByDate[d]}</div>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="Eggs"
                  className="input-field"
                  value={bulkValues[d] ?? ''}
                  onChange={(e) => setBulkValues({ ...bulkValues, [d]: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-accent-50 dark:bg-accent-500/10 px-4 py-3 text-sm">
            <span>{filledDays.length} of 7 days filled</span>
            <span className="font-semibold">{bulkTotal} eggs total</span>
          </div>

          <button type="submit" className="btn-primary" disabled={savingBulk}>
            {savingBulk ? 'Saving…' : 'Save Week'}
          </button>
        </form>
      )}

      <div className="table-wrap responsive-cards">
        {loading ? (
          <TableSkeleton columns={3} />
        ) : logs.length === 0 ? (
          <EmptyState message="No egg collection entries yet." />
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Quantity Collected</th><th></th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td data-label="Date">{new Date(l.date).toLocaleDateString()}</td>
                  <td data-label="Quantity">{l.quantityCollected}</td>
                  <td data-label="">
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

export default EggLogPage;
