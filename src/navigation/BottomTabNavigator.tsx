import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS, ICONS } from '../constants';
import { MainTabParamList } from '../types';
import {
  HomeScreen,
  ProductsScreen,
  CartScreen,
  ProfileScreen,
  AIDesignScreen,
} from '../screens';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
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
          tabBarIcon: () => <ICONS.home width={25} height={28} />,
        }}
      />
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{
          tabBarIcon: () => <ICONS.products width={25} height={28} />,
        }}
      />
      <Tab.Screen
        name="AIDesignTab"
        component={AIDesignScreen}
        options={{
          tabBarIcon: () => (
            <View style={styles.centerOuterRing}>
              <View style={styles.centerIconWrap}>
                <ICONS.aiDesign width={28} height={32} />
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
          }) => (
            <Pressable
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={accessibilityState}
              accessibilityLabel={accessibilityLabel}
              testID={testID}
              style={styles.centerButton}
            >
              {children}
            </Pressable>
          ),
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          tabBarIcon: () => <ICONS.cart width={25} height={28} />,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: () => <ICONS.profile width={16} height={18} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    height: 58,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 10,
  },
  tabBarItem: {
    paddingHorizontal: 8,
    paddingVertical: 6,
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'transparent', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#13EC5B',
    borderWidth: 4,
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
