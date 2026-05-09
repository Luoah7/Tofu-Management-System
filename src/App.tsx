import React, { Component, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const Login = lazy(() => import('@/pages/Login'));
const AdminLayout = lazy(() => import('@/components/AdminLayout'));
const MobileLayout = lazy(() => import('@/components/MobileLayout'));
const Dashboard = lazy(() => import('@/pages/admin/Dashboard'));
const MerchantConfig = lazy(() => import('@/pages/admin/MerchantConfig'));
const OrderList = lazy(() => import('@/pages/admin/OrderList'));
const Allocation = lazy(() => import('@/pages/admin/Allocation'));
const Settlement = lazy(() => import('@/pages/admin/Settlement'));
const Receipt = lazy(() => import('@/pages/admin/Receipt'));
const Products = lazy(() => import('@/pages/admin/Products'));
const MobileHome = lazy(() => import('@/pages/mobile/Home'));
const MobileTasks = lazy(() => import('@/pages/mobile/Tasks'));
const MobileTaskDetail = lazy(() => import('@/pages/mobile/TaskDetail'));
const MobileManage = lazy(() => import('@/pages/mobile/Manage'));
const MobileMerchants = lazy(() => import('@/pages/mobile/Merchants'));
const MobileProducts = lazy(() => import('@/pages/mobile/Products'));
const MobileSettings = lazy(() => import('@/pages/mobile/Settings'));
const MerchantBill = lazy(() => import('@/pages/bill/MerchantBill'));

function FullscreenLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#17362d', fontWeight: 700 }}>
      加载中
    </div>
  );
}

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
    return <FullscreenLoading />;
  }

  return (
    <Suspense fallback={<FullscreenLoading />}>
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
                <Route path="manage/settings" element={<MobileSettings />} />
              </Routes>
            </MobileLayout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/" element={<Navigate to={user ? authedHomePath : '/login'} replace />} />
        <Route path="*" element={<Navigate to={user ? authedHomePath : '/login'} replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
