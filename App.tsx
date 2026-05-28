import React, { useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { UserProvider } from './src/context/UserContext';
import { NetworkProvider, useNetwork } from './src/context/NetworkContext';
import { AlertProvider } from './src/context/AlertContext';
import RootNavigator from './src/navigation/RootNavigator';
import NoInternetScreen from './src/components/common/NoInternetScreen';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { RootStackParamList } from './src/navigation/types';
import { StackActions } from '@react-navigation/native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function AppContent() {
  const { isConnected } = useNetwork();
  const { isAuthenticated } = useAuth();
  const navigationRef = useRef<any>(null);
  usePushNotifications(isAuthenticated);

  // Handle notification response
  React.useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const notificationData = response.notification.request.content.data;
      const type = notificationData?.type;

      if (!type || !navigationRef.current) return;

      // Navigate based on notification type
      const getNavigationAction = (type: string) => {
        switch (type) {
          // Navigate to HomeScreen
          case 'birthday':
          case 'power_streak_at_risk':
          case 'craft_streak_at_risk':
          case 'mind_streak_at_risk':
          case 'activity_reminder':
            return StackActions.replace('Main', { screen: 'Home' });

          // Navigate to LeaderboardScreen
          case 'leaderboard_entered_top3':
          case 'near_top3':
          case 'leaderboard_rank_up':
            return StackActions.replace('Main', { screen: 'Leaderboard' });

          // Navigate to ProfileScreen
          case 'near_unlock_avatar':
            return StackActions.replace('Main', { screen: 'Profile' });

          // Navigate to AchievementsScreen
          case 'near_unlock_achievement':
            return StackActions.replace('Main', { screen: 'Achievements' });

          // Navigate to AnalyticsScreen
          case 'milestone_power':
          case 'milestone_mind':
          case 'milestone_craft':
          case 'milestone_purity':
            return StackActions.replace('Main', { screen: 'Analytics' });

          default:
            return null;
        }
      };

      const action = getNavigationAction(type);
      if (action) {
        navigationRef.current.dispatch(action);
      }
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
