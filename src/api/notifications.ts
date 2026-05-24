import apiClient from './client';
import type { RegisterDeviceDto } from '../types';

export const notificationsApi = {
  registerDevice: (dto: RegisterDeviceDto) =>
    apiClient.post<{ message: string }>('/notifications/register-device', dto),
};
