import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';

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
          <div className="p-6 text-sm text-neutral-500">Loading…</div>
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
                  <td className="capitalize">{l.action.replace('_', ' ')}</td>
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
