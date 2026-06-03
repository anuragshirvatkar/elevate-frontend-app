import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '../../theme';

interface Props {
  visible: boolean;
  onCamera: () => void;
  onLibrary: () => void;
  onClose: () => void;
}

export default function ImageSourceSheet({ visible, onCamera, onLibrary, onClose }: Props) {
  const translateY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(300);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, tension: 70, friction: 11, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const dismiss = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 300, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      onClose();
      cb?.();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => dismiss()}>
      <TouchableWithoutFeedback onPress={() => dismiss()}>
        <Animated.View style={[styles.overlay, { opacity }]}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
              <View style={styles.handle} />

              <Text style={styles.sectionTitle}>Add Photo</Text>

              <TouchableOpacity style={styles.option} onPress={() => dismiss(onCamera)} activeOpacity={0.65}>
                <View style={styles.optionIconWrap}>
                  <Ionicons name="camera" size={21} color={colors.text} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>Take Photo</Text>
                  <Text style={styles.optionSub}>Use your camera</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity style={styles.option} onPress={() => dismiss(onLibrary)} activeOpacity={0.65}>
                <View style={styles.optionIconWrap}>
                  <Ionicons name="images" size={21} color={colors.text} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>Photo Library</Text>
                  <Text style={styles.optionSub}>Choose from gallery</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={() => dismiss()} activeOpacity={0.65}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const ICON_SIZE = 46;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cardElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  optionIconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  optionSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: ICON_SIZE + spacing.md,
  },
  cancelBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
