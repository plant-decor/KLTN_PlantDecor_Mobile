import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import BottomTabNavigator from './BottomTabNavigator';
import {
  PlantDetailScreen,
  CartScreen,
  CheckoutScreen,
  VerifyCodeScreen,
  AIDesignScreen,
  LoginScreen,
  RegisterScreen,
  CatalogScreen,
  WishlistScreen,
} from '../screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen name="PlantDetail" component={PlantDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="AIDesign" component={AIDesignScreen} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="Catalog" component={CatalogScreen} />
      {/* Add more stack screens as needed:
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="CategoryPlants" component={CategoryPlantsScreen} />
        <Stack.Screen name="AIDesignResult" component={AIDesignResultScreen} />
      */}
    </Stack.Navigator>
  );
}
