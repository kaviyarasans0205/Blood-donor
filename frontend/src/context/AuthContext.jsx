import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api, { setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('bb_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.data.user);
      setProfile(res.data.data.profile);
    } catch {
      localStorage.removeItem('bb_token');
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
    setUnauthorizedHandler(() => {
      localStorage.removeItem('bb_token');
      setUser(null);
    });
  }, [loadMe]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('bb_token', res.data.data.token);
    setUser(res.data.data.user);
    await loadMe();
    return res.data.data.user;
  }, [loadMe]);

  const register = useCallback(async (payload) => {
    const res = await api.post('/auth/register', payload);
    localStorage.setItem('bb_token', res.data.data.token);
    setUser(res.data.data.user);
    await loadMe();
    return res.data.data.user;
  }, [loadMe]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    localStorage.removeItem('bb_token');
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = loadMe;

  const value = useMemo(
    () => ({ user, profile, loading, login, register, logout, refreshProfile, isAuthenticated: Boolean(user) }),
    [user, profile, loading, login, register, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
