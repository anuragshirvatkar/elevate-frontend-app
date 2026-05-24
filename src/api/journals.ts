import apiClient from './client';
import type { JournalEntry, UpsertJournalDto, JournalsListResponse } from '../types';

export const journalsApi = {
  upsert: (dto: UpsertJournalDto) =>
    apiClient.put<JournalEntry>('/journals', dto),

  getToday: () =>
    apiClient.get<JournalEntry | null>('/journals/today'),

  getList: (params?: { page?: number; limit?: number; startDate?: string; endDate?: string }) =>
    apiClient.get<JournalsListResponse>('/journals', { params }),
};
