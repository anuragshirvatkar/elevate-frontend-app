import apiClient from './client';
import type { CompanionMessagesResponse, CompanionMessage } from '../types';

export const companionApi = {
  getMessages: (page = 1, limit = 20) =>
    apiClient.get<CompanionMessagesResponse>('/companion/messages', { params: { page, limit } }),

  markRead: (id: string) =>
    apiClient.patch<CompanionMessage>(`/companion-messages/${id}/read`),

  getUnreadCount: () =>
    apiClient.get<{ unreadCount: number }>('/companion/unread-count'),

  getAllMessages: () =>
    apiClient.get<CompanionMessage[]>('/companion-messages'),

  getUnreadMessages: () =>
    apiClient.get<CompanionMessage[]>('/companion-messages/unread'),
};
