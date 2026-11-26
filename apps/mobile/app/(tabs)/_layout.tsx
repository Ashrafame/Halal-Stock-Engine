import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useI18n } from '@/lib/i18n';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { t } = useI18n();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.ink400,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.ink100,
          height: 66,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.dashboard'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="screener"
        options={{
          title: t('nav.screener'),
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: t('nav.alerts'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: t('nav.portfolio'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('nav.settings'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
