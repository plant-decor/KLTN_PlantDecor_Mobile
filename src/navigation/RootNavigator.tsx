import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import BottomTabNavigator from './BottomTabNavigator';
import { useEnumStore } from '../stores';
import {
  PlantDetailScreen,
  CartScreen,
  CheckoutScreen,
  PaymentWebViewScreen,
  VerifyCodeScreen,
  AIDesignScreen,
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  CatalogScreen,
  WishlistScreen,
  EditProfileScreen,
  OrderHistoryScreen,
  OrderDetailScreen,
  ShipperHomeScreen,
} from '../screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const preloadResources = useEnumStore((state) => state.preloadResources);

  useEffect(() => {
    void preloadResources(['plants', 'plant-sort', 'users', 'orders', 'payments']);
  }, [preloadResources]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen name="ShipperHome" component={ShipperHomeScreen} />
      <Stack.Screen name="PlantDetail" component={PlantDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} />
      <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="AIDesign" component={AIDesignScreen} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="Catalog" component={CatalogScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      {/* Add more stack screens as needed:
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="CategoryPlants" component={CategoryPlantsScreen} />
        <Stack.Screen name="AIDesignResult" component={AIDesignResultScreen} />
      */}
    </Stack.Navigator>
  );
}
