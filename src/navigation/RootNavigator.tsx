import React, { ReactElement, useEffect } from 'react';
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
  AIChatScreen,
  AIChatSessionsScreen,
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
  UserPlantsScreen,
  EditProfileScreen,
  OrderHistoryScreen,
  OrderDetailScreen,
  CareServiceRegistrationScreen,
  DesignServiceScreen,
  ServiceRegistrationDetailScreen,
  DesignRegistrationDetailScreen,
  DesignTaskDetailScreen,
  CareServicePackageDetailScreen,
  CustomerServiceProgressDetailScreen,
  ShipperHomeScreen,
  ShippingListScreen,
  ShipperOrderDetailScreen,
  CaretakerHomeScreen,
  CaretakerTasksScreen,
  CaretakerDesignTasksScreen,
  CaretakerRegistrationDetailScreen,
  CaretakerDesignTaskDetailScreen,
  CaretakerDesignRegistrationDetailScreen,
  CaretakerTaskDetailScreen,
  HomeScreen,
  SupportChatScreen,
} from '../screens';
import { resolveAuthenticatedHomeRoute } from '../utils/authFlow';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const preloadResources = useEnumStore((state) => state.preloadResources);
  const userRole = useAuthStore((state) => state.user?.role);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const roleRoute = resolveAuthenticatedHomeRoute(userRole);
  const isShipper = isAuthenticated && roleRoute === 'ShipperHome';
  const isCaretaker = isAuthenticated && roleRoute === 'CaretakerHome';
  const navigatorKey = !isAuthenticated
    ? 'guest-root'
    : isShipper
    ? 'shipper-root'
    : isCaretaker
    ? 'caretaker-root'
    : 'authenticated-root';
  const initialRouteName: keyof RootStackParamList = !isAuthenticated
    ? 'Login'
    : roleRoute;

  useEffect(() => {
    void preloadResources(['plants', 'plant-sort', 'users', 'orders', 'payments']);
  }, [preloadResources]);

  const sharedScreens = (): ReactElement => (
    <>
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="CareServiceRegistration" component={CareServiceRegistrationScreen} />
      <Stack.Screen name="DesignService" component={DesignServiceScreen} />
      <Stack.Screen name="AIChat" component={AIChatScreen} />
      <Stack.Screen name="AIChatSessions" component={AIChatSessionsScreen} />
      <Stack.Screen name="SupportChat" component={SupportChatScreen} />
      <Stack.Screen name="PlantDetail" component={PlantDetailScreen} />
      <Stack.Screen name="PlantInstanceDetail" component={PlantInstanceDetailScreen} />
      <Stack.Screen name="MaterialDetail" component={MaterialDetailScreen} />
      <Stack.Screen name="ComboDetail" component={ComboDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} />
      <Stack.Screen name="UserPlants" component={UserPlantsScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="PaymentWebView" component={PaymentWebViewScreen} />
      <Stack.Screen
        name="PaymentSuccess"
        component={PaymentSuccessScreen}
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen name="AIDesign" component={AIDesignScreen} />
      <Stack.Screen name="Catalog" component={CatalogScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen
        name="OrderHistory"
        component={OrderHistoryScreen}
        options={{ animationTypeForReplace: 'pop' }}
      />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen
        name="ServiceRegistrationDetail"
        component={ServiceRegistrationDetailScreen}
      />
      <Stack.Screen
        name="DesignRegistrationDetail"
        component={DesignRegistrationDetailScreen}
      />
      <Stack.Screen
        name="DesignTaskDetail"
        component={DesignTaskDetailScreen}
      />
      <Stack.Screen
        name="CustomerServiceProgressDetail"
        component={CustomerServiceProgressDetailScreen}
      />
      <Stack.Screen
        name="CareServicePackageDetail"
        component={CareServicePackageDetailScreen}
      />
    </>
  );

  const guestOnlyScreens = (): ReactElement => (
    <>
      <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'fade_from_bottom' }} />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="VerifyCode"
        component={VerifyCodeScreen}
        options={{ animation: 'fade_from_bottom' }}
      />
    </>
  );

  const roleOnlyScreens = (): ReactElement => (
    <>
      <Stack.Screen name="ShipperHome" component={ShipperHomeScreen} />
      <Stack.Screen name="ShippingList" component={ShippingListScreen} />
      <Stack.Screen name="ShipperOrderDetail" component={ShipperOrderDetailScreen} />
      <Stack.Screen name="CaretakerHome" component={CaretakerHomeScreen} />
      <Stack.Screen name="CaretakerTasks" component={CaretakerTasksScreen} />
      <Stack.Screen name="CaretakerDesignTasks" component={CaretakerDesignTasksScreen} />
      <Stack.Screen name="CaretakerTaskDetail" component={CaretakerTaskDetailScreen} />
      <Stack.Screen name="CaretakerRegistrationDetail" component={CaretakerRegistrationDetailScreen} />
      <Stack.Screen
        name="CaretakerDesignTaskDetail"
        component={CaretakerDesignTaskDetailScreen}
      />
      <Stack.Screen
        name="CaretakerDesignRegistrationDetail"
        component={CaretakerDesignRegistrationDetailScreen}
      />
    </>
  );

  return (
    <Stack.Navigator
      key={navigatorKey}
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {sharedScreens()}
      {isAuthenticated ? roleOnlyScreens() : guestOnlyScreens()}
      {/* Add more stack screens as needed:
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="CategoryPlants" component={CategoryPlantsScreen} />
        <Stack.Screen name="AIDesignResult" component={AIDesignResultScreen} />
      */}
    </Stack.Navigator>
  );
}
