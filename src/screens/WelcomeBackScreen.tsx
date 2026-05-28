import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useUser } from '../context/UserContext';
import { colors, spacing, typography } from '../theme';
import type { RootStackScreenProps } from '../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WelcomeBackScreen: React.FC<RootStackScreenProps<'WelcomeBack'>> = ({ navigation }) => {
  const { user, clearWelcomeBack } = useAuth();
  const { profile, fetchProfile } = useUser();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const bubbleSlide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(bubbleAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(bubbleSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, [fadeAnim, slideAnim, bubbleAnim, bubbleSlide]);

  const activeCompanion = profile?.companions?.find((c) => c.isActive) ?? profile?.companions?.[0];
  const companionName = activeCompanion?.name ?? 'Your companion';
  const companionImage = (activeCompanion as any)?.imageUrl ?? (activeCompanion as any)?.image;

  const username = user?.username ?? 'Warrior';

  const handleContinue = () => {
    clearWelcomeBack();
    navigation.replace('Main');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={['#0a0a0a', '#050505']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.container}>
        <Animated.View
          style={[
            styles.companionWrapper,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {companionImage ? (
            <Image
              source={{ uri: companionImage }}
              style={styles.companionImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.companionPlaceholder}>
              <Text style={styles.companionEmoji}>🏴‍☠️</Text>
            </View>
          )}
        </Animated.View>

        <Animated.View
          style={[
            styles.speechBubble,
            {
              opacity: bubbleAnim,
              transform: [{ translateY: bubbleSlide }],
            },
          ]}
        >
          <View style={styles.bubbleTail} />
          <Text style={styles.bubbleText}>
            <Text style={styles.bubbleName}>{username}</Text>
            {`\u2026 it\u2019s been a while.\nI noticed you were gone \u2014 but I never stopped watching your progress.\n\nWelcome back. Let\u2019s pick up where we left off.`}
          </Text>
        </Animated.View>

        <Animated.View style={[styles.footer, { opacity: bubbleAnim }]}>
          <Text style={styles.companionLabel}>— {companionName}</Text>
          <TouchableOpacity style={styles.ctaButton} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Let's go</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#050505',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: 28,
  },
  companionWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  companionImage: {
    width: '100%',
    height: '100%',
  },
  companionPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companionEmoji: {
    fontSize: 56,
  },
  speechBubble: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: spacing.lg,
    width: SCREEN_WIDTH - spacing.lg * 2,
    position: 'relative',
  },
  bubbleTail: {
    position: 'absolute',
    top: -10,
    left: '50%',
    marginLeft: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#000000',
  },
  bubbleText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
  },
  bubbleName: {
    color: '#fff',
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  companionLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    fontStyle: 'italic',
    letterSpacing: 0.4,
  },
  ctaButton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  ctaText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default WelcomeBackScreen;
