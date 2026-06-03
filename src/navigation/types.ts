import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { DrawerScreenProps } from '@react-navigation/drawer';
import type { JournalEntry, ActivityLogEntry } from '../types';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  WelcomeBack: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  OtpVerify: { email: string };
};

export type OnboardingStackParamList = {
  IntroWelcome: undefined;
  CompanionSelect: { skipRouting?: boolean } | undefined;
  DOBSelect: undefined;
  SetupPower: undefined;
  SetupCraft: undefined;
  SetupMind: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  Leaderboard: undefined;
  Journal: undefined;
  Profile: undefined;
};

export type DrawerParamList = {
  Tabs: undefined;
  Leaderboard: { section?: string } | undefined;
  Analytics: undefined;
  Pillars: undefined;
  Achievements: undefined;
  Support: undefined;
  PointRules: undefined;
  About: undefined;
  CompanionMessages: undefined;
  JournalDetail: { entry?: JournalEntry };
  RecordDetail: { date: string; logs: ActivityLogEntry[]; section?: string };
  EditProfile: { scrollToSection?: string } | undefined;
  PublicProfile: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<AuthStackParamList, T>;
export type OnboardingStackScreenProps<T extends keyof OnboardingStackParamList> = NativeStackScreenProps<OnboardingStackParamList, T>;
export type MainTabScreenProps<T extends keyof MainTabParamList> = BottomTabScreenProps<MainTabParamList, T>;
export type DrawerScreenPropsType<T extends keyof DrawerParamList> = DrawerScreenProps<DrawerParamList, T>;