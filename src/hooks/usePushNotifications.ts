import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { notificationsApi } from '../api';

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const projectId: string =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.manifest2 as any)?.extra?.eas?.projectId ??
    (Constants.manifest as any)?.extra?.eas?.projectId ??
    'bb1958d6-83d6-427d-9313-243fc78d9b1d';

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token;
}

export function usePushNotifications(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotifications().then((token) => {
      if (!token) return;
      notificationsApi.registerDevice(token).catch(() => {});
    });
  }, [isAuthenticated]);
}
