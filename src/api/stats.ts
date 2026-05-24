import apiClient from './client';
import type { StatsResponse, StatsPeriod } from '../types';

export const statsApi = {
  get: (params?: { period?: StatsPeriod; startDate?: string; endDate?: string }) =>
    apiClient.get<StatsResponse>('/stats', { params }),
};
