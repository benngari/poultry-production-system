import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import TableSkeleton from '../components/TableSkeleton';

const CATEGORY_TABS = [
  { key: 'feed-ingredients', label: 'Feed Ingredients' },
  { key: 'egg-logs', label: 'Egg Logs' },
  { key: 'bird-sales', label: 'Bird Sales' },
  { key: 'feeding-logs', label: 'Feeding Log' },
  { key: 'manure-logs', label: 'Manure Log' },
];

const TABS = [{ key: 'all', label: 'All' }, ...CATEGORY_TABS];

const CATEGORY_LABEL = Object.fromEntries(CATEGORY_TABS.map((t) => [t.key, t.label]));

const Trash = () => {
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async (t) => {
    setLoading(true);
    try {
      if (t === 'all') {
        const results = await Promise.all(
          CATEGORY_TABS.map((cat) =>
            api.get(`/${cat.key}/trash/list`).then((res) => res.data.map((item) => ({ ...item, _category: cat.key })))
          )
        );
        const merged = results.flat().sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
        setItems(merged);
      } else {
        const res = await api.get(`/${t}/trash/list`);
        setItems(res.data.map((item) => ({ ...item, _category: t })));
      }
    } catch (err) {
      toast.error('Failed to load Trash');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab]);

  const restore = async (item) => {
    try {
      await api.post(`/${item._category}/${item._id}/restore`);
      toast.success('Restored');
      load(tab);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore');
    }
  };

  const permanentDelete = async (item) => {
    if (item._category !== 'feed-ingredients') {
      toast.error('Permanent delete is only available for Feed Ingredients');
      return;
    }
    if (!window.confirm('Permanently delete this item? This cannot be undone.')) return;
    try {
      await api.delete(`/${item._category}/${item._id}/permanent`);
      toast.success('Permanently deleted');
      load(tab);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const label = (item) =>
    item.name ||
    `${item.quantity ?? ''} ${item.birdType ?? ''}`.trim() ||
    (item.quantityKg !== undefined ? `${item.quantityKg}kg — ${new Date(item.date).toLocaleDateString()}` : '') ||
    new Date(item.date).toLocaleDateString();

  const showCategoryColumn = tab === 'all';

  return (
    <div className="space-y-4">
      <h1 className="page-title">Trash</h1>
      <div className="flex gap-2 flex-wrap">
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
      <div className="table-wrap responsive-cards">
        {loading ? (
          <TableSkeleton columns={showCategoryColumn ? 4 : 3} />
        ) : items.length === 0 ? (
          <EmptyState message="Trash is empty." />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Item</th>
                {showCategoryColumn && <th>Category</th>}
                <th>Deleted At</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item._category}-${item._id}`}>
                  <td data-label="Item">{label(item)}</td>
                  {showCategoryColumn && (
                    <td data-label="Category">{CATEGORY_LABEL[item._category]}</td>
                  )}
                  <td data-label="Deleted At">{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : '—'}</td>
                  <td data-label="" className="whitespace-nowrap space-x-3">
                    <button
                      className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-400"
                      onClick={() => restore(item)}
                    >
                      Restore
                    </button>
                    {item._category === 'feed-ingredients' && (
                      <button
                        className="rounded-full bg-red-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-red-900 dark:text-red-100"
                        onClick={() => permanentDelete(item)}
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