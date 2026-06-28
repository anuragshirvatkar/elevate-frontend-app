import apiClient, { BASE_URL } from './client';
import type { BookResponse, BookWithRecords, BookRecordsResponse } from '../types';

export const getBookSummaryPdfUrl = (bookId: string, download = false) => {
  const suffix = download ? '?download=1' : '';
  return `${BASE_URL}/books/${bookId}/summary-pdf${suffix}`;
};

export const booksApi = {
  createCustom: (dto: { title: string; author?: string; pages?: number }) =>
    apiClient.post<BookResponse>('/books/custom', dto),

  getCustom: () =>
    apiClient.get<BookResponse[]>('/books/custom'),

  deleteCustom: (bookId: string) =>
    apiClient.delete<{ success: boolean }>(`/books/custom/${bookId}`),

  generateSummary: (bookId: string) =>
    apiClient.post<{ success: boolean; summary?: string; pdfUrl?: string; pdfFilename?: string; message?: string }>(
      `/books/${bookId}/generate-summary`,
      undefined,
      // AI generation + PDF upload can take well over the default 15s timeout.
      { timeout: 120000 },
    ),

  getSummary: (bookId: string) =>
    apiClient.get<{ bookName: string; writerName: string; summary: string; pdfUrl: string; pdfFilename: string }>(`/books/${bookId}/summary`),

  markComplete: (bookId: string) =>
    apiClient.post<{ success: boolean; userBookId: string; isCompleted: boolean }>(`/books/${bookId}/complete`),

  editSummary: (bookId: string, summary: string) =>
    apiClient.put<{ success: boolean }>(`/books/${bookId}/summary`, { summary }),

  getBooksWithRecords: () =>
    apiClient.get<BookWithRecords[]>('/books/with-records'),

  getBookRecords: (bookId: string) =>
    apiClient.get<BookRecordsResponse>(`/books/${bookId}/records`),

  deleteRecord: (recordId: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/books/records/${recordId}`),
};
