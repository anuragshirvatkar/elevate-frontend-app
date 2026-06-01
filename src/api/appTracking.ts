import { silentApiClient } from './client';

export const appTrackingApi = {
  trackOpen: () =>
    silentApiClient.post<{ success: boolean }>('/app-tracking/open'),
};
