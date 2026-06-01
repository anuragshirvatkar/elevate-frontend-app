import apiClient, { silentApiClient } from './client';

export const notificationsApi = {
  registerDevice: (token: string) =>
    silentApiClient.post<{ message: string }>('/notifications/register-device', { expoPushToken: token }),
  test: () =>
    apiClient.post<{ message: string }>('/notifications/test'),
};
