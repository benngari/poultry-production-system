import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import TableSkeleton from '../components/TableSkeleton';

const CAN_LOG = ['Administrator', 'Manager', 'Flock Operator'];

const todayStr = () => new Date().toISOString().slice(0, 10);

const EggLogPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: todayStr(), quantityCollected: '' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/egg-logs');
      setLogs(res.data);
    } catch (err) {
      toast.error('Failed to load egg logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/egg-logs', form);
      toast.success('Egg collection logged');
      setForm({ date: todayStr(), quantityCollected: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log');
    }
  };

  const remove = async (log) => {
    if (!window.confirm('Move this entry to Trash?')) return;
    try {
      await api.delete(`/egg-logs/${log._id}`);
      toast.success('Moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="page-title">Egg Log</h1>

      {CAN_LOG.includes(user?.role) && (
        <form onSubmit={submit} className="app-card grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input required type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input required type="number" placeholder="Eggs collected" className="input-field" value={form.quantityCollected} onChange={(e) => setForm({ ...form, quantityCollected: e.target.value })} />
          <button type="submit" className="btn-primary">Log Collection</button>
        </form>
      )}

      <div className="table-wrap">
        {loading ? (
          <TableSkeleton columns={3} />
        ) : logs.length === 0 ? (
          <EmptyState message="No egg collection entries yet." />
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Quantity Collected</th><th></th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td>{new Date(l.date).toLocaleDateString()}</td>
                  <td>{l.quantityCollected}</td>
                  <td>
                    {['Administrator', 'Manager'].includes(user?.role) && (
                      <button className="text-red-600 text-xs font-semibold" onClick={() => remove(l)}>Delete</button>
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

export default EggLogPage;