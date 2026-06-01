import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RefreshResponse } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

let authExpiredHandler: (() => void) | null = null;

export const setAuthExpiredHandler = (handler: () => void) => {
  authExpiredHandler = handler;
};

/**
 * Calls POST /auth/refresh using raw axios — intentionally bypasses the
 * apiClient interceptor to prevent infinite retry loops.
 * Use this wherever you need to refresh tokens (interceptor + startup check).
 */
export const refreshTokenRequest = (refreshToken: string) =>
  axios.post<RefreshResponse>(`${BASE_URL}/auth/refresh`, { refreshToken });

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('🚀 API Request:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    baseURL: config.baseURL,
    headers: config.headers,
    data: JSON.stringify(config.data, null, 2),
  });
  return config;
});

// Refresh token on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      data: JSON.stringify(response.data, null, 2),
    });
    return response;
  },
  async (error: AxiosError) => {
    console.log('❌ API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      message: error.message,
      data: JSON.stringify(error.response?.data, null, 2),
    });
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await refreshTokenRequest(refreshToken);
        await AsyncStorage.setItem('accessToken', data.accessToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        authExpiredHandler?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * A lightweight client for fire-and-forget background calls (analytics, push registration, etc.).
 * Attaches the Bearer token but has NO auth-expiry interceptor, so a 401 here never triggers
 * "Session Expired" alerts or resets auth state.
 */
export const silentApiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

silentApiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
