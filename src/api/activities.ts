import apiClient from './client';
import type { ActivityResponse, LogActivityDto, ActivityLogEntry } from '../types';

export const activitiesApi = {
  createCustom: (name: string, section: 'power' | 'craft') =>
    apiClient.post<ActivityResponse>('/activities/custom', { name, section }),

  logActivity: (dto: LogActivityDto) =>
    apiClient.put<{ success: boolean; message: string; activityLogId: string }>('/activities/log', dto),

  getLog: (date: string) =>
    apiClient.get<ActivityLogEntry[]>('/activities/log', { params: { date } }),
};
