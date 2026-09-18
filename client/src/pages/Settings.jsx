import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const CAN_EDIT = ['Administrator', 'Manager'];

const Settings = () => {
  const { user } = useAuth();
  const [form, setForm] = useState(null);

  const load = async () => {
    try {
      const res = await api.get('/settings');
      setForm(res.data);
    } catch (err) {
      toast.error('Failed to load settings');
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put('/settings', form);
      setForm(res.data);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    }
  };

  if (!form) return <div className="text-sm text-neutral-500">Loading…</div>;

  const canEdit = CAN_EDIT.includes(user?.role);
  const field = (key, label, type = 'text', step) => (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <input
        type={type}
        step={step}
        disabled={!canEdit}
        className="input-field"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="page-title">Settings</h1>
      <form onSubmit={submit} className="app-card grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('companyName', 'Company name')}
        {field('currency', 'Currency symbol')}
        {field('address', 'Address')}
        {field('phone', 'Phone')}
        {field('email', 'Email')}
        {field('eggSellingPrice', 'Egg selling price', 'number', '0.01')}
        {field('dailyLabourCost', 'Daily labour cost', 'number', '0.01')}
        {field('hoursPerShift', 'Hours per shift', 'number', '0.5')}
        {field('feedPerLayerKgPerDay', 'Feed per layer (kg/day)', 'number', '0.001')}
        {field('feedPerRoosterKgPerDay', 'Feed per rooster (kg/day)', 'number', '0.001')}
        {field('feedLowStockThresholdKg', 'Feed low-stock threshold (kg)', 'number', '0.1')}
        {canEdit && (
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">Save Settings</button>
          </div>
        )}
      </form>
    </div>
  );
};

export default Settings;
