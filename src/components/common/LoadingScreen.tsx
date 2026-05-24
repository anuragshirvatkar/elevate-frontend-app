import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

const LoadingScreen: React.FC<{ message?: string }> = ({ message }) => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color={colors.text} />
    {message && <Text style={styles.message}>{message}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  message: { ...typography.body, color: colors.textSecondary },
});

export default LoadingScreen;
