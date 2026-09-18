import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import FeedIngredients from './pages/FeedIngredients';
import FeedBatches from './pages/FeedBatches';
import EggLog from './pages/EggLog';
import DailyEggStock from './pages/DailyEggStock';
import Flock from './pages/Flock';
import BirdSales from './pages/BirdSales';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import AuditLog from './pages/AuditLog';
import Trash from './pages/Trash';

const withLayout = (el) => <ProtectedRoute>{<Layout>{el}</Layout>}</ProtectedRoute>;

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={withLayout(<Dashboard />)} />
      <Route path="/feed-ingredients" element={withLayout(<FeedIngredients />)} />
      <Route path="/feed-batches" element={withLayout(<FeedBatches />)} />
      <Route path="/egg-log" element={withLayout(<EggLog />)} />
      <Route path="/daily-egg-stock" element={withLayout(<DailyEggStock />)} />
      <Route path="/flock" element={withLayout(<Flock />)} />
      <Route path="/bird-sales" element={withLayout(<BirdSales />)} />
      <Route path="/reports" element={withLayout(<Reports />)} />
      <Route path="/settings" element={withLayout(<Settings />)} />
      <Route
        path="/users"
        element={
          <ProtectedRoute roles={['Administrator']}>
            <Layout>
              <Users />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-log"
        element={
          <ProtectedRoute roles={['Administrator']}>
            <Layout>
              <AuditLog />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/trash"
        element={
          <ProtectedRoute roles={['Administrator']}>
            <Layout>
              <Trash />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
