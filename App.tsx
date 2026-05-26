import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { UserProvider } from './src/context/UserContext';
import { NetworkProvider, useNetwork } from './src/context/NetworkContext';
import { AlertProvider } from './src/context/AlertContext';
import RootNavigator from './src/navigation/RootNavigator';
import NoInternetScreen from './src/components/common/NoInternetScreen';

function AppContent() {
  const { isConnected } = useNetwork();

  if (!isConnected) {
    return <NoInternetScreen />;
  }

  return (
    <NavigationContainer>
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
