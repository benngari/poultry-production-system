import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex force-light" style={{ backgroundColor: '#f7f7f5' }}>
      <div className="hidden lg:flex lg:w-1/2 bg-accent-600 text-white flex-col justify-center px-16">
        <div className="text-3xl font-bold mb-3">Poultry Pro</div>
        <p className="text-accent-50 max-w-sm">
          Feed costing, egg production, and flock management for layers and roosters — all in one dashboard.
        </p>
      </div>
      <div className="flex-1 flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm app-card">
          <h1 className="page-title mb-1">Sign in</h1>
          <p className="text-sm text-neutral-500 mb-6">Enter your credentials to continue</p>

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
            className="input-field mb-6"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button type="submit" disabled={loading} className="btn-primary w-full mb-4">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-sm text-center text-neutral-500">
            No account? <Link to="/register" className="text-accent-600 font-semibold">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
