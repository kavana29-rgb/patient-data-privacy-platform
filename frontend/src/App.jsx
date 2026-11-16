import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import RedactionPage from './redaction/RedactionPage';
import './App.css';

// Redirect authenticated users away from login/register
function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// Top-level root redirector
function RootRedirect() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

// 404 Fallback
function NotFound() {
  return (
    <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: '500px', margin: '0 auto', padding: '3rem 2rem' }}>
        <h1 style={{ fontSize: '3rem', margin: '0 0 1rem', color: 'var(--primary)' }}>404</h1>
        <h2>Page Not Found</h2>
        <p style={{ color: 'var(--text-muted)', margin: '1rem 0 2rem' }}>
          The requested page does not exist or you do not have permission to view it.
        </p>
        <a href="/dashboard" className="btn btn-primary">
          Return to Dashboard
        </a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <div className="app-shell">
              <Navbar />
              <main className="main-content">
                <Routes>
                  {/* Public Auth Routes */}
                  <Route
                    path="/login"
                    element={
                      <PublicOnlyRoute>
                        <Login />
                      </PublicOnlyRoute>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <PublicOnlyRoute>
                        <Register />
                      </PublicOnlyRoute>
                    }
                  />

                  {/* Protected Routes */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute allowedRoles={['patient']}>
                        <Profile />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/redaction"
                    element={
                      <ProtectedRoute allowedRoles={['patient']}>
                        <RedactionPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Default & Catch-all */}
                  <Route path="/" element={<RootRedirect />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <footer className="footer">
                <div className="container footer-content">
                  <p>
                    <strong>MyMedData</strong> &copy; {new Date().getFullYear()} &bull; Patient-Centric Medical Data Privacy Platform
                  </p>
                  <p className="footer-sub">
                    Cryptographic Integrity &bull; Granular Patient Consent &bull; Zero-Trust PII Redaction
                  </p>
                </div>
              </footer>
            </div>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
