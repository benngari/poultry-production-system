import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import TableSkeleton from '../components/TableSkeleton';

const CAN_RECORD = ['Administrator', 'Manager', 'Store Keeper'];

const BirdSales = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ birdType: 'layer', quantity: '', pricePerUnit: '', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bird-sales');
      setSales(res.data);
    } catch (err) {
      toast.error('Failed to load bird sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bird-sales', form);
      toast.success('Sale recorded');
      setForm({ birdType: 'layer', quantity: '', pricePerUnit: '', notes: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record sale');
    }
  };

  const remove = async (sale) => {
    if (!window.confirm('Move this sale to Trash?')) return;
    try {
      await api.delete(`/bird-sales/${sale._id}`);
      toast.success('Moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="page-title">Bird Sales</h1>

      {CAN_RECORD.includes(user?.role) && (
        <form onSubmit={submit} className="app-card grid grid-cols-1 sm:grid-cols-5 gap-3">
          <select className="input-field" value={form.birdType} onChange={(e) => setForm({ ...form, birdType: e.target.value })}>
            <option value="layer">Layer</option>
            <option value="rooster">Rooster</option>
            <option value="chick">Chick</option>
          </select>
          <input required type="number" placeholder="Quantity" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input required type="number" step="0.01" placeholder="Price per unit" className="input-field" value={form.pricePerUnit} onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })} />
          <input placeholder="Notes" className="input-field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" className="btn-primary">Record Sale</button>
        </form>
      )}

      <div className="table-wrap">
        {loading ? (
          <TableSkeleton columns={6} />
        ) : sales.length === 0 ? (
          <EmptyState message="No bird sales recorded yet." />
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Price/Unit</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s._id}>
                  <td>{new Date(s.date).toLocaleDateString()}</td>
                  <td className="capitalize">{s.birdType}</td>
                  <td>{s.quantity}</td>
                  <td>{s.pricePerUnit}</td>
                  <td>{s.totalPrice}</td>
                  <td>
                    {user?.role === 'Administrator' && (
                      <button className="text-red-600 text-xs font-semibold" onClick={() => remove(s)}>Delete</button>
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

export default BirdSales;