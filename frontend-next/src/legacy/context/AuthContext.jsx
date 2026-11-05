import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../services/api.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'bloodline_access_token';
const USER_KEY = 'bloodline_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  });
  const [ready, setReady] = useState(false);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const acceptSession = useCallback((payload) => {
    sessionStorage.setItem(TOKEN_KEY, payload.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    setUser(payload.user);
    return payload.user;
  }, []);

  const login = useCallback(async (email, password) => acceptSession(await authApi.login({ email, password })), [acceptSession]);
  const register = useCallback(async (payload) => acceptSession(await authApi.register(payload)), [acceptSession]);
  const logout = useCallback(() => clearSession(), [clearSession]);

  useEffect(() => {
    const expire = () => clearSession();
    window.addEventListener('bloodline:session-expired', expire);
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) { setReady(true); return () => window.removeEventListener('bloodline:session-expired', expire); }
    authApi.me().then(({ user: current }) => {
      setUser(current);
      sessionStorage.setItem(USER_KEY, JSON.stringify(current));
    }).catch(clearSession).finally(() => setReady(true));
    return () => window.removeEventListener('bloodline:session-expired', expire);
  }, [clearSession]);

  const value = useMemo(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
