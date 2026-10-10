import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import CardsSkeleton from '../components/CardsSkeleton';
import TableSkeleton from '../components/TableSkeleton';
import EmptyState from '../components/EmptyState';

const RANGES = [
  { days: 7, label: 'Last 7 Days' },
  { days: 14, label: 'Last 14 Days' },
  { days: 30, label: 'Last 30 Days' },
];

// Same colour scheme as the Audit Log page, so an action looks the same
// wherever it appears.
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

const sortedEntries = (obj) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);

const BreakdownList = ({ title, entries, renderLabel }) => (
  <div className="app-card">
    <h2 className="font-semibold mb-3">{title}</h2>
    {entries.length === 0 ? (
      <p className="text-sm text-neutral-500">Nothing yet.</p>
    ) : (
      <ul className="space-y-2">
        {entries.map(([key, count]) => (
          <li key={key} className="flex items-center justify-between text-sm">
            <span>{renderLabel ? renderLabel(key) : key}</span>
            <span className="font-semibold">{count}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const UserActivity = () => {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState('');
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    api.get('/users')
      .then((res) => {
        setUsers(res.data);
        if (res.data.length > 0) setUserId(res.data[0]._id);
      })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    // Guard against a slow earlier response landing after the person has
    // already switched to a different user/range.
    let cancelled = false;
    setLoadingData(true);
    api.get(`/audit-logs/user-summary?userId=${userId}&days=${days}`)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) toast.error('Failed to load activity'); })
      .finally(() => { if (!cancelled) setLoadingData(false); });
    return () => { cancelled = true; };
  }, [userId, days]);

  const showSkeleton = loadingUsers || (loadingData && !data);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">User Activity</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input-field w-auto"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={loadingUsers}
          >
            {users.map((u) => (
              <option key={u._id} value={u._id}>{u.name} — {u.role}</option>
            ))}
          </select>
          <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--border)' }}>
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`px-3 py-1 rounded-md text-xs font-semibold ${
                  days === r.days ? 'bg-accent-600 text-white' : 'text-neutral-500'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showSkeleton && (
        <>
          <CardsSkeleton count={6} columns="sm:grid-cols-3 lg:grid-cols-6" />
          <div className="table-wrap"><TableSkeleton columns={4} /></div>
        </>
      )}

      {!showSkeleton && data && (
        <div className={loadingData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="space-y-4">
            <div className="app-card flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-lg">{data.user.name}</div>
                <div className="text-xs text-neutral-500">{data.user.email}</div>
              </div>
              <div className="text-xs text-neutral-500 sm:text-right">
                <div>Role: <span className="font-semibold">{data.user.role}</span> · {data.user.isActive ? 'Active' : 'Pending approval'}</div>
                <div>
                  Last login: {data.user.lastLoginAt ? new Date(data.user.lastLoginAt).toLocaleString() : 'never'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Total Actions" value={data.totalActions} />
              <StatCard label="Active Days" value={`${data.activeDays} of ${data.days}`} />
              <StatCard label="Logins" value={data.logins} />
              <StatCard label="Records Created" value={data.created} />
              <StatCard label="Records Updated" value={data.updated} />
              <StatCard label="Records Deleted" value={data.deleted} tone={data.deleted > 0 ? 'negative' : undefined} />
            </div>

            {data.truncated && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                This user has more activity than can be summarised at once — the figures below cover the most
                recent portion only. Try a shorter range for exact numbers.
              </div>
            )}

            {data.totalActions === 0 ? (
              <div className="app-card">
                <EmptyState message={`No activity recorded for ${data.user.name} in the last ${data.days} days.`} />
              </div>
            ) : (
              <>
                <div className="app-card">
                  <h2 className="font-semibold mb-4">Activity by day</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.byDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Actions" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <BreakdownList
                    title="What they did"
                    entries={sortedEntries(data.byAction)}
                    renderLabel={(action) => <ActionBadge action={action} />}
                  />
                  <BreakdownList
                    title="Where they did it"
                    entries={sortedEntries(data.byEntity)}
                  />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                    Recent activity
                  </h2>
                  <div className="table-wrap responsive-cards">
                    <table>
                      <thead>
                        <tr><th>Time</th><th>Action</th><th>Record</th><th>Details</th></tr>
                      </thead>
                      <tbody>
                        {data.recent.map((l, i) => (
                          <tr key={`${l.timestamp}-${i}`}>
                            <td data-label="Time" className="whitespace-nowrap">{new Date(l.timestamp).toLocaleString()}</td>
                            <td data-label="Action"><ActionBadge action={l.action} /></td>
                            <td data-label="Record">{l.entityType}{l.entityLabel ? ` — ${l.entityLabel}` : ''}</td>
                            <td data-label="Details" className="text-neutral-500">{l.details || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {data.totalActions > data.recent.length && (
                    <p className="text-xs text-neutral-500 mt-2">
                      Showing the {data.recent.length} most recent of {data.totalActions} actions.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserActivity;
