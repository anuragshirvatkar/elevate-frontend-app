import React, { createContext, useContext, useState, useCallback } from 'react';
import { profileApi } from '../api';
import type { ProfileResponse } from '../types';

interface UserContextValue {
  profile: ProfileResponse | null;
  isLoadingProfile: boolean;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<ProfileResponse>) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const fetchProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    try {
      const { data } = await profileApi.get();
      setProfile(data);
    } catch (e) {
      console.warn('Failed to fetch profile', e);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  const updateProfile = useCallback((updates: Partial<ProfileResponse>) => {
    setProfile((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  return (
    <UserContext.Provider value={{ profile, isLoadingProfile, fetchProfile, updateProfile }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
};
