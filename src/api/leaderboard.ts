import apiClient from './client';
import type { LeaderboardResponse, LeaderboardPeriod, LeaderboardSection } from '../types';

export const leaderboardApi = {
  get: (params?: { period?: LeaderboardPeriod; section?: LeaderboardSection; page?: number; limit?: number }) =>
    apiClient.get<LeaderboardResponse>('/leaderboard', { params }),
};
