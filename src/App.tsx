import React, { Component } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '@/hooks/useAuth';
import Login from '@/pages/Login';
import AdminLayout from '@/components/AdminLayout';
import MobileLayout from '@/components/MobileLayout';
import Dashboard from '@/pages/admin/Dashboard';
import MerchantConfig from '@/pages/admin/MerchantConfig';
import OrderList from '@/pages/admin/OrderList';
import Allocation from '@/pages/admin/Allocation';
import Settlement from '@/pages/admin/Settlement';
import Receipt from '@/pages/admin/Receipt';
import Products from '@/pages/admin/Products';
import MobileHome from '@/pages/mobile/Home';
import MobileTasks from '@/pages/mobile/Tasks';
import MobileTaskDetail from '@/pages/mobile/TaskDetail';
import MobileManage from '@/pages/mobile/Manage';
import MobileMerchants from '@/pages/mobile/Merchants';
import MobileProducts from '@/pages/mobile/Products';
import MerchantBill from '@/pages/bill/MerchantBill';

function getAuthedHomePath() {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile|micromessenger/.test(ua)
    || window.matchMedia('(max-width: 900px)').matches;
  return isMobile ? '/mobile' : '/admin';
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace' }}>
          <h1 style={{ color: 'red' }}>渲染错误</h1>
          <pre style={{ background: '#f5f5f5', padding: 16, overflow: 'auto' }}>{this.state.error}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();
  const authedHomePath = getAuthedHomePath();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  }

  return (
    <Routes>
      <Route path="/bill/:merchantId" element={<MerchantBill />} />
      <Route path="/login" element={user ? <Navigate to={authedHomePath} replace /> : <Login onLogin={login} />} />
      <Route path="/admin/*" element={
        user ? (
          <AdminLayout user={user} onLogout={() => { logout(); navigate('/login'); }}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="merchants" element={<MerchantConfig />} />
              <Route path="products" element={<Products />} />
              <Route path="orders" element={<OrderList />} />
              <Route path="allocation" element={<Allocation />} />
              <Route path="settlement" element={<Settlement />} />
              <Route path="receipt" element={<Receipt />} />
            </Routes>
          </AdminLayout>
        ) : <Navigate to="/login" replace />
      } />
      <Route path="/mobile/*" element={
        user ? (
          <MobileLayout>
            <Routes>
              <Route index element={<MobileHome />} />
              <Route path="tasks" element={<MobileTasks />} />
              <Route path="tasks/:id" element={<MobileTaskDetail />} />
              <Route path="manage" element={<MobileManage user={user} onLogout={() => { logout(); navigate('/login'); }} />} />
              <Route path="manage/merchants" element={<MobileMerchants />} />
              <Route path="manage/products" element={<MobileProducts />} />
            </Routes>
          </MobileLayout>
        ) : <Navigate to="/login" replace />
      } />
      <Route path="/" element={<Navigate to={user ? authedHomePath : '/login'} replace />} />
      <Route path="*" element={<Navigate to={user ? authedHomePath : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
