import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';

const CAN_EDIT = ['Administrator', 'Manager', 'Store Keeper'];

const emptyForm = { name: '', unit: 'kg', stock: 0, minStock: 0, supplier: '', unitCost: 0 };

const FeedIngredients = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'purchase', quantity: '', note: '' });

  const canEdit = CAN_EDIT.includes(user?.role);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/feed-ingredients');
      setItems(res.data);
    } catch (err) {
      toast.error('Failed to load feed ingredients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/feed-ingredients', form);
      toast.success('Ingredient added');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add ingredient');
    }
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/feed-ingredients/${adjustTarget._id}/adjust`, adjustForm);
      toast.success('Stock updated');
      setAdjustTarget(null);
      setAdjustForm({ type: 'purchase', quantity: '', note: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update stock');
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Move "${item.name}" to Trash?`)) return;
    try {
      await api.delete(`/feed-ingredients/${item._id}`);
      toast.success('Moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Feed Ingredients</h1>
        {canEdit && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Ingredient'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="app-card grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input required placeholder="Name" className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="number" step="0.01" placeholder="Unit cost (per kg)" className="input-field" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
          <input required type="number" step="0.01" placeholder="Opening stock (kg)" className="input-field" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <input required type="number" step="0.01" placeholder="Min stock (kg)" className="input-field" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          <input placeholder="Supplier" className="input-field" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          <button type="submit" className="btn-primary">Save Ingredient</button>
        </form>
      )}

      {adjustTarget && (
        <form onSubmit={submitAdjust} className="app-card grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-4 font-semibold text-sm">Adjust stock — {adjustTarget.name}</div>
          <select className="input-field" value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}>
            <option value="purchase">Purchase (+)</option>
            <option value="usage">Usage (-)</option>
            <option value="adjustment">Adjustment (-)</option>
          </select>
          <input required type="number" step="0.01" placeholder="Quantity (kg)" className="input-field" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} />
          <input placeholder="Note" className="input-field" value={adjustForm.note} onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })} />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Apply</button>
            <button type="button" className="btn-secondary" onClick={() => setAdjustTarget(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        {loading ? (
          <div className="p-6 text-sm text-neutral-500">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState message="No feed ingredients recorded yet." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Stock</th><th>Min Stock</th><th>Unit Cost</th><th>Supplier</th><th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it._id}>
                  <td className="font-medium">{it.name}</td>
                  <td className={it.stock <= it.minStock ? 'text-red-600 font-semibold' : ''}>{it.stock}{it.unit}</td>
                  <td>{it.minStock}{it.unit}</td>
                  <td>{it.unitCost}</td>
                  <td>{it.supplier || '—'}</td>
                  <td className="whitespace-nowrap">
                    {canEdit && (
                      <button className="text-accent-600 text-xs font-semibold mr-3" onClick={() => setAdjustTarget(it)}>Adjust</button>
                    )}
                    {user?.role === 'Administrator' && (
                      <button className="text-red-600 text-xs font-semibold" onClick={() => remove(it)}>Delete</button>
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

export default FeedIngredients;
