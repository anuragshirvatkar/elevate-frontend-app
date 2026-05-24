import apiClient from './client';
import type { SetupOptionsResponse, SetupProgressResponse, SaveProgressDto } from '../types';

export const setupApi = {
  getOptions: () =>
    apiClient.get<SetupOptionsResponse>('/setup/options'),

  getProgress: () =>
    apiClient.get<SetupProgressResponse>('/setup/progress'),

  saveProgress: (dto: SaveProgressDto) =>
    apiClient.patch<SetupProgressResponse>('/setup/progress', dto),

  complete: () =>
    apiClient.post<{ success: boolean; message: string }>('/setup/complete'),

  getSection: (section: 'power' | 'craft') =>
    apiClient.get(`/setup/${section}`),

  putSection: (section: 'power' | 'craft', dto: { preferredTime?: string; restDays?: string[]; activities: Array<{ activityId: string; isPrimary?: boolean }> }) =>
    apiClient.put(`/setup/${section}`, dto),

  getMind: () =>
    apiClient.get('/setup/mind'),

  putMind: (dto: { isActive?: boolean; preferredTime?: string; restDays?: string[]; books?: Array<{ userBookId: string; isCompleted?: boolean }> }) =>
    apiClient.put('/setup/mind', dto),
};
