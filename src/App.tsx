import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import OrderSectionDashboard from './pages/kitchen/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import StockManagerDashboard from './pages/StockManagerDashboard';
import QRMenu from './pages/customer/QRMenu';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#0a0a0f] text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
            <span className="text-3xl">!</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-8 max-w-xs">The application encountered an unexpected error.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm">
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;

  return <ErrorBoundary>{children}</ErrorBoundary>;
};

const RoleBasedHome = () => {
  const { user } = useAuth();

  switch (user?.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'kitchen':
      return <OrderSectionDashboard />;
    case 'stock_manager':
      return <StockManagerDashboard />;
    default:
      return <Navigate to="/login" />;
  }
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><RoleBasedHome /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute roles={['kitchen', 'admin']}><OrderSectionDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/stock" element={<ProtectedRoute roles={['stock_manager', 'admin']}><StockManagerDashboard /></ProtectedRoute>} />
          <Route path="/qr/table/:tableNumber" element={<QRMenu />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
