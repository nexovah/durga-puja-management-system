// Real login — same 2-arg login() RPC the web app uses (see
// supabase/036_login_rate_limiting.sql), same tenant-JWT-in-header scoping.
// No dummy/mock auth anywhere: a wrong password fails for real, a session
// persists across app restarts via AsyncStorage, exactly like the web app's
// localStorage session.
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, setTenantAccessToken } from './supabase';

export interface User {
  id: string;
  name: string;
  username: string;
  isAdmin: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  isActive: boolean;
  tenantId: string;
  accessToken: string;
  subscriptionExpiresAt: string | null;
}

const SESSION_KEY = 'puja-mobile-session';

function fromUserRow(row: any): User {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    isAdmin: row.is_admin,
    canEdit: row.can_edit !== false,
    canDelete: row.can_delete !== false,
    canBulkImport: row.can_bulk_import !== false,
    isActive: row.is_active !== false,
    tenantId: row.tenant_id,
    accessToken: row.access_token,
    subscriptionExpiresAt: row.subscription_expires_at,
  };
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (raw) {
          const stored: User = JSON.parse(raw);
          setTenantAccessToken(stored.accessToken);
          setUser(stored);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const { data, error } = await supabase.rpc('login', { p_username: username, p_password: password });
      if (error) return { ok: false, error: error.message };
      if (!data || data.length === 0) return { ok: false, error: 'Invalid username or password.' };
      const loggedInUser = fromUserRow(data[0]);
      setTenantAccessToken(loggedInUser.accessToken);
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Something went wrong. Check your connection.' };
    }
  };

  const logout = async () => {
    setTenantAccessToken(null);
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
