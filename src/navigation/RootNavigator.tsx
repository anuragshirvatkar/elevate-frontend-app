import React, { useState } from 'react';
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
  const [splashDone, setSplashDone] = useState(false);

  if (isLoading || !splashDone) return <SplashScreen onDone={() => setSplashDone(true)} />;

  const showWelcomeBack =
    isAuthenticated &&
    user?.onboarding_completed &&
    !isNewUser &&
    daysSinceLastLogin > 29;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
