import apiClient from './client';

export const helpApi = {
  trigger: () =>
    apiClient.post<{ success: boolean }>('/help/trigger'),
};
