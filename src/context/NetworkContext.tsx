import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkContextType {
  isConnected: boolean;
  refresh: () => void;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnected: true,
  refresh: () => {},
});

export const NetworkProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    NetInfo.fetch().then((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
    });

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
    });

    return unsubscribe;
  }, []);

  const refresh = () => {
    NetInfo.refresh().then((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? true);
    });
  };

  return (
    <NetworkContext.Provider value={{ isConnected, refresh }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);
