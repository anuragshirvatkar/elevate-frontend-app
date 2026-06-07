import React, { useRef, useEffect, useState } from 'react';
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
import RootNavigator from './src/navigation/RootNavigator';
import NoInternetScreen from './src/components/common/NoInternetScreen';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { CommonActions } from '@react-navigation/native';
import InAppNotification, { InAppNotificationData } from './src/components/common/InAppNotification';

ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

// When the app is visually in the foreground, suppress the OS banner and show
// our custom card instead. When backgrounded (JS bridge still alive but user
// is on another app), let the OS show the real heads-up banner.
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

// Android: create/override the default channel with HIGH importance so push
// notifications appear as heads-up cards (slide in from top) when the user
// is using another app. 'default' is the channel Expo uses when no channelId
// is specified in the push payload. Must run before any notification arrives.
// Android locks a channel's importance after its first creation — calling
// setNotificationChannelAsync again with a higher importance is silently
// ignored. If 'elevate' was ever created at a lower importance (e.g. during
// an earlier build), heads-up banners stop working and there is no way to
// upgrade it in code. To guarantee a fresh MAX-importance channel we use a
// versioned id and delete the stale one. IMPORTANT: the backend push payload
// must send channelId: 'elevate_v2' to match this channel.
const ANDROID_CHANNEL_ID = 'elevate_v2';
if (Platform.OS === 'android') {
  (async () => {
    try {
      await Notifications.deleteNotificationChannelAsync('elevate');
    } catch {}
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Elevate',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'notification-bell.wav',
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
  const [inAppNotif, setInAppNotif] = useState<InAppNotificationData | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  usePushNotifications(isAuthenticated);

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
    setInAppNotif({ title, body, companionImageUrl });
    const type = data?.type as string | undefined;
    if (type) {
      pendingActionRef.current = () => {
        const action = getNavigationAction(type);
        if (action && navigationRef.current) navigationRef.current.dispatch(action);
      };
    }
  };

  // CASE 1: App in foreground — listener fires directly
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(notification => {
      const { title, body, data } = notification.request.content;
      if (!title) return;
      showCard(title, body ?? '', (data ?? {}) as Record<string, unknown>);
    });
    return () => sub.remove();
  }, []);

  // CASE 2: User taps the OS notification (from background or killed state)
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

  // CASE 3: App returns from background without tapping — try OS tray
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
      <InAppNotification
        notification={inAppNotif}
        onDismiss={() => setInAppNotif(null)}
        onPress={() => { pendingActionRef.current?.(); pendingActionRef.current = null; }}
      />
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
                <AppContent />
              </UserProvider>
            </AuthProvider>
          </AlertProvider>
        </NetworkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
