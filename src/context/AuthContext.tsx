import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, appTrackingApi } from '../api';
import type { UserResponse } from '../types';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: UserResponse | null;
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  login: (accessToken: string, refreshToken: string, user: UserResponse) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<UserResponse>) => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    accessToken: null,
  });

  const checkAuth = useCallback(async () => {
    try {
      const [token, refreshToken, userJson] = await AsyncStorage.multiGet([
        'accessToken',
        'refreshToken',
        'user',
      ]);
      const accessToken = token[1];
      const storedUser = userJson[1] ? JSON.parse(userJson[1]) : null;

      if (accessToken && storedUser) {
        setState({ isLoading: false, isAuthenticated: true, user: storedUser, accessToken });
        appTrackingApi.trackOpen().catch(() => {});
      } else if (refreshToken[1]) {
        // Try to refresh
        const { data } = await authApi.refresh(refreshToken[1]);
        await AsyncStorage.setItem('accessToken', data.accessToken);
        const { data: me } = await authApi.me();
        setState({ isLoading: false, isAuthenticated: true, user: storedUser || ({ id: me.userId, email: me.email } as UserResponse), accessToken: data.accessToken });
        appTrackingApi.trackOpen().catch(() => {});
      } else {
        setState({ isLoading: false, isAuthenticated: false, user: null, accessToken: null });
      }
    } catch {
      setState({ isLoading: false, isAuthenticated: false, user: null, accessToken: null });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (accessToken: string, refreshToken: string, user: UserResponse) => {
    await AsyncStorage.multiSet([
      ['accessToken', accessToken],
      ['refreshToken', refreshToken],
      ['user', JSON.stringify(user)],
    ]);
    setState({ isLoading: false, isAuthenticated: true, user, accessToken });
    appTrackingApi.trackOpen().catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    setState({ isLoading: false, isAuthenticated: false, user: null, accessToken: null });
  }, []);

  const updateUser = useCallback((updates: Partial<UserResponse>) => {
    setState((prev) => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, ...updates };
      AsyncStorage.setItem('user', JSON.stringify(updated));
      return { ...prev, user: updated };
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
