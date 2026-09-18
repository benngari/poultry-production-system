import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import EmptyState from '../components/EmptyState';

const ROLES = ['Administrator', 'Manager', 'Flock Operator', 'Store Keeper'];

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activate = async (u) => {
    await api.put(`/users/${u._id}/activate`);
    toast.success(`${u.name} activated`);
    load();
  };
  const deactivate = async (u) => {
    if (!window.confirm(`Deactivate ${u.name}?`)) return;
    await api.put(`/users/${u._id}/deactivate`);
    toast.success(`${u.name} deactivated`);
    load();
  };
  const changeRole = async (u, role) => {
    await api.put(`/users/${u._id}/role`, { role });
    toast.success('Role updated');
    load();
  };
  const resetPassword = async (u) => {
    const newPassword = window.prompt(`New password for ${u.name} (min 6 chars):`);
    if (!newPassword) return;
    try {
      await api.put(`/users/${u._id}/reset-password`, { newPassword });
      toast.success('Password reset');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="page-title">User Management</h1>
      <div className="table-wrap">
        {loading ? (
          <div className="p-6 text-sm text-neutral-500">Loading…</div>
        ) : users.length === 0 ? (
          <EmptyState />
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Online</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td className="font-medium">{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select className="input-field" value={u.role} onChange={(e) => changeRole(u, e.target.value)}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>{u.isActive ? <span className="text-accent-600 font-semibold">Active</span> : <span className="text-amber-600 font-semibold">Pending</span>}</td>
                  <td>{u.online ? <span className="text-accent-600">● Online</span> : <span className="text-neutral-400">Offline</span>}</td>
                  <td className="whitespace-nowrap space-x-3">
                    {!u.isActive && <button className="text-accent-600 text-xs font-semibold" onClick={() => activate(u)}>Activate</button>}
                    {u.isActive && <button className="text-amber-600 text-xs font-semibold" onClick={() => deactivate(u)}>Deactivate</button>}
                    <button className="text-neutral-500 text-xs font-semibold" onClick={() => resetPassword(u)}>Reset PW</button>
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

export default Users;
