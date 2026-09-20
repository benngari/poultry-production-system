import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import CardsSkeleton from '../components/CardsSkeleton';
import { useAuth } from '../context/AuthContext';

const CAN_ADJUST_COUNTS = ['Administrator', 'Manager'];
const CAN_MANUAL_FEED = ['Administrator', 'Manager', 'Flock Operator'];

const Flock = () => {
  const { user } = useAuth();
  const [flock, setFlock] = useState(null);
  const [feedStock, setFeedStock] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ birdType: 'layer', type: 'hatched', quantity: '', note: '' });
  const [feedForm, setFeedForm] = useState({ quantityKg: '', note: '' });

  const load = async () => {
    try {
      const [f, s] = await Promise.all([api.get('/flock'), api.get('/flock/feed-stock')]);
      setFlock(f.data);
      setFeedStock(s.data);
    } catch (err) {
      toast.error('Failed to load flock data');
    }
  };

  useEffect(() => { load(); }, []);

  const submitAdjust = async (e) => {
    e.preventDefault();
    try {
      await api.post('/flock/adjust', adjustForm);
      toast.success('Flock updated');
      setAdjustForm({ birdType: 'layer', type: 'hatched', quantity: '', note: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update flock');
    }
  };

  const submitFeed = async (e) => {
    e.preventDefault();
    try {
      await api.post('/flock/manual-feed-deduction', feedForm);
      toast.success('Feed deducted');
      setFeedForm({ quantityKg: '', note: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deduct feed');
    }
  };

  if (!flock || !feedStock) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Flock</h1>
        <CardsSkeleton count={4} columns="sm:grid-cols-4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-56 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-56 animate-pulse rounded-xl bg-neutral-200 dark:bg-neutral-700" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="page-title">Flock</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Layers" value={flock.liveLayerCount} />
        <StatCard label="Roosters" value={flock.liveRoosterCount} />
        <StatCard label="Chicks" value={flock.liveChickCount} />
        <StatCard label="Finished Feed Stock" value={`${feedStock.stockKg.toFixed(2)}kg`} tone={feedStock.stockKg <= feedStock.minStockKg ? 'negative' : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CAN_ADJUST_COUNTS.includes(user?.role) && (
          <form onSubmit={submitAdjust} className="app-card space-y-3">
            <h2 className="font-semibold">Adjust flock counts</h2>
            <select className="input-field" value={adjustForm.birdType} onChange={(e) => setAdjustForm({ ...adjustForm, birdType: e.target.value })}>
              <option value="layer">Layer</option>
              <option value="rooster">Rooster</option>
              <option value="chick">Chick</option>
            </select>
            <select className="input-field" value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}>
              <option value="hatched">Hatched (+)</option>
              <option value="purchased">Purchased (+)</option>
              <option value="died">Died (-)</option>
              <option value="culled">Culled (-)</option>
            </select>
            <input required type="number" placeholder="Quantity" className="input-field" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} />
            <input placeholder="Note (optional)" className="input-field" value={adjustForm.note} onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })} />
            <button type="submit" className="btn-primary">Apply</button>
            <p className="text-xs text-neutral-500">For sales, use the Bird Sales page instead — it updates counts automatically.</p>
          </form>
        )}

        {CAN_MANUAL_FEED.includes(user?.role) && (
          <form onSubmit={submitFeed} className="app-card space-y-3">
            <h2 className="font-semibold">Manual feed deduction</h2>
            <input required type="number" step="0.01" placeholder="Quantity (kg)" className="input-field" value={feedForm.quantityKg} onChange={(e) => setFeedForm({ ...feedForm, quantityKg: e.target.value })} />
            <input placeholder="Note (e.g. extra feeding, hot day)" className="input-field" value={feedForm.note} onChange={(e) => setFeedForm({ ...feedForm, note: e.target.value })} />
            <button type="submit" className="btn-primary">Deduct</button>
            <p className="text-xs text-neutral-500">Automatic daily deduction also runs at 00:05 based on live flock size.</p>
          </form>
        )}
      </div>
    </div>
  );
};

export default Flock;