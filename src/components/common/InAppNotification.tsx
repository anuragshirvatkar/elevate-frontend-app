import React, { useEffect, useRef } from 'react';
import {
  Animated, View, Text, Image, StyleSheet, TouchableOpacity, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme';

const { width } = Dimensions.get('window');
const DISPLAY_DURATION = 5000;

export interface InAppNotificationData {
  title: string;
  body: string;
  companionImageUrl?: string;
}

interface Props {
  notification: InAppNotificationData | null;
  onDismiss: () => void;
  onPress?: () => void;
}

const InAppNotification: React.FC<Props> = ({ notification, onDismiss, onPress }) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!notification) return;

    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    timerRef.current = setTimeout(() => dismiss(), DISPLAY_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification]);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(translateY, {
      toValue: -120,
      duration: 300,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  if (!notification) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + spacing.sm, transform: [{ translateY }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        style={styles.card}
        onPress={() => { dismiss(); onPress?.(); }}
      >
        {notification.companionImageUrl && (
          <Image source={{ uri: notification.companionImageUrl }} style={styles.avatar} />
        )}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
        </View>
        <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  body: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 18,
  },
  closeBtn: {
    paddingLeft: spacing.xs,
  },
  closeText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },
});

export default InAppNotification;
