import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, View, Text, Image, StyleSheet, TouchableOpacity,
  Dimensions, Modal,
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
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep modal open during the slide-out animation, close it after
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!notification) return;

    setModalVisible(true);

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
      setModalVisible(false);
      onDismiss();
    });
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      {/* box-none lets touches pass through the transparent background */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.container,
            {
              top: insets.top + spacing.sm,
              transform: [{ translateY }],
              opacity,
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.card}
            onPress={() => { dismiss(); onPress?.(); }}
          >
            {notification?.companionImageUrl ? (
              <Image
                source={{ uri: notification.companionImageUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>E</Text>
              </View>
            )}

            <View style={styles.textContainer}>
              <Text style={styles.title} numberOfLines={1}>{notification?.title}</Text>
              <Text style={styles.body} numberOfLines={2}>{notification?.body}</Text>
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
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
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

export default InAppNotification;
