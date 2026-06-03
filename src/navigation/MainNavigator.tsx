import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParamList, DrawerParamList } from './types';
import { colors } from '../theme';

import HomeScreen from '../screens/main/HomeScreen';
import LeaderboardScreen from '../screens/main/LeaderboardScreen';
import JournalScreen from '../screens/main/JournalScreen';
import JournalDetailScreen from '../screens/main/JournalDetailScreen';
import RecordDetailScreen from '../screens/main/RecordDetailScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import PublicProfileScreen from '../screens/main/PublicProfileScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import AnalyticsScreen from '../screens/drawer/AnalyticsScreen';
import PillarsScreen from '../screens/drawer/PillarsScreen';
import AchievementsScreen from '../screens/drawer/AchievementsScreen';
import CompanionMessagesScreen from '../screens/drawer/CompanionMessagesScreen';
import SupportScreen from '../screens/drawer/SupportScreen';
import PointRulesScreen from '../screens/drawer/PointRulesScreen';
import AboutScreen from '../screens/drawer/AboutScreen';
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
          paddingBottom: insets.bottom + 4,
          height: 64 + insets.bottom,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginTop: -4 },
        tabBarIconStyle: { marginBottom: -2 },
        tabBarItemStyle: { paddingTop: 6, paddingBottom: 0 },
        tabBarIcon: ({ color, focused }) => {
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
      drawerPosition: 'left',
      swipeEnabled: true,
    }}
  >
    <Drawer.Screen name="Tabs" component={TabNavigator} />
    <Drawer.Screen name="Leaderboard" component={LeaderboardScreen} />
    <Drawer.Screen name="Analytics" component={AnalyticsScreen} />
    <Drawer.Screen name="Pillars" component={PillarsScreen} />
    <Drawer.Screen name="Achievements" component={AchievementsScreen} />
    <Drawer.Screen name="CompanionMessages" component={CompanionMessagesScreen} />
    <Drawer.Screen name="Support" component={SupportScreen} />
    <Drawer.Screen name="PointRules" component={PointRulesScreen} />
    <Drawer.Screen name="About" component={AboutScreen} />
    <Drawer.Screen name="JournalDetail" component={JournalDetailScreen} />
    <Drawer.Screen name="RecordDetail" component={RecordDetailScreen} />
    <Drawer.Screen name="EditProfile" component={EditProfileScreen} />
    <Drawer.Screen name="PublicProfile" component={PublicProfileScreen} />
  </Drawer.Navigator>
);

export default MainNavigator;
