import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import TableSkeleton from '../components/TableSkeleton';

const CAN_RECORD = ['Administrator', 'Manager', 'Flock Operator'];

const FeedBatches = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [settings, setSettings] = useState(null);
  const [totalKg, setTotalKg] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [b, s] = await Promise.all([api.get('/feed-batches'), api.get('/settings')]);
      setBatches(b.data);
      setSettings(s.data);
    } catch (err) {
      toast.error('Failed to load feed batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const costPerKg = settings?.compoundedFeedCostPerKg ?? 0;
  const kgPreview = Number(totalKg) || 0;
  const costPreview = kgPreview * costPerKg;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/feed-batches', { totalKg, notes });
      toast.success('Compounded feed logged');
      setTotalKg('');
      setNotes('');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log compounded feed');
    }
  };

  const remove = async (batch) => {
    if (!window.confirm('Delete this entry? Finished-feed stock will be reduced back.')) return;
    try {
      await api.delete(`/feed-batches/${batch._id}`);
      toast.success('Deleted, stock reduced back');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Compounded Feed</h1>
        {CAN_RECORD.includes(user?.role) && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Log Compounded Feed'}
          </button>
        )}
      </div>

      <p className="text-xs text-neutral-500 -mt-2">
        Enter the total kg of finished (already-mixed) feed — not individual ingredients. Cost is
        calculated at the flat rate set in Settings ({costPerKg}/kg), since the birds are fed the
        whole compounded mix at once, not one raw ingredient at a time.
      </p>

      {showForm && (
        <form onSubmit={submit} className="app-card space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              type="number"
              step="0.01"
              placeholder="Total compounded feed (kg)"
              className="input-field"
              value={totalKg}
              onChange={(e) => setTotalKg(e.target.value)}
            />
            <input placeholder="Notes (optional)" className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-accent-50 dark:bg-accent-500/10 px-4 py-3 text-sm">
            <span>Cost preview</span>
            <span className="font-semibold">
              {kgPreview.toFixed(2)}kg × {costPerKg}/kg = {costPreview.toFixed(2)} total cost
            </span>
          </div>
          <button type="submit" className="btn-primary">Log Compounded Feed</button>
        </form>
      )}

      <div className="table-wrap">
        {loading ? (
          <TableSkeleton columns={5} />
        ) : batches.length === 0 ? (
          <EmptyState message="No compounded feed logged yet." />
        ) : (
          <table>
            <thead>
              <tr><th>Date</th><th>Total kg</th><th>Cost/kg</th><th>Total Cost</th><th>Logged By</th><th></th></tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b._id}>
                  <td>{new Date(b.date).toLocaleDateString()}</td>
                  <td>{b.totalKg.toFixed(2)}kg</td>
                  <td>{b.costPerKg.toFixed(2)}</td>
                  <td>{b.totalCost.toFixed(2)}</td>
                  <td>{b.producedBy?.name || '—'}</td>
                  <td>
                    {user?.role === 'Administrator' && (
                      <button className="text-red-600 text-xs font-semibold" onClick={() => remove(b)}>Delete</button>
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

export default FeedBatches;