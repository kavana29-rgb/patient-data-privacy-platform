import { useState, useEffect } from 'react';
import { AuthContext } from './authContextDef';
import { authApi } from '../services/api';

export { AuthContext };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function initializeAuth() {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        if (!isCancelled) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        const userData = await authApi.getMe();
        if (!isCancelled) {
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        }
      } catch (err) {
        console.warn('Session verification failed, logging out:', err.message);
        if (!isCancelled) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      isCancelled = true;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (email, password) => {
    const tokenResponse = await authApi.login({ email, password });
    localStorage.setItem('token', tokenResponse.access_token);
    setToken(tokenResponse.access_token);

    try {
      const fullUser = await authApi.getMe();
      setUser(fullUser);
      localStorage.setItem('user', JSON.stringify(fullUser));
      return fullUser;
    } catch {
      const fallbackUser = {
        id: tokenResponse.user_id,
        email: tokenResponse.email,
        full_name: tokenResponse.full_name,
        role: tokenResponse.role,
        is_active: true,
      };
      setUser(fallbackUser);
      localStorage.setItem('user', JSON.stringify(fallbackUser));
      return fallbackUser;
    }
  };

  const register = async (registrationData) => {
    const tokenResponse = await authApi.register(registrationData);
    localStorage.setItem('token', tokenResponse.access_token);
    setToken(tokenResponse.access_token);

    try {
      const fullUser = await authApi.getMe();
      setUser(fullUser);
      localStorage.setItem('user', JSON.stringify(fullUser));
      return fullUser;
    } catch {
      const fallbackUser = {
        id: tokenResponse.user_id,
        email: tokenResponse.email,
        full_name: tokenResponse.full_name,
        role: tokenResponse.role,
        is_active: true,
      };
      setUser(fallbackUser);
      localStorage.setItem('user', JSON.stringify(fallbackUser));
      return fallbackUser;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
