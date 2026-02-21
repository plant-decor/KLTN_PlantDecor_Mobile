import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS, FONTS } from '../constants';
import { MainTabParamList } from '../types';
import { useCartStore } from '../stores';
import {
  HomeScreen,
  ProductsScreen,
  CartScreen,
  ProfileScreen,
  AIDesignScreen,
} from '../screens';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function BottomTabNavigator() {
  const totalItems = useCartStore((state) => state.totalItems);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray500,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size + 1} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="gift-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AIDesignTab"
        component={AIDesignScreen}
        options={{
          tabBarIcon: () => (
            <View style={styles.centerIconWrap}>
              <Ionicons name="sparkles" size={24} color={COLORS.black} />
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" size={size} color={color} />
          ),
          tabBarBadge: totalItems() > 0 ? '' : undefined,
          tabBarBadgeStyle: styles.dotBadge,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
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
    bottom: 14,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.white,
    borderTopWidth: 0,
    paddingHorizontal: 10,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  centerButton: {
    top: -16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 10,
  },
  dotBadge: {
    backgroundColor: COLORS.primaryLight,
    minWidth: 8,
    height: 8,
    borderRadius: 4,
    top: 6,
    right: 12,
    fontSize: FONTS.sizes.xs,
  },
});
