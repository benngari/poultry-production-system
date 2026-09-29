import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import CardsSkeleton from '../components/CardsSkeleton';
import { useAuth } from '../context/AuthContext';

const CAN_EDIT = ['Administrator', 'Manager', 'Store Keeper'];
const todayStr = () => new Date().toISOString().slice(0, 10);

const DailyEggStock = () => {
  const { user } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [row, setRow] = useState(null);
  const [sold, setSold] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (d) => {
    setLoading(true);
    try {
      const res = await api.get(`/daily-egg-stock/${d}`);
      setRow(res.data);
      setSold(res.data.soldQuantity);
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
      const res = await api.put(`/daily-egg-stock/${date}`, { soldQuantity: sold });
      setRow(res.data);
      toast.success('Eggs sold saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const soldPreview = Number(sold) || 0;
  const revenuePreview = row ? soldPreview * row.unitPrice : 0;
  const availableToday = row ? row.openingStock + row.addedStock : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Daily Egg Stock</h1>
        <input type="date" className="input-field w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {loading || !row ? (
        <CardsSkeleton count={5} columns="sm:grid-cols-3 lg:grid-cols-5" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Opening Stock" value={row.openingStock} />
            <StatCard label="Added (Collected)" value={row.addedStock} />
            <StatCard label="Eggs Sold" value={row.soldQuantity} />
            <StatCard label="Closing Stock" value={row.closingStock} />
            <StatCard label="Revenue" value={row.revenue.toFixed(2)} />
          </div>

          {CAN_EDIT.includes(user?.role) && (
            <form onSubmit={submit} className="app-card grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-sm font-medium mb-1 block">Eggs sold today</label>
                <input
                  required
                  type="number"
                  min="0"
                  max={availableToday}
                  className="input-field"
                  value={sold}
                  onChange={(e) => setSold(e.target.value)}
                />
              </div>
              <div className="text-sm text-neutral-500 sm:col-span-1">
                {row.unitPrice}/egg × {soldPreview} = {revenuePreview.toFixed(2)} revenue
                <br />
                {availableToday} available (opening + collected)
              </div>
              <button type="submit" className="btn-primary">Save Eggs Sold</button>
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default DailyEggStock;