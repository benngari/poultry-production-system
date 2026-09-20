import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';
import TableSkeleton from '../components/TableSkeleton';

const SOURCES = [
  { key: 'egg-logs', label: 'Egg Collection' },
  { key: 'feed-batches', label: 'Feed Batches' },
  { key: 'bird-sales', label: 'Bird Sales' },
];

const Reports = () => {
  const [source, setSource] = useState('egg-logs');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/${source}`)
      .then((res) => setRows(res.data))
      .catch(() => toast.error('Failed to load report data'))
      .finally(() => setLoading(false));
  }, [source]);

  const exportCsv = () => {
    if (rows.length === 0) return;
    const keys = Object.keys(rows[0]).filter((k) => !['_id', '__v', 'isDeleted', 'deletedAt', 'deletedBy'].includes(k));
    const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${source}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Reports</h1>
        <div className="flex gap-2 items-center">
          <select className="input-field w-auto" value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button className="btn-secondary" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <TableSkeleton columns={5} />
        ) : rows.length === 0 ? (
          <EmptyState message="No data for this report yet." />
        ) : (
          <table>
            <thead>
              <tr>
                {Object.keys(rows[0]).filter((k) => !['_id', '__v', 'isDeleted', 'deletedAt', 'deletedBy', 'ingredientsUsed'].includes(k)).map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  {Object.keys(r).filter((k) => !['_id', '__v', 'isDeleted', 'deletedAt', 'deletedBy', 'ingredientsUsed'].includes(k)).map((k) => (
                    <td key={k}>{typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]) : String(r[k] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Reports;