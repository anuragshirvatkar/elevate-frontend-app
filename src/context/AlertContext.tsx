import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import CustomAlert from '../components/common/CustomAlert';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertConfig {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

interface AlertContextType {
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
}

const AlertContext = createContext<AlertContextType>({ showAlert: () => {} });

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<AlertConfig | null>(null);

  const showAlert = useCallback((title: string, message?: string, buttons?: AlertButton[]) => {
    setConfig({ title, message, buttons: buttons || [{ text: 'OK' }] });
  }, []);

  const dismiss = () => setConfig(null);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <CustomAlert
        visible={!!config}
        title={config?.title ?? ''}
        message={config?.message}
        buttons={config?.buttons ?? [{ text: 'OK' }]}
        onDismiss={dismiss}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = () => useContext(AlertContext);
