import apiClient from './client';
import type { AuthResponse, RefreshResponse, MeResponse } from '../types';

export const authApi = {
  requestOtp: (email: string) =>
    apiClient.post('/auth/otp/request', { email }),

  verifyOtp: (email: string, otp: string) =>
    apiClient.post<AuthResponse>('/auth/otp/verify', { email, otp }),

  googleLogin: (idToken: string) =>
    apiClient.post<AuthResponse>('/auth/google', { idToken }),

  refresh: (refreshToken: string) =>
    apiClient.post<RefreshResponse>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    apiClient.post('/auth/logout', { refreshToken }),

  me: () =>
    apiClient.get<MeResponse>('/auth/me'),
};
