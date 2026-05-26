import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { colors, typography, spacing, radius } from '../../theme';
import type { AlertButton } from '../../context/AlertContext';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  onDismiss: () => void;
}

export default function CustomAlert({ visible, title, message, buttons, onDismiss }: Props) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.85);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 220, friction: 14, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handlePress = (btn: AlertButton) => {
    onDismiss();
    btn.onPress?.();
  };

  const textColor = (style?: AlertButton['style']) => {
    if (style === 'destructive') return colors.error;
    if (style === 'cancel') return colors.textSecondary;
    return colors.text;
  };

  const isBold = (style?: AlertButton['style']) => style !== 'cancel';

  const renderButtons = () => {
    if (buttons.length === 2) {
      return (
        <View style={styles.row}>
          {buttons.map((btn, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.dividerV} />}
              <TouchableOpacity
                style={styles.btnHalf}
                onPress={() => handlePress(btn)}
                activeOpacity={0.55}
              >
                <Text style={[styles.btnText, { color: textColor(btn.style), fontWeight: isBold(btn.style) ? '600' : '400' }]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      );
    }

    return (
      <View>
        {buttons.map((btn, i) => (
          <React.Fragment key={i}>
            <View style={styles.dividerH} />
            <TouchableOpacity
              style={styles.btnFull}
              onPress={() => handlePress(btn)}
              activeOpacity={0.55}
            >
              <Text style={[styles.btnText, { color: textColor(btn.style), fontWeight: isBold(btn.style) ? '600' : '400' }]}>
                {btn.text}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={styles.body}>
            <Text style={styles.title}>{title}</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}
          </View>
          {renderButtons()}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 310,
    backgroundColor: colors.cardElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.h4,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  dividerH: {
    height: 1,
    backgroundColor: colors.border,
  },
  dividerV: {
    width: 1,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnHalf: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnFull: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
  },
});
