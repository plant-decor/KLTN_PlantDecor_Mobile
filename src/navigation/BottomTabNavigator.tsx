import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS } from '../constants';
import { MainTabParamList } from '../types';
import {
  HomeScreen,
  ProductsScreen,
  CartScreen,
  ProfileScreen,
  AIDesignScreen,
} from '../screens';
import HomeIcon from '../../assets/icons/navbar.svg';
import ProductIcon from '../../assets/icons/Icons-2.svg';
import AiIcon from '../../assets/icons/Icons-1.svg';
import FavoriteIcon from '../../assets/icons/Icons.svg';
import ProfileIcon from '../../assets/icons/Vector.svg';

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
          tabBarIcon: () => <HomeIcon width={25} height={28} />,
        }}
      />
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{
          tabBarIcon: () => <ProductIcon width={25} height={28} />,
        }}
      />
      <Tab.Screen
        name="AIDesignTab"
        component={AIDesignScreen}
        options={{
          tabBarIcon: () => (
            <View style={styles.centerOuterRing}>
              <View style={styles.centerIconWrap}>
                <AiIcon width={28} height={32} />
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
          tabBarIcon: () => <FavoriteIcon width={25} height={28} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: () => <ProfileIcon width={16} height={18} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 16,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.white,
    borderTopWidth: 0,
    paddingHorizontal: 10,
    paddingTop: 4,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 14,
  },
  tabBarItem: {
    paddingTop: 2,
  },
  tabBarIcon: {
    marginTop: 2,
  },
  centerButton: {
    top: -5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerOuterRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
  backgroundColor: '#F4FFF8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  centerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#14F25F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 12,
  },
});
