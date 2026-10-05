import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { AuthUser } from '../types/index.js';

const TOKEN_KEY = 'vessel_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  checkAuth: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthProvider() {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      return false;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!res.ok) {
        setStoredToken(null);
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return false;
      }

      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser({
          ...data.user,
          isDefaultPassword: !!data.isDefaultPassword,
        });
        setIsAuthenticated(true);
        setLoading(false);
        return true;
      } else {
        setStoredToken(null);
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return false;
      }
    } catch {
      // In case of network glitch, keep optimistic session if token exists
      setIsAuthenticated(true);
      setUser({ username: 'admin', isDefaultPassword: false });
      setLoading(false);
      return true;
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || '登录失败，请检查账号密码' };
      }

      setStoredToken(data.token);
      setToken(data.token);
      setUser({
        ...(data.user || { username }),
        isDefaultPassword: !!data.isDefaultPassword,
      });
      setIsAuthenticated(true);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '网络连接异常，无法连接控制台' };
    }
  };

  const logout = async () => {
    try {
      const currentToken = getStoredToken();
      if (currentToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        }).catch(() => {});
      }
    } finally {
      setStoredToken(null);
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const currentToken = getStoredToken();
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || '密码修改失败' };
      }

      if (data.token) {
        setStoredToken(data.token);
        setToken(data.token);
      }

      setUser((prev) => (prev ? { ...prev, isDefaultPassword: false } : null));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '网络连接异常' };
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    loading,
    login,
    logout,
    changePassword,
    checkAuth,
  };
}
