import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme';

type MainBootContextValue = {
  setHomeReady: () => void;
};

const MainBootContext = createContext<MainBootContextValue | null>(null);

export const MainBootProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);

  const setHomeReady = useCallback(() => {
    setReady(true);
  }, []);

  const value = useMemo(() => ({ setHomeReady }), [setHomeReady]);

  return (
    <MainBootContext.Provider value={value}>
      <View style={styles.root}>
        <View
          style={[styles.content, !ready && styles.contentHidden]}
          pointerEvents={ready ? 'auto' : 'none'}
        >
          {children}
        </View>
        {!ready && (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.text} size="large" />
          </View>
        )}
      </View>
    </MainBootContext.Provider>
  );
};

export const useMainBoot = () => {
  const ctx = useContext(MainBootContext);
  if (!ctx) throw new Error('useMainBoot must be used within MainBootProvider');
  return ctx;
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: { flex: 1 },
  contentHidden: { opacity: 0 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
