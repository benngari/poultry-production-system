import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';

const ROLES = ['Manager', 'Flock Operator', 'Store Keeper'];

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Flock Operator' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      toast.success(res.data.message);
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex force-light" style={{ backgroundColor: '#f7f7f5' }}>
      <div className="hidden lg:flex lg:w-1/2 bg-accent-600 text-white flex-col justify-center px-16">
        <div className="text-3xl font-bold mb-3">Poultry Pro</div>
        <p className="text-accent-50 max-w-sm">
          New accounts need Administrator approval before they can log in — you'll be notified once yours is active.
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm app-card">
          <h1 className="page-title mb-1">Create account</h1>
          <p className="text-sm text-neutral-500 mb-6">The first account ever created becomes Administrator automatically.</p>

          <label className="text-sm font-medium mb-1 block">Full name</label>
          <input
            required
            className="input-field mb-4"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <label className="text-sm font-medium mb-1 block">Email</label>
          <input
            type="email"
            required
            className="input-field mb-4"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <label className="text-sm font-medium mb-1 block">Password</label>
          <input
            type="password"
            required
            minLength={6}
            className="input-field mb-4"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <label className="text-sm font-medium mb-1 block">Role</label>
          <select
            className="input-field mb-6"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <button type="submit" disabled={loading} className="btn-primary w-full mb-4">
            {loading ? 'Creating…' : 'Register'}
          </button>

          <p className="text-sm text-center text-neutral-500">
            Already have an account? <Link to="/login" className="text-accent-600 font-semibold">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
