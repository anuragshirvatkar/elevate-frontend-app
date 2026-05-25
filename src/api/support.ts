import apiClient from './client';
import type { CreateSupportTicketDto, SupportTicket, SupportStatus, SupportIssueType } from '../types';

export const supportApi = {
  uploadImages: async (files: Array<{ uri: string; name: string; type: string }>) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    });
    return apiClient.post<{ success: boolean; urls: string[] }>('/support/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: (data) => data,
    });
  },

  createTicket: (dto: CreateSupportTicketDto) =>
    apiClient.post<{ success: boolean; ticket: { id: string; issueType: string; title?: string; status: string; createdAt: string } }>('/support', dto),

  getTickets: (params?: { status?: SupportStatus; issueType?: SupportIssueType }) =>
    apiClient.get<{ tickets: SupportTicket[] }>('/support', { params }),
};
