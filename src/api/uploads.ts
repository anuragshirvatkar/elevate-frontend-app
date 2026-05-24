import apiClient from './client';
import type { UploadResponse } from '../types';

export const uploadsApi = {
  uploadActivityImage: async (file: { uri: string; name: string; type: string }) => {
    const formData = new FormData();
    formData.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    return apiClient.post<UploadResponse>('/uploads/activity-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
