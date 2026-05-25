import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

console.log('[Backend] Configured API base URL:', API_BASE_URL);

/** Ping backend root on app start (expects e.g. "Hello world" from GET /). */
export async function verifyBackendConnection(): Promise<boolean> {
  const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  console.log(divider);
  console.log('[Backend] Checking connection…');
  console.log('[Backend] Target:', API_BASE_URL);

  try {
    const response = await axios.get(API_BASE_URL, {
      timeout: 10000,
      validateStatus: () => true,
    });
    const body =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

    console.log('[Backend] ✅ CONNECTED');
    console.log('[Backend] HTTP status:', response.status);
    console.log('[Backend] Response body:', body);
    console.log(divider);
    return true;
  } catch (error) {
    const err = error as AxiosError;
    console.log('[Backend] ❌ NOT CONNECTED');
    console.log('[Backend] Error:', err.message);
    if (err.code) console.log('[Backend] Code:', err.code);
    console.log('[Backend] Tip: backend must listen on 0.0.0.0, same Wi‑Fi, firewall open');
    console.log(divider);
    return false;
  }
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const fullUrl = `${config.baseURL ?? API_BASE_URL}${config.url ?? ''}`;
  console.log('🚀 API Request:', {
    method: config.method?.toUpperCase(),
    fullUrl,
    baseURL: config.baseURL,
    path: config.url,
    hasAuth: Boolean(config.headers.Authorization),
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

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        await AsyncStorage.setItem('accessToken', data.accessToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
