import { Tabs } from 'expo-router';
import { ColorValue, Platform } from 'react-native';

const ACTIVE_COLOR = '#1A3C5E';
const INACTIVE_COLOR = '#9CA3AF';
const TAB_BG = '#FFFFFF';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          height: Platform.OS === 'ios' ? 84 : 60,
        },
        headerStyle: { backgroundColor: ACTIVE_COLOR },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
          headerTitle: 'BudgetVault',
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: 'Import',
          tabBarIcon: ({ color }) => <TabIcon name="upload" color={color} />,
          headerTitle: 'Import Statement',
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }) => <TabIcon name="list" color={color} />,
          headerTitle: 'Transactions',
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: 'Budget',
          tabBarIcon: ({ color }) => <TabIcon name="pie-chart" color={color} />,
          headerTitle: 'Budget Planner',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon name="settings" color={color} />,
          headerTitle: 'Settings',
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color }: { name: string; color: ColorValue }) {
  const icons: Record<string, string> = {
    home: '⌂', upload: '↑', list: '≡', 'pie-chart': '◑', settings: '⚙',
  };
  return (
    <>{/* RN Text not imported here; real icons added in Phase 2 */}</>
  );
}
