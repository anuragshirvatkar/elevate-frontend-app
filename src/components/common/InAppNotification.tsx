import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, View, Text, Image, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme';
import { useInAppNotification, type InAppNotificationData } from '../../context/InAppNotificationContext';
import { optimizeCloudinaryUrl } from '../../utils/cloudinary';

const DISPLAY_DURATION = 5000;

export type { InAppNotificationData };

interface BannerProps {
  /** Use safe-area top inset when rendered at the app root. */
  useTopInset?: boolean;
}

export const InAppNotificationBanner: React.FC<BannerProps> = ({ useTopInset = false }) => {
  const insets = useSafeAreaInsets();
  const { notification, dismissNotification, handleNotificationPress } = useInAppNotification();
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!notification) {
      setVisible(false);
      return;
    }

    setVisible(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    translateY.stopAnimation();
    opacity.stopAnimation();
    translateY.setValue(-150);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    timerRef.current = setTimeout(() => dismiss(), DISPLAY_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification]);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -150,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      dismissNotification();
    });
  };

  if (!visible || !notification) return null;

  const top = useTopInset ? insets.top + spacing.sm : spacing.sm;

  return (
    <View style={[styles.host, { top }]} pointerEvents="box-none">
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.container,
          { transform: [{ translateY }], opacity },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.92}
          style={styles.card}
          onPress={() => { dismiss(); handleNotificationPress(); }}
        >
          {notification.companionImageUrl ? (
            <Image
              source={{ uri: optimizeCloudinaryUrl(notification.companionImageUrl, 48) }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>E</Text>
            </View>
          )}

          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
            <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
          </View>

          <TouchableOpacity
            onPress={dismiss}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
    elevation: 1000,
  },
  container: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#333',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2a2a2a',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 18,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  body: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    paddingLeft: spacing.xs,
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  closeText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
  },
});

const InAppNotification: React.FC = () => {
  const { modalOverlayActive } = useInAppNotification();
  if (modalOverlayActive) return null;
  return <InAppNotificationBanner useTopInset />;
};

export default InAppNotification;
