import React, {
  createContext, useCallback, useContext, useMemo, useRef, useState,
} from 'react';

export interface InAppNotificationData {
  title: string;
  body: string;
  companionImageUrl?: string;
}

type InAppNotificationContextValue = {
  notification: InAppNotificationData | null;
  modalOverlayActive: boolean;
  setModalOverlayActive: (active: boolean) => void;
  showNotification: (data: InAppNotificationData, onPress?: () => void) => void;
  dismissNotification: () => void;
  handleNotificationPress: () => void;
};

const InAppNotificationContext = createContext<InAppNotificationContextValue | null>(null);

export const InAppNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<InAppNotificationData | null>(null);
  const [modalOverlayActive, setModalOverlayActive] = useState(false);
  const onPressRef = useRef<(() => void) | null>(null);

  const showNotification = useCallback((data: InAppNotificationData, onPress?: () => void) => {
    onPressRef.current = onPress ?? null;
    setNotification(data);
  }, []);

  const dismissNotification = useCallback(() => {
    setNotification(null);
    onPressRef.current = null;
  }, []);

  const handleNotificationPress = useCallback(() => {
    onPressRef.current?.();
    onPressRef.current = null;
  }, []);

  const value = useMemo(
    () => ({
      notification,
      modalOverlayActive,
      setModalOverlayActive,
      showNotification,
      dismissNotification,
      handleNotificationPress,
    }),
    [notification, modalOverlayActive, showNotification, dismissNotification, handleNotificationPress],
  );

  return (
    <InAppNotificationContext.Provider value={value}>
      {children}
    </InAppNotificationContext.Provider>
  );
};

export function useInAppNotification() {
  const ctx = useContext(InAppNotificationContext);
  if (!ctx) throw new Error('useInAppNotification must be used within InAppNotificationProvider');
  return ctx;
}
