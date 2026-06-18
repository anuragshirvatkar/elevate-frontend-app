import apiClient from './client';
import type { JournalEntry, UpsertJournalDto, JournalsListResponse, TodayGoalResponse } from '../types';

const localToday = () => new Date().toLocaleDateString('en-CA');

export const journalsApi = {
  upsert: (dto: UpsertJournalDto) =>
    apiClient.put<JournalEntry>('/journals', dto),

  getToday: () =>
    apiClient.get<JournalEntry | null>('/journals/today'),

  getList: (params?: { page?: number; limit?: number; startDate?: string; endDate?: string }) =>
    apiClient.get<JournalsListResponse>('/journals', { params }),

  getTodayGoal: () =>
    apiClient.get<TodayGoalResponse>('/journals/today-goal'),

  dismissTodayGoal: () =>
    apiClient.post<{ success: boolean }>('/journals/today-goal/dismiss', null, {
      params: { today: localToday() },
    }),
};
