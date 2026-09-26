import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  LayoutDashboard,
  Wheat,
  PackagePlus,
  Egg,
  ClipboardList,
  Bird,
  ShoppingCart,
  Utensils,
  Recycle,
  FileBarChart,
  Settings as SettingsIcon,
  Users as UsersIcon,
  ScrollText,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', roles: null, Icon: LayoutDashboard },
  { to: '/feed-ingredients', label: 'Feed Ingredients', roles: null, Icon: Wheat },
  { to: '/feed-batches', label: 'Feed Batches', roles: null, Icon: PackagePlus },
  { to: '/feeding-log', label: 'Daily Feeding', roles: null, Icon: Utensils },
  { to: '/egg-log', label: 'Egg Log', roles: null, Icon: Egg },
  { to: '/daily-egg-stock', label: 'Daily Egg Stock', roles: null, Icon: ClipboardList },
  { to: '/manure-log', label: 'Manure / Waste', roles: null, Icon: Recycle },
  { to: '/flock', label: 'Flock', roles: null, Icon: Bird },
  { to: '/bird-sales', label: 'Bird Sales', roles: null, Icon: ShoppingCart },
  { to: '/reports', label: 'Reports', roles: null, Icon: FileBarChart },
  { to: '/settings', label: 'Settings', roles: null, Icon: SettingsIcon },
  { to: '/users', label: 'User Management', roles: ['Administrator'], Icon: UsersIcon },
  { to: '/audit-log', label: 'Audit Log', roles: ['Administrator'], Icon: ScrollText },
  { to: '/trash', label: 'Trash', roles: ['Administrator'], Icon: Trash2 },
];

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role));

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>
      <aside
        className={`fixed z-20 inset-y-0 left-0 w-64 border-r transform transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold text-lg text-accent-600">Poultry Pro</div>
          <div className="text-xs text-neutral-500">Layers &amp; Roosters Management</div>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 90px)' }}>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-500'
                    : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`
              }
            >
              <item.Icon size={17} strokeWidth={2} className="shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col lg:pl-0">
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <button className="lg:hidden btn-secondary" onClick={() => setOpen(!open)}>
            Menu
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <button
              className="btn-secondary px-2"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <span className="text-sm text-neutral-500">
              Welcome, <span className="font-semibold" style={{ color: 'var(--text)' }}>{user?.name}</span>
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-500">
              {user?.role}
            </span>
            <button className="btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
};

export default Layout;