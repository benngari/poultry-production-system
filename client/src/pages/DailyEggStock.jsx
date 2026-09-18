import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';

const CAN_EDIT = ['Administrator', 'Manager', 'Store Keeper'];
const todayStr = () => new Date().toISOString().slice(0, 10);

const DailyEggStock = () => {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [row, setRow] = useState(null);
  const [closing, setClosing] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (d) => {
    setLoading(true);
    try {
      const res = await api.get(`/daily-egg-stock/${d}`);
      setRow(res.data);
      setClosing(res.data.closingStock);
    } catch (err) {
      toast.error('Failed to load daily stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(date); }, [date]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/daily-egg-stock/${date}`, { closingStock: closing });
      setRow(res.data);
      toast.success('Reconciliation saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Daily Egg Stock</h1>
        <input type="date" className="input-field w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {loading || !row ? (
        <div className="text-sm text-neutral-500">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Opening Stock" value={row.openingStock} />
            <StatCard label="Added (Collected)" value={row.addedStock} />
            <StatCard label="Closing Stock" value={row.closingStock} />
            <StatCard label="Sold" value={row.soldQuantity} />
            <StatCard label="Revenue" value={row.revenue.toFixed(2)} />
          </div>

          {CAN_EDIT.includes(user?.role) && (
            <form onSubmit={submit} className="app-card grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-sm font-medium mb-1 block">Closing stock (eggs remaining)</label>
                <input required type="number" min="0" className="input-field" value={closing} onChange={(e) => setClosing(e.target.value)} />
              </div>
              <div className="text-sm text-neutral-500 sm:col-span-1">
                Unit price: {row.unitPrice} (from Settings, today's row auto-syncs)
              </div>
              <button type="submit" className="btn-primary">Save Reconciliation</button>
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default DailyEggStock;
