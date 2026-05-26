import apiClient from './client';
import type { ProfileResponse, EditProfileDto } from '../types';

export const profileApi = {
  get: () =>
    apiClient.get<ProfileResponse>('/profile'),

  isValidUsername: (username: string) =>
    apiClient.get<{ isValid: boolean; reason: string | null }>('/profile/is-valid-username', { params: { username } }),

  edit: (dto: EditProfileDto) =>
    apiClient.put<{ success: boolean; updatedFields: string[] }>('/profile', dto),

  getPublic: (userId: string) =>
    apiClient.get(`/users/${userId}/profile`),

  deleteAccount: () =>
    apiClient.delete<{ success: boolean; message: string }>('/profile'),
};
