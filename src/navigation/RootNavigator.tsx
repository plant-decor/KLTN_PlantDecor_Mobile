import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import BottomTabNavigator from './BottomTabNavigator';
import { useAuthStore, useEnumStore } from '../stores';
import {
  PlantDetailScreen,
  PlantInstanceDetailScreen,
  CartScreen,
  CheckoutScreen,
  PaymentSuccessScreen,
  PaymentWebViewScreen,
  VerifyCodeScreen,
  AIDesignScreen,
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  CatalogScreen,
  MaterialDetailScreen,
  ComboDetailScreen,
  WishlistScreen,
  EditProfileScreen,
  OrderHistoryScreen,
  OrderDetailScreen,
  ShipperHomeScreen,
  ShippingListScreen,
} from '../screens';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const preloadResources = useEnumStore((state) => state.preloadResources);
  const userRole = useAuthStore((state) => state.user?.role);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const normalizedRole = (userRole ?? '').trim().toLowerCase();
  const isShipper = isAuthenticated && normalizedRole === 'shipper';
  const navigatorKey = isShipper ? 'shipper-root' : 'default-root';
  const initialRouteName: keyof RootStackParamList = isShipper ? 'ShipperHome' : 'MainTabs';

  useEffect(() => {
    void preloadResources(['plants', 'plant-sort', 'users', 'orders', 'payments']);
  }, [preloadResources]);

  return (
    <Stack.Navigator
      key={navigatorKey}
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen name="ShipperHome" component={ShipperHomeScreen} />
      <Stack.Screen name="ShippingList" component={ShippingListScreen} />
      <Stack.Screen name="PlantDetail" component={PlantDetailScreen} />
      <Stack.Screen name="PlantInstanceDetail" component={PlantInstanceDetailScreen} />
      <Stack.Screen name="MaterialDetail" component={MaterialDetailScreen} />
      <Stack.Screen name="ComboDetail" component={ComboDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} />
      <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="AIDesign" component={AIDesignScreen} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="Catalog" component={CatalogScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen
        name="OrderHistory"
        component={OrderHistoryScreen}
        options={{ animationTypeForReplace: 'pop' }}
      />
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
