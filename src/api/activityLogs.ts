import apiClient from './client';
import type { Last7DaysResponse, MonthlyActivityResponse } from '../types';

export const activityLogsApi = {
  getLast7Days: () =>
    apiClient.get<Last7DaysResponse>('/activity-logs/last-7-days', {
      params: { period: '7d' },
    }),

  getMonthly: (month?: string) =>
    apiClient.get<MonthlyActivityResponse>('/activity-logs/monthly', {
      params: month ? { month } : {},
    }),
};
