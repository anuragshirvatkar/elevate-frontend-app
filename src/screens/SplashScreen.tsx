import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { colors, typography } from '../theme';

interface SplashScreenProps {
  onDone: () => void;
}

const LOGO_IMAGE = require('../../assets/elevate-logo.png');

const SplashScreen = ({ onDone }: SplashScreenProps) => {
  const scale = useRef(new Animated.Value(0.94)).current;

  useLayoutEffect(() => {
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 150);
        }
        setTimeout(onDone, finished ? 500 : 0);
      },
    );
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.brandBlock, { transform: [{ scale }] }]}>
        <Image source={LOGO_IMAGE} style={styles.logo} resizeMode="contain" />
        <Text style={styles.wordmark}>ELEVATE</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBlock: {
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 88,
    height: 88,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 10,
  },
  tagline: {
    ...typography.bodySmall,
    color: colors.textMuted,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});

export default SplashScreen;
