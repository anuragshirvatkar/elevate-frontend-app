import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import type { AuthStackScreenProps } from '../../navigation/types';
import { authApi } from '../../api';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';
import { useAlert } from '../../context/AlertContext';
import { useAuth } from '../../context/AuthContext';

// Required so the in-app browser can hand control back to the app after OAuth.
WebBrowser.maybeCompleteAuthSession();

const LoginScreen: React.FC<AuthStackScreenProps<'Login'>> = ({ navigation }) => {
  const { showAlert } = useAlert();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  // expo-auth-session Google provider. Uses the Web client ID for Expo Go /
  // web; the native client IDs kick in automatically on standalone builds.
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  const validate = () => {
    if (!email.trim()) { setEmailError('Email is required'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Enter a valid email'); return false;
    }
    setEmailError('');
    return true;
  };

  const handleSendOtp = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await authApi.requestOtp(email.trim().toLowerCase());
      navigation.navigate('OtpVerify', { email: email.trim().toLowerCase() });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to send OTP. Please try again.';
      showAlert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!request) {
      showAlert('Not Ready', 'Google sign-in is still loading. Please try again in a moment.');
      return;
    }
    setGoogleLoading(true);
    try {
      const result = await promptAsync();

      if (result.type === 'success') {
        const idToken = result.params?.id_token;
        if (!idToken) {
          showAlert('Error', 'Could not retrieve Google ID token. Please try again.');
          return;
        }

        // Exchange the Google ID token with our backend.
        const { data } = await authApi.googleLogin(idToken);

        // Stores tokens in AsyncStorage and updates auth state.
        // RootNavigator then routes to Onboarding or Main automatically.
        await login(data.accessToken, data.refreshToken, data.user);

      } else if (result.type === 'error') {
        const msg = result.error?.message ?? 'Google sign-in failed. Please try again.';
        showAlert('Sign In Failed', msg);
      }
      // type 'cancel' / 'dismiss' — user closed the browser, do nothing
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Google sign-in failed. Please try again.';
      showAlert('Error', msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {/* Background glow */}
        <LinearGradient
          colors={['#ffffff0a', '#ffffff00']}
          start={{ x: 1, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={styles.bottomRightGlow}
          pointerEvents="none"
        />
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.title}>Start here</Text>
            <Text style={styles.subtitle}>Small actions. Better days.</Text>

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="conqueror@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={emailError}
              returnKeyType="done"
              onSubmitEditing={handleSendOtp}
            />

            <Button
              title="Continue"
              onPress={handleSendOtp}
              loading={loading}
              fullWidth
              size="lg"
              variant="light"
              style={styles.continueBtn}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Button */}
            <TouchableOpacity
              style={[
                styles.googleButton,
                (googleLoading || !request) && styles.googleButtonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              activeOpacity={0.7}
              disabled={googleLoading || !request}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Ionicons name="logo-google" size={20} color={colors.text} />
              )}
              <Text style={styles.googleButtonText}>
                {googleLoading ? 'Signing in…' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.disclaimer}>
            By continuing, you agree to our Terms & Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050505' },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  form: { gap: spacing.sm, flex: 1, justifyContent: 'flex-start', paddingTop: 90 },
  title: {
    fontSize: 40,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: spacing.lg,
  },
  continueBtn: { marginTop: spacing.sm },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dividerText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    height: 58,
  },
  googleButtonDisabled: {
    opacity: 0.5,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  disclaimer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.33)',
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  bottomRightGlow: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
});

export default LoginScreen;
