import React, { useRef, useEffect, useState } from 'react';
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
import { RootStackParamList } from './src/navigation/types';
import { StackActions } from '@react-navigation/native';
import InAppNotification, { InAppNotificationData } from './src/components/common/InAppNotification';

ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AppContent() {
  const { isConnected } = useNetwork();
  const { isAuthenticated } = useAuth();
  const navigationRef = useRef<any>(null);
  const [inAppNotif, setInAppNotif] = useState<InAppNotificationData | null>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);
  usePushNotifications(isAuthenticated);


  // Show in-app notification card for foreground notifications
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(notification => {
      const { title, body, data } = notification.request.content;
      if (!title) return;
      const companionImageUrl = (data?.companionImageUrl as string) ?? undefined;
      setInAppNotif({ title, body: body ?? '', companionImageUrl });
      const type = data?.type as string | undefined;
      if (type) {
        pendingActionRef.current = () => {
          const action = getNavigationAction(type);
          if (action && navigationRef.current) navigationRef.current.dispatch(action);
        };
      }
    });
    return () => sub.remove();
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
        return StackActions.replace('Main', { screen: 'Home' });
      case 'leaderboard_entered_top3':
      case 'near_top3':
      case 'leaderboard_rank_up':
        return StackActions.replace('Main', { screen: 'Leaderboard' });
      case 'near_unlock_avatar':
        return StackActions.replace('Main', { screen: 'Profile' });
      case 'near_unlock_achievement':
        return StackActions.replace('Main', { screen: 'Achievements' });
      case 'milestone_power':
      case 'milestone_mind':
      case 'milestone_craft':
      case 'milestone_purity':
        return StackActions.replace('Main', { screen: 'Analytics' });
      default:
        return null;
    }
  };

  // Handle notification response
  React.useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const notificationData = response.notification.request.content.data;
      const type = notificationData?.type;
      if (!type || !navigationRef.current) return;
      const action = getNavigationAction(type);
      if (action) navigationRef.current.dispatch(action);
    });

    return () => subscription.remove();
  }, []);

  if (!isConnected) {
    return <NoInternetScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" backgroundColor="#000000" />
      <RootNavigator />
      <InAppNotification
        notification={inAppNotif}
        onDismiss={() => setInAppNotif(null)}
        onPress={() => { pendingActionRef.current?.(); pendingActionRef.current = null; }}
      />
    </NavigationContainer>
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
