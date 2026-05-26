import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { useAuth } from '../context/AuthContext';
import SplashScreen from '../screens/SplashScreen';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';
import WelcomeBackScreen from '../screens/WelcomeBackScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const { isLoading, isAuthenticated, user, isNewUser, daysSinceLastLogin } = useAuth();

  if (isLoading) return <SplashScreen />;

  const showWelcomeBack =
    isAuthenticated &&
    user?.onboarding_completed &&
    !isNewUser &&
    daysSinceLastLogin > 29;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : showWelcomeBack ? (
        <Stack.Screen name="WelcomeBack" component={WelcomeBackScreen} />
      ) : !user?.onboarding_completed ? (
        <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      ) : (
        <Stack.Screen name="Main" component={MainNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;
