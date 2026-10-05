import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import TableSkeleton from '../components/TableSkeleton';
import { useAuth } from '../context/AuthContext';

const CAN_LOG = ['Administrator', 'Manager', 'Flock Operator'];
const todayStr = () => new Date().toISOString().slice(0, 10);

const TYPE_STYLES = {
  vaccination: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  treatment: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  disease: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  mortality: 'bg-red-900 text-white dark:bg-red-900 dark:text-red-100',
  other: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
};

const TypeBadge = ({ type }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${TYPE_STYLES[type] || TYPE_STYLES.other}`}>
    {type}
  </span>
);

const emptyForm = {
  date: todayStr(),
  recordType: 'vaccination',
  birdType: 'all',
  quantityAffected: '',
  title: '',
  medication: '',
  dosage: '',
  note: '',
};

const HealthLogPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const canLog = CAN_LOG.includes(user?.role);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/health-logs');
      setLogs(res.data);
    } catch (err) {
      toast.error('Failed to load health log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/health-logs', form);
      toast.success('Health record saved');
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save health record');
    }
  };

  const remove = async (log) => {
    if (!window.confirm('Move this record to Trash?')) return;
    try {
      await api.delete(`/health-logs/${log._id}`);
      toast.success('Moved to Trash');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Health &amp; Mortality</h1>
        {canLog && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Record'}
          </button>
        )}
      </div>

      <p className="text-xs text-neutral-500 -mt-2">
        This is a cause-and-treatment diary — vaccines given, disease suspected, treatment applied,
        or a death's likely cause. It does not itself change your live flock counts; use the Flock
        page's Adjust form (died/culled) for that, same as before — this just records *why*.
      </p>

      {showForm && (
        <form onSubmit={submit} className="app-card grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input required type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <select className="input-field" value={form.recordType} onChange={(e) => setForm({ ...form, recordType: e.target.value })}>
            <option value="vaccination">Vaccination</option>
            <option value="treatment">Treatment</option>
            <option value="disease">Disease / outbreak</option>
            <option value="mortality">Mortality (cause)</option>
            <option value="other">Other</option>
          </select>
          <select className="input-field" value={form.birdType} onChange={(e) => setForm({ ...form, birdType: e.target.value })}>
            <option value="all">All birds</option>
            <option value="layer">Layers</option>
            <option value="rooster">Roosters</option>
            <option value="chick">Chicks</option>
          </select>
          <input
            type="number"
            placeholder="Quantity affected (optional)"
            className="input-field"
            value={form.quantityAffected}
            onChange={(e) => setForm({ ...form, quantityAffected: e.target.value })}
          />
          <input
            required
            placeholder="Title (e.g. Newcastle Disease vaccine, Coccidiosis outbreak)"
            className="input-field sm:col-span-2"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            placeholder="Medication / vaccine name (optional)"
            className="input-field"
            value={form.medication}
            onChange={(e) => setForm({ ...form, medication: e.target.value })}
          />
          <input
            placeholder="Dosage (optional)"
            className="input-field"
            value={form.dosage}
            onChange={(e) => setForm({ ...form, dosage: e.target.value })}
          />
          <input
            placeholder="Note (optional)"
            className="input-field sm:col-span-2"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <button type="submit" className="btn-primary sm:col-span-2">Save Record</button>
        </form>
      )}

      <div className="table-wrap responsive-cards">
        {loading ? (
          <TableSkeleton columns={6} />
        ) : logs.length === 0 ? (
          <EmptyState message="No health records yet." />
        ) : (
          <table>
            <thead>
              <tr><th>Date</th><th>Type</th><th>Bird</th><th>Qty</th><th>Title</th><th>Medication / Dosage</th><th></th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td data-label="Date">{new Date(l.date).toLocaleDateString()}</td>
                  <td data-label="Type"><TypeBadge type={l.recordType} /></td>
                  <td data-label="Bird" className="capitalize">{l.birdType}</td>
                  <td data-label="Qty">{l.quantityAffected ?? '—'}</td>
                  <td data-label="Title">{l.title}</td>
                  <td data-label="Medication" className="text-neutral-500">
                    {l.medication || '—'}{l.dosage ? ` (${l.dosage})` : ''}
                  </td>
                  <td data-label="">
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

export default HealthLogPage;
