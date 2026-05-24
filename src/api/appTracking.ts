import apiClient from './client';

export const appTrackingApi = {
  trackOpen: () =>
    apiClient.post<{ success: boolean }>('/app-tracking/open'),
};
