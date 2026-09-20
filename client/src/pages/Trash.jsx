import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';

const TABS = [
  { key: 'feed-ingredients', label: 'Feed Ingredients' },
  { key: 'egg-logs', label: 'Egg Logs' },
  { key: 'bird-sales', label: 'Bird Sales' },
];

const Trash = () => {
  const [tab, setTab] = useState('feed-ingredients');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async (t) => {
    setLoading(true);
    try {
      const res = await api.get(`/${t}/trash/list`);
      setItems(res.data);
    } catch (err) {
      toast.error('Failed to load Trash');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab]);

  const restore = async (id) => {
    try {
      await api.post(`/${tab}/${id}/restore`);
      toast.success('Restored');
      load(tab);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore');
    }
  };

  const permanentDelete = async (id) => {
    if (tab !== 'feed-ingredients') {
      toast.error('Permanent delete is only available for Feed Ingredients');
      return;
    }
    if (!window.confirm('Permanently delete this item? This cannot be undone.')) return;
    try {
      await api.delete(`/${tab}/${id}/permanent`);
      toast.success('Permanently deleted');
      load(tab);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const label = (item) => item.name || `${item.quantity ?? ''} ${item.birdType ?? ''}`.trim() || new Date(item.date).toLocaleDateString();

  return (
    <div className="space-y-4">
      <h1 className="page-title">Trash</h1>
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === t.key ? 'bg-accent-600 text-white' : 'btn-secondary'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        {loading ? (
          <div className="p-6 text-sm text-neutral-500">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState message="Trash is empty." />
        ) : (
          <table>
            <thead><tr><th>Item</th><th>Deleted At</th><th></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{label(item)}</td>
                  <td>{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : '—'}</td>
                  <td className="whitespace-nowrap space-x-3">
                    <button
  className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-400"
  onClick={() => restore(item._id)}
>
  Restore
</button>
{tab === 'feed-ingredients' && (
  <button
    className="rounded-full bg-red-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-red-900 dark:text-red-100"
    onClick={() => permanentDelete(item._id)}
  >
    Delete Forever
  </button>
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

export default Trash;
