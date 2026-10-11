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
  HeartPulse,
  FileBarChart,
  Settings as SettingsIcon,
  Users as UsersIcon,
  ScrollText,
  Activity,
  Trash2,
  Menu as MenuIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getGreeting } from '../utils/greeting';
import WelcomeFlash from './WelcomeFlash';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', roles: null, Icon: LayoutDashboard },
  { to: '/feed-ingredients', label: 'Feed Ingredients', roles: null, Icon: Wheat },
  { to: '/feed-batches', label: 'Feed Batches', roles: null, Icon: PackagePlus },
  { to: '/feeding-log', label: 'Daily Feeding', roles: null, Icon: Utensils },
  { to: '/egg-log', label: 'Egg Log', roles: null, Icon: Egg },
  { to: '/daily-egg-stock', label: 'Daily Egg Stock', roles: null, Icon: ClipboardList },
  { to: '/manure-log', label: 'Manure / Waste', roles: null, Icon: Recycle },
  { to: '/health-log', label: 'Health & Mortality', roles: null, Icon: HeartPulse },
  { to: '/flock', label: 'Flock', roles: null, Icon: Bird },
  { to: '/bird-sales', label: 'Bird Sales', roles: null, Icon: ShoppingCart },
  { to: '/reports', label: 'Reports', roles: null, Icon: FileBarChart },
  { to: '/settings', label: 'Settings', roles: null, Icon: SettingsIcon },
  { to: '/users', label: 'User Management', roles: ['Administrator'], Icon: UsersIcon },
  { to: '/audit-log', label: 'Audit Log', roles: ['Administrator'], Icon: ScrollText },
  { to: '/user-activity', label: 'User Activity', roles: ['Administrator'], Icon: Activity },
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
      <WelcomeFlash />

      {/* Mobile only: tap outside the open drawer to close it. */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed z-30 inset-y-0 left-0 w-64 border-r flex flex-col transform transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="p-5 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold text-lg text-accent-600">Poultry Pro</div>
          <div className="text-xs text-neutral-500">Layers &amp; Roosters Management</div>
        </div>

        {/* Mobile only: the greeting and role that no longer fit in the slim top bar. */}
        <div className="lg:hidden shrink-0 px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs text-neutral-500">{getGreeting()},</div>
          <div className="font-semibold">{user?.name}</div>
          <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-500">
            {user?.role}
          </span>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto flex-1 min-h-0 lg:flex-none lg:max-h-[calc(100vh-90px)]">
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

      <div className="flex-1 flex flex-col lg:pl-0 min-w-0">
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {/* Mobile: hamburger + app name, one slim row. */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-label="Open menu"
              className="p-1 -ml-1 text-neutral-600 dark:text-neutral-300"
            >
              <MenuIcon size={26} />
            </button>
            <span className="font-bold text-lg text-accent-600">Poultry Pro</span>
          </div>

          <div className="flex items-center gap-4 lg:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="text-2xl leading-none"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button type="button" onClick={handleLogout} className="text-base font-semibold text-red-500">
              Logout
            </button>
          </div>

          {/* Desktop: unchanged — greeting, role badge, bordered buttons. */}
          <div className="hidden lg:block flex-1" />
          <div className="hidden lg:flex items-center gap-3">
            <button
              className="btn-secondary px-2"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <span className="text-sm text-neutral-500">
              Welcome, <span className="font-semibold" style={{ color: 'var(--text)' }}>{user?.name}</span> — {getGreeting()}
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
