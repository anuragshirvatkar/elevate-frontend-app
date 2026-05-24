import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList, DrawerParamList } from './types';
import { colors, spacing } from '../theme';

import HomeScreen from '../screens/main/HomeScreen';
import LeaderboardScreen from '../screens/main/LeaderboardScreen';
import JournalScreen from '../screens/main/JournalScreen';
import JournalDetailScreen from '../screens/main/JournalDetailScreen';
import RecordDetailScreen from '../screens/main/RecordDetailScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import StatsScreen from '../screens/drawer/StatsScreen';
import BooksScreen from '../screens/drawer/BooksScreen';
import ActivitiesScreen from '../screens/drawer/ActivitiesScreen';
import CompanionMessagesScreen from '../screens/drawer/CompanionMessagesScreen';
import AchievementsScreen from '../screens/drawer/AchievementsScreen';
import SupportScreen from '../screens/drawer/SupportScreen';
import SettingsScreen from '../screens/drawer/SettingsScreen';
import CustomDrawerContent from '../components/navigation/CustomDrawerContent';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: insets.bottom,
          height: 56 + insets.bottom,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
            HomeTab: { active: 'home', inactive: 'home-outline' },
            Leaderboard: { active: 'trophy', inactive: 'trophy-outline' },
            Journal: { active: 'journal', inactive: 'journal-outline' },
            Profile: { active: 'person', inactive: 'person-outline' },
          };
          const iconSet = icons[route.name];
          return <Ionicons name={focused ? iconSet.active : iconSet.inactive} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Journal" component={JournalScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const MainNavigator = () => (
  <Drawer.Navigator
    drawerContent={(props) => <CustomDrawerContent {...props} />}
    screenOptions={{
      headerShown: false,
      drawerStyle: { backgroundColor: colors.surface, width: 280 },
      drawerPosition: 'right',
      swipeEnabled: false,
    }}
  >
    <Drawer.Screen name="Tabs" component={TabNavigator} />
    <Drawer.Screen name="Stats" component={StatsScreen} />
    <Drawer.Screen name="Books" component={BooksScreen} />
    <Drawer.Screen name="Activities" component={ActivitiesScreen} />
    <Drawer.Screen name="CompanionMessages" component={CompanionMessagesScreen} />
    <Drawer.Screen name="Achievements" component={AchievementsScreen} />
    <Drawer.Screen name="Support" component={SupportScreen} />
    <Drawer.Screen name="Settings" component={SettingsScreen} />
    <Drawer.Screen name="JournalDetail" component={JournalDetailScreen} />
    <Drawer.Screen name="RecordDetail" component={RecordDetailScreen} />
  </Drawer.Navigator>
);

export default MainNavigator;
