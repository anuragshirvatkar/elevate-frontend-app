import apiClient from './client';
import type { Last7DaysResponse } from '../types';

export const activityLogsApi = {
  getLast7Days: () =>
    apiClient.get<Last7DaysResponse>('/activity-logs/last-7-days'),
};
