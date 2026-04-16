import React from 'react';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ICONS } from '../constants';
import { MainTabParamList } from '../types';
import {
  HomeScreen,
  CatalogScreen,
  CareServiceRegistrationScreen,
  ProfileScreen,
  AIDesignScreen,
} from '../screens';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => (
        <View style={styles.tabBarContainer}>
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#14DD59',
        tabBarInactiveTintColor: '#98A2B3',
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIconStyle: styles.tabBarIcon,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <ICONS.home width={25} height={28} color={color} />,
        }}
      />
      <Tab.Screen
        name="Plants"
        component={CatalogScreen}
        options={{
          tabBarIcon: ({ color }) => <ICONS.plants width={25} height={28} color={color} />,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="AIDesignTab"
        component={AIDesignScreen}
        options={{
          tabBarIcon: () => (
            <View style={styles.centerOuterRing}>
              <View style={styles.centerIconWrap}>
                <ICONS.aiDesign width={28} height={32} color={COLORS.black} />
              </View>
            </View>
          ),
          tabBarButton: ({
            children,
            onPress,
            onLongPress,
            accessibilityState,
            accessibilityLabel,
            testID,
            style,
          }) => (
            <Pressable
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={accessibilityState}
              accessibilityLabel={accessibilityLabel}
              testID={testID}
              style={[style, styles.centerButton]}
            >
              {children}
            </Pressable>
          ),
        }}
      />
      <Tab.Screen
        name="ServiceTab"
        component={CareServiceRegistrationScreen}
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="construct-outline" size={24} color={color} />,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <ICONS.profile width={16} height={18} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    alignItems: 'center',
  },
  tabBar: {
    height: 52,
    width: '88%',
    maxWidth: 420,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 7,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
  },
  tabBarItem: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  tabBarIcon: {
    marginTop: 0,
  },
  centerButton: { 
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerOuterRing: {
    width: 56,
    height: 56,
    borderRadius: 30,
    backgroundColor: 'transparent', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 30,
    backgroundColor: '#13EC5B',
    borderWidth: 3,
    borderColor: '#F6F8F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#13EC5B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 14,
  },
});
