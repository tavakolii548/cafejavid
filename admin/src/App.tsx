import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { loadSession } from './api';
import { CustomersPage } from './pages/CustomersPage';
import { DiscountCodesPage } from './pages/DiscountCodesPage';
import { LoginPage } from './pages/LoginPage';
import { MenuPage } from './pages/MenuPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OrdersPage } from './pages/OrdersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

function Private({ children, owner = false }: { children: ReactNode; owner?: boolean }) {
  const session = loadSession();
  if (!session) return <Navigate to="/login" replace />;
  if (owner && session.role !== 'OWNER') return <Navigate to="/" replace />;
  return <Shell>{children}</Shell>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Private><OrdersPage /></Private>} />
      <Route path="/menu" element={<Private><MenuPage /></Private>} />
      <Route path="/reports" element={<Private owner><ReportsPage /></Private>} />
      <Route path="/customers" element={<Private owner><CustomersPage /></Private>} />
      <Route path="/discount-codes" element={<Private owner><DiscountCodesPage /></Private>} />
      <Route path="/notifications" element={<Private owner><NotificationsPage /></Private>} />
      <Route path="/settings" element={<Private owner><SettingsPage /></Private>} />
    </Routes>
  );
}
