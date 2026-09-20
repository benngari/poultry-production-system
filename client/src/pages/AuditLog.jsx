import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import TableSkeleton from '../components/TableSkeleton';

const ACTION_STYLES = {
  create: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  update: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  delete: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  permanent_delete: 'bg-red-900 text-white dark:bg-red-900 dark:text-red-100',
  restore: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
  role_change: 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  password_reset: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  activate: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  deactivate: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300',
  stock_adjust: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  login: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  logout: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
  register: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400',
};
const DEFAULT_ACTION_STYLE = 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';

const ActionBadge = ({ action }) => (
  <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ACTION_STYLES[action] || DEFAULT_ACTION_STYLE}`}>
    {action.replace('_', ' ')}
  </span>
);

const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/audit-logs')
      .then((res) => setLogs(res.data))
      .catch(() => toast.error('Failed to load audit log'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="page-title">Audit Log</h1>
      <div className="table-wrap">
        {loading ? (
          <TableSkeleton columns={5} />
        ) : logs.length === 0 ? (
          <EmptyState />
        ) : (
          <table>
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td className="whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</td>
                  <td>{l.userName}</td>
                  <td><ActionBadge action={l.action} /></td>
                  <td>{l.entityType}{l.entityLabel ? ` — ${l.entityLabel}` : ''}</td>
                  <td className="text-neutral-500">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AuditLogPage;