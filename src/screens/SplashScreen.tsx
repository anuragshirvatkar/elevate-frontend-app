import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography } from '../theme';

const SplashScreen = () => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 1100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 150);
        Animated.timing(taglineOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <Image
          source={require('../../assets/elevate-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.wordmark}>ELEVATE</Text>
      </Animated.View>
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Rise. Every. Day.
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  content: { alignItems: 'center', gap: 16 },
  logo: {
    width: 100,
    height: 100,
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
  },
});

export default SplashScreen;
