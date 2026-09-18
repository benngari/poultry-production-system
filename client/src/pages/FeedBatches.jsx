import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';

const CAN_RECORD = ['Administrator', 'Manager', 'Flock Operator'];

const FeedBatches = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [lines, setLines] = useState([{ ingredientId: '', quantityKg: '' }]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [b, i] = await Promise.all([api.get('/feed-batches'), api.get('/feed-ingredients')]);
      setBatches(b.data);
      setIngredients(i.data);
    } catch (err) {
      toast.error('Failed to load feed batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const costPreview = lines.reduce((sum, l) => {
    const ing = ingredients.find((i) => i._id === l.ingredientId);
    const qty = Number(l.quantityKg) || 0;
    return sum + (ing ? qty * ing.unitCost : 0);
  }, 0);
  const kgPreview = lines.reduce((sum, l) => sum + (Number(l.quantityKg) || 0), 0);

  const updateLine = (idx, field, value) => {
    const next = [...lines];
    next[idx] = { ...next[idx], [field]: value };
    setLines(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/feed-batches', { items: lines.filter((l) => l.ingredientId && l.quantityKg), notes });
      toast.success('Feed batch recorded');
      setLines([{ ingredientId: '', quantityKg: '' }]);
      setNotes('');
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record batch');
    }
  };

  const remove = async (batch) => {
    if (!window.confirm('Delete this batch and restore ingredient stock?')) return;
    try {
      await api.delete(`/feed-batches/${batch._id}`);
      toast.success('Batch deleted, stock restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Feed Batches</h1>
        {CAN_RECORD.includes(user?.role) && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Mix New Batch'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="app-card space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                required
                className="input-field sm:col-span-2"
                value={line.ingredientId}
                onChange={(e) => updateLine(idx, 'ingredientId', e.target.value)}
              >
                <option value="">Select ingredient…</option>
                {ingredients.map((ing) => (
                  <option key={ing._id} value={ing._id}>{ing.name} — {ing.stock}{ing.unit} available @ {ing.unitCost}</option>
                ))}
              </select>
              <input
                required
                type="number"
                step="0.01"
                placeholder="Quantity (kg)"
                className="input-field"
                value={line.quantityKg}
                onChange={(e) => updateLine(idx, 'quantityKg', e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                disabled={lines.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={() => setLines([...lines, { ingredientId: '', quantityKg: '' }])}>
            + Add ingredient line
          </button>
          <input placeholder="Notes (optional)" className="input-field" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex items-center justify-between rounded-lg bg-accent-50 dark:bg-accent-500/10 px-4 py-3 text-sm">
            <span>Live cost preview</span>
            <span className="font-semibold">
              {kgPreview.toFixed(2)}kg total • {kgPreview > 0 ? (costPreview / kgPreview).toFixed(2) : '0.00'} per kg • {costPreview.toFixed(2)} total cost
            </span>
          </div>
          <button type="submit" className="btn-primary">Record Batch</button>
        </form>
      )}

      <div className="table-wrap">
        {loading ? (
          <div className="p-6 text-sm text-neutral-500">Loading…</div>
        ) : batches.length === 0 ? (
          <EmptyState message="No feed batches recorded yet." />
        ) : (
          <table>
            <thead>
              <tr><th>Date</th><th>Total kg</th><th>Cost/kg</th><th>Total Cost</th><th>Produced By</th><th></th></tr>
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
