import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { Platform, View, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { UserProvider } from './src/context/UserContext';
import { NetworkProvider, useNetwork } from './src/context/NetworkContext';
import { AlertProvider } from './src/context/AlertContext';
import { InAppNotificationProvider, useInAppNotification } from './src/context/InAppNotificationContext';
import RootNavigator from './src/navigation/RootNavigator';
import NoInternetScreen from './src/components/common/NoInternetScreen';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { CommonActions } from '@react-navigation/native';
import InAppNotification from './src/components/common/InAppNotification';

ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const isForegrounded = AppState.currentState === 'active';
    return {
      shouldShowAlert: !isForegrounded,
      shouldPlaySound: !isForegrounded,
      shouldSetBadge: false,
    };
  },
});

const ANDROID_CHANNEL_ID = 'elevate_v2';
if (Platform.OS === 'android') {
  (async () => {
    try {
      await Notifications.deleteNotificationChannelAsync('elevate');
    } catch {}
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Elevate',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'notification_bell',
      vibrationPattern: [0, 150, 100, 150],
      enableLights: true,
      lightColor: '#FFFFFF',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  })();
}

function AppContent() {
  const { isConnected } = useNetwork();
  const { isAuthenticated } = useAuth();
  const navigationRef = useRef<any>(null);
  const { showNotification } = useInAppNotification();
  usePushNotifications(isAuthenticated);

  useLayoutEffect(() => {
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  const getNavigationAction = (type: string) => {
    switch (type) {
      case 'birthday':
      case 'power_streak_at_risk':
      case 'craft_streak_at_risk':
      case 'mind_streak_at_risk':
      case 'purity_streak_at_risk':
      case 'activity_reminder':
      case 'eod_log_reminder':
      case 'inactive_final':
        return CommonActions.navigate({ name: 'Main', params: { screen: 'Tabs', params: { screen: 'HomeTab' } } });
      case 'leaderboard_entered_top3':
      case 'near_top3':
      case 'leaderboard_rank_up':
        return CommonActions.navigate({ name: 'Main', params: { screen: 'Tabs', params: { screen: 'Leaderboard' } } });
      case 'near_unlock_avatar':
        return CommonActions.navigate({ name: 'Main', params: { screen: 'Tabs', params: { screen: 'Profile' } } });
      case 'near_unlock_achievement':
        return CommonActions.navigate({ name: 'Main', params: { screen: 'Achievements' } });
      case 'milestone_power':
      case 'milestone_mind':
      case 'milestone_craft':
      case 'milestone_purity':
        return CommonActions.navigate({ name: 'Main', params: { screen: 'Analytics' } });
      default:
        return null;
    }
  };

  const showCard = (title: string, body: string, data: Record<string, unknown>) => {
    const companionImageUrl = (data?.companionImageUrl as string) ?? undefined;
    const type = data?.type as string | undefined;
    const onPress = type
      ? () => {
          const action = getNavigationAction(type);
          if (action && navigationRef.current) navigationRef.current.dispatch(action);
        }
      : undefined;
    showNotification({ title, body, companionImageUrl }, onPress);
  };

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(notification => {
      const { title, body, data } = notification.request.content;
      if (!title) return;
      showCard(title, body ?? '', (data ?? {}) as Record<string, unknown>);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const { title, body, data } = response.notification.request.content;
      if (title) showCard(title, body ?? '', (data ?? {}) as Record<string, unknown>);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const { title, body, data } = response.notification.request.content;
      if (title) showCard(title, body ?? '', (data ?? {}) as Record<string, unknown>);
      const type = (data?.type) as string | undefined;
      if (type && navigationRef.current) {
        const action = getNavigationAction(type);
        if (action) navigationRef.current.dispatch(action);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (nextState: string) => {
      if (nextState !== 'active') return;
      try {
        const presented = await Notifications.getPresentedNotificationsAsync();
        if (presented.length === 0) return;
        const latest = presented[presented.length - 1];
        const { title, body, data } = latest.request.content;
        if (!title) return;
        showCard(title, body ?? '', (data ?? {}) as Record<string, unknown>);
        await Notifications.dismissAllNotificationsAsync();
      } catch {}
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  if (!isConnected) {
    return <NoInternetScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="light" backgroundColor="#000000" />
        <RootNavigator />
      </NavigationContainer>
      <InAppNotification />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NetworkProvider>
          <AlertProvider>
            <AuthProvider>
              <UserProvider>
                <InAppNotificationProvider>
                  <AppContent />
                </InAppNotificationProvider>
              </UserProvider>
            </AuthProvider>
          </AlertProvider>
        </NetworkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
