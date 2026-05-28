import apiClient from './client';

export const notificationsApi = {
  registerDevice: (token: string) =>
    apiClient.post<{ message: string }>('/notifications/register-device', { expoPushToken: token }),
  test: () =>
    apiClient.post<{ message: string }>('/notifications/test'),
};
