import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, appTrackingApi, notificationsApi } from '../api';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { setAuthExpiredHandler, refreshTokenRequest } from '../api/client';
import { useAlert } from './AlertContext';
import type { UserResponse } from '../types';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: UserResponse | null;
  accessToken: string | null;
  isNewUser: boolean;
  daysSinceLastLogin: number;
}

interface AuthContextValue extends AuthState {
  login: (accessToken: string, refreshToken: string, user: UserResponse, isNewUser?: boolean, daysSinceLastLogin?: number) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<UserResponse>) => void;
  checkAuth: () => Promise<void>;
  clearWelcomeBack: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showAlert } = useAlert();
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    accessToken: null,
    isNewUser: false,
    daysSinceLastLogin: 0,
  });

  // When the axios interceptor exhausts all token refresh attempts, reset auth state
  // and surface a friendly message so the user knows why they landed on Login.
  const handleAuthExpired = useCallback(() => {
    setState({ isLoading: false, isAuthenticated: false, user: null, accessToken: null, isNewUser: false, daysSinceLastLogin: 0 });
    showAlert(
      'Session Expired',
      'Your session has expired. Please sign in again.',
    );
  }, [showAlert]);

  useEffect(() => {
    setAuthExpiredHandler(handleAuthExpired);
    return () => setAuthExpiredHandler(() => {});
  }, [handleAuthExpired]);

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
        setState({ isLoading: false, isAuthenticated: true, user: storedUser, accessToken, isNewUser: false, daysSinceLastLogin: 0 });
        appTrackingApi.trackOpen().catch(() => {});
      } else if (refreshToken[1]) {
        // Use raw axios (not apiClient) so an expired refresh token at startup
        // is caught by the catch below — no interceptor loop, no false "Session
        // Expired" alert before the user has even opened the app.
        const { data } = await refreshTokenRequest(refreshToken[1]);
        await AsyncStorage.setItem('accessToken', data.accessToken);
        const { data: me } = await authApi.me();
        setState({ isLoading: false, isAuthenticated: true, user: storedUser || ({ id: me.userId, email: me.email } as UserResponse), accessToken: data.accessToken, isNewUser: false, daysSinceLastLogin: 0 });
        appTrackingApi.trackOpen().catch(() => {});
      } else {
        setState({ isLoading: false, isAuthenticated: false, user: null, accessToken: null, isNewUser: false, daysSinceLastLogin: 0 });
      }
    } catch {
      setState({ isLoading: false, isAuthenticated: false, user: null, accessToken: null, isNewUser: false, daysSinceLastLogin: 0 });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (accessToken: string, refreshToken: string, user: UserResponse, isNewUser = false, daysSinceLastLogin = 0) => {
    await AsyncStorage.multiSet([
      ['accessToken', accessToken],
      ['refreshToken', refreshToken],
      ['user', JSON.stringify(user)],
    ]);
    setState({ isLoading: false, isAuthenticated: true, user, accessToken, isNewUser, daysSinceLastLogin });
    appTrackingApi.trackOpen().catch(() => {});
    if (Device.isDevice) {
      (async () => {
        try {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status === 'granted') {
            const tokenData = await Notifications.getExpoPushTokenAsync();
            notificationsApi.registerDevice(tokenData.data).catch(() => {});
          }
        } catch {}
      })();
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    await AsyncStorage.clear();
    setState({ isLoading: false, isAuthenticated: false, user: null, accessToken: null, isNewUser: false, daysSinceLastLogin: 0 });
  }, []);

  const clearWelcomeBack = useCallback(() => {
    setState((prev) => ({ ...prev, isNewUser: false, daysSinceLastLogin: 0 }));
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
    <AuthContext.Provider value={{ ...state, login, logout, updateUser, checkAuth, clearWelcomeBack }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
