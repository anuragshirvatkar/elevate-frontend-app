import apiClient from './client';
import type { BookResponse } from '../types';

export const booksApi = {
  createCustom: (dto: { title: string; author?: string; pages?: number }) =>
    apiClient.post<BookResponse>('/books/custom', dto),

  generateSummary: (bookId: string) =>
    apiClient.post<{ success: boolean; summary?: string; message?: string }>(`/books/${bookId}/generate-summary`),

  editSummary: (bookId: string, summary: string) =>
    apiClient.put<{ success: boolean }>(`/books/${bookId}/summary`, { summary }),
};
