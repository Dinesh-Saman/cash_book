import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import AppLayout from './components/layout/AppLayout';

import LoginPage from './pages/LoginPage';
import CashBookPage from './pages/CashBookPage';
import MonthlyReportPage from './pages/MonthlyReportPage';
import AnnualReportPage from './pages/AnnualReportPage';
import SettingsPage from './pages/SettingsPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import AuditLogPage from './pages/admin/AuditLogPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
            borderRadius: '14px',
            fontSize: '13px',
            fontWeight: '600',
            maxWidth: '460px',
            whiteSpace: 'pre-line',
            lineHeight: '1.4',
          },
          success: {
            iconTheme: {
              primary: '#4f46e5',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#e11d48',
              secondary: '#ffffff',
            },
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<CashBookPage />} />
          <Route path="monthly" element={<MonthlyReportPage />} />
          <Route path="annual" element={<AnnualReportPage />} />
          <Route path="settings" element={<SettingsPage />} />

          <Route
            path="admin/users"
            element={
              <AdminRoute>
                <UserManagementPage />
              </AdminRoute>
            }
          />
          <Route
            path="admin/audit"
            element={
              <AdminRoute>
                <AuditLogPage />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
