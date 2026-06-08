import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackScreenProps } from '../../navigation/types';
import { authApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import Button from '../../components/common/Button';
import { colors, spacing, typography, radius } from '../../theme';

const OTP_LENGTH = 6;

const OtpVerifyScreen: React.FC<AuthStackScreenProps<'OtpVerify'>> = ({ route, navigation }) => {
  const { email } = route.params;
  const { login } = useAuth();
  const { showAlert } = useAlert();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRef = useRef<TextInput>(null);
  const charAnimations = useRef(
    Array.from({ length: OTP_LENGTH }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    // Delay focus slightly so the component is fully mounted before the keyboard is requested
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 100);
    const timer = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => { clearTimeout(focusTimer); clearInterval(timer); };
  }, []);

  useEffect(() => {
    // Animate each character when it appears
    otp.split('').forEach((char, i) => {
      if (char) {
        Animated.timing(charAnimations[i], {
          toValue: 1,
          duration: 200,
          delay: i * 50,
          useNativeDriver: true,
        }).start();
      } else {
        charAnimations[i].setValue(0);
      }
    });
  }, [otp]);

  const handleVerify = async () => {
    if (otp.length < OTP_LENGTH) {
      showAlert('Invalid OTP', 'Please enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.verifyOtp(email, otp);
      await login(data.accessToken, data.refreshToken, data.user, data.isNewUser, data.daysSinceLastLogin);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Invalid or expired OTP.';
      showAlert('Error', Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authApi.requestOtp(email);
      setCountdown(60);
      setOtp('');
      showAlert('Sent', 'A new OTP has been sent to your email.');
    } catch (err: any) {
      showAlert('Error', 'Could not resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // Render OTP boxes
  const boxes = Array.from({ length: OTP_LENGTH });

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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.form}>
            <Text style={styles.title}>Check email</Text>
            <Text style={styles.subtitle}>
              We sent OTP to{'\n'}
              <Text style={styles.emailText}>{email}</Text>
            </Text>

          {/* OTP Display */}
          <View style={styles.otpRow}>
            {boxes.map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  // blur→focus cycle forces the OS to re-show the keyboard
                  // (calling focus() alone fails on Android after keyboard is manually dismissed)
                  inputRef.current?.blur();
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.otpBox,
                    otp[i] ? styles.otpBoxFilled : null,
                    otp.length === i ? styles.otpBoxActive : null,
                  ]}
                >
                  <Animated.Text
                    style={[
                      styles.otpChar,
                      {
                        transform: [
                          {
                            translateY: charAnimations[i].interpolate({
                              inputRange: [0, 1],
                              outputRange: [20, 0],
                            }),
                          },
                        ],
                        opacity: charAnimations[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1],
                        }),
                      },
                    ]}
                  >
                    {otp[i] || ''}
                  </Animated.Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hidden input */}
          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, OTP_LENGTH))}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            style={styles.hiddenInput}
            caretHidden
            autoFocus
            showSoftInputOnFocus
          />

          <Button
            title="Verify"
            onPress={handleVerify}
            loading={loading}
            disabled={otp.length < OTP_LENGTH}
            fullWidth
            size="lg"
            variant="light"
            style={styles.verifyBtn}
          />

          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive it? </Text>
            {countdown > 0 ? (
              <Text style={styles.countdown}>Resend in {countdown}s</Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                <Text style={styles.resendLink}>{resending ? 'Sending...' : 'Resend OTP'}</Text>
              </TouchableOpacity>
            )}
          </View>
          </View>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    marginBottom: spacing.md,
  },
  backText: {
    ...typography.body,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: '#FFFFFF',
    textShadowRadius: 4,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
  },
  title: {
    fontSize: 40,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  emailText: { color: '#ffffff', fontWeight: '600' },
  otpRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.xl },
  otpBox: {
    width: 48,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: { borderColor: 'rgba(255, 255, 255, 0.8)' },
  otpBoxActive: { borderColor: 'rgba(255, 255, 255, 0.5)' },
  otpChar: { ...typography.h3, color: '#ffffff' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  verifyBtn: { marginBottom: spacing.sm },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  resendLabel: { fontSize: 14, color: 'rgba(255, 255, 255, 0.5)' },
  countdown: { fontSize: 14, color: 'rgba(255, 255, 255, 0.33)' },
  resendLink: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  bottomRightGlow: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
});

export default OtpVerifyScreen;
