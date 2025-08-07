// App.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Auth Screens
import LoginScreen from './app/(auth)/login';

// Tab Screens
import DashboardScreen from './app/(tabs)/dashboard';
import IncomeScreen from './app/(tabs)/income';
import ExpensesScreen from './app/(tabs)/expenses';
import ProfileScreen from './app/(tabs)/profile';
import NotificationsScreen from './app/(tabs)/notifications';
import InvoicesScreen from './app/(tabs)/invoices';

// Stack Screens (Invoice related)
import InvoiceViewScreen from './src/screens/InvoiceViewScreen';
import CreateInvoiceScreen from './src/screens/CreateInvoiceScreen';
import RecurringInvoicesScreen from './src/screens/RecurringInvoicesScreen';
// import EditInvoiceScreen from './src/screens/EditInvoiceScreen';

// Management Screens
import ClientsScreen from './src/screens/ClientsScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';
import VendorsScreen from './src/screens/VendorsScreen';

// Components & Hooks
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { TabBar } from './src/components/navigation/TabBar';
import { FloatingActionBar } from './src/components/common/FloatingActionBar'; // ADD THIS LINE
import { Colors } from './src/constants/Colors';

// Type definitions for navigation
export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  InvoiceView: { invoiceId: string };
  CreateInvoice: undefined;
  EditInvoice: { invoiceId: string };
  RecurringInvoices: undefined;
  Clients: undefined;
  Categories: undefined;
  Vendors: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Income: undefined;
  Expenses: undefined;
  Invoices: undefined;
  Profile: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const queryClient = new QueryClient();

// Placeholder for unfinished screens
const PlaceholderScreen = () => (
  <View style={styles.placeholder}>
    <ActivityIndicator size="large" color={Colors.light.primary} />
  </View>
);

function TabNavigator() {
  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Income" component={IncomeScreen} />
        <Tab.Screen name="Expenses" component={ExpensesScreen} />
        <Tab.Screen name="Invoices" component={InvoicesScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
        <Tab.Screen name="Notifications" component={NotificationsScreen} />
      </Tab.Navigator>
      <FloatingActionBar /> 
    </>
  );
}

function AuthNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen 
            name="InvoiceView" 
            component={InvoiceViewScreen}
            options={{ 
              animation: 'slide_from_right',
              presentation: 'card' 
            }}
          />
          <Stack.Screen 
            name="CreateInvoice" 
            component={CreateInvoiceScreen}
            options={{ 
              animation: 'slide_from_bottom',
              presentation: 'modal' 
            }}
          />
          <Stack.Screen 
            name="RecurringInvoices" 
            component={RecurringInvoicesScreen}
            options={{ headerShown: false }}
          />
          {/* <Stack.Screen 
            name="EditInvoice" 
            component={EditInvoiceScreen || PlaceholderScreen}
            options={{ 
              animation: 'slide_from_right',
              presentation: 'card' 
            }}
          /> */}
          <Stack.Screen 
            name="Clients" 
            component={ClientsScreen}
            options={{ 
              animation: 'slide_from_right',
              presentation: 'card' 
            }}
          />
          <Stack.Screen 
            name="Categories" 
            component={CategoriesScreen || PlaceholderScreen}
            options={{ 
              animation: 'slide_from_right',
              presentation: 'card' 
            }}
          />
          <Stack.Screen 
            name="Vendors" 
            component={VendorsScreen || PlaceholderScreen}
            options={{ 
              animation: 'slide_from_right',
              presentation: 'card' 
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SettingsProvider>
              <NavigationContainer>
                <StatusBar style="dark" />
                <AuthNavigator />
              </NavigationContainer>
            </SettingsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});