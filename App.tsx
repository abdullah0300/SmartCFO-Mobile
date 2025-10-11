// App.tsx
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as ExpoSplashScreen from 'expo-splash-screen';
import SplashScreen from './src/screens/SplashScreen';

// Auth Screens
import LoginScreen from './app/(auth)/login';

// Tab Screens
import DashboardScreen from './app/(tabs)/dashboard';
import IncomeScreen from './app/(tabs)/income';
import ExpensesScreen from './app/(tabs)/expenses';
import ProfileScreen from './app/(tabs)/profile';
import NotificationsScreen from './app/(tabs)/notifications';
import InvoicesScreen from './app/(tabs)/invoices';
import TransactionDetailScreen from './src/screens/TransactionDetailScreen';

// Stack Screens (Invoice related)
import InvoiceViewScreen from './src/screens/InvoiceViewScreen';
import CreateInvoiceScreen from './src/screens/CreateInvoiceScreen';
import RecurringInvoicesScreen from './src/screens/RecurringInvoicesScreen';

// Management Screens
import ClientsScreen from './src/screens/ClientsScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';
import VendorsScreen from './src/screens/VendorsScreen';

// Loan Screens
import LoansScreen from './src/screens/LoansScreen';
import LoanDetailScreen from './src/screens/LoanDetailScreen';
import CreateLoanScreen from './src/screens/CreateLoanScreen';

// Components & Hooks
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { TabBar } from './src/components/navigation/TabBar';
import { FloatingActionBar } from './src/components/common/FloatingActionBar';
import { Colors } from './src/constants/Colors';
import { supabase } from './src/services/supabase';
import InvoiceSettingsScreen from './src/screens/InvoiceSettingsScreen';
import RecurringInvoiceEditScreen from './src/screens/RecurringInvoiceEditScreen';
import ClientDetailScreen from './src/screens/ClientDetailScreen';
import BudgetScreen from './src/screens/BudgetScreen';
import ReportsOverviewScreen from './src/screens/ReportsOverviewScreen';

// Prevent the native splash screen from auto-hiding
ExpoSplashScreen.preventAutoHideAsync();

// Type definitions for navigation
export type RootStackParamList = {
  Main: undefined;
  Login: undefined;
  InvoiceView: { invoiceId: string };
  CreateInvoice: {
    invoiceId?: string;
    recurringId?: string;
    templateData?: any;
    clientId?: string;
  } | undefined;
  RecurringInvoices: undefined;
  RecurringInvoiceEdit: { recurringId: string };
  Clients: undefined;
  ClientDetail: { clientId: string };
  Budget: undefined;
  Categories: undefined;
  Vendors: undefined;
  ReportsOverview: undefined;
  TransactionDetail: { transactionId: string; type: 'income' | 'expense' };
  EditTransaction: { transactionId: string; type: 'income' | 'expense' };
  InvoiceSettings: undefined;
  Loans: undefined;
  LoanDetail: { loanId: string };
  CreateLoan: { loanId?: string } | undefined;
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

  // Handle OAuth deep link redirects
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      console.log('🔗 Deep link received:', url);

      // Only process smartcfo:// scheme URLs (our custom scheme)
      if (!url.startsWith('smartcfo://')) {
        console.log('ℹ️ Not a smartcfo deep link, ignoring');
        return;
      }

      try {
        // Extract URL parameters - check both # (implicit) and ? (PKCE) parameters
        let params: URLSearchParams;

        if (url.includes('#')) {
          // Implicit flow: tokens in fragment
          const fragment = url.split('#')[1];
          params = new URLSearchParams(fragment);
        } else if (url.includes('?')) {
          // PKCE flow: code in query params
          const query = url.split('?')[1];
          params = new URLSearchParams(query);
        } else {
          console.log('ℹ️ No OAuth parameters in URL');
          return;
        }

        console.log('📄 OAuth params found:', Array.from(params.keys()).join(', '));

        // Check for errors
        const errorCode = params.get('error');
        const errorDescription = params.get('error_description');

        if (errorCode) {
          console.error('❌ OAuth error:', errorCode, errorDescription);
          return;
        }

        // Handle implicit flow (direct tokens)
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('✅ Tokens found in URL (implicit flow)');
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('❌ Error setting session:', error.message);
          } else {
            console.log('✅ OAuth session established!');
            console.log('👤 User:', data.user?.email);
          }
          return;
        }

        // The onAuthStateChange listener in useAuth will handle the session update
        console.log('✅ OAuth callback processed');

      } catch (error: any) {
        console.error('❌ Error processing deep link:', error.message);
      }
    };

    // Listen for deep link events
    const subscription = Linking.addEventListener('url', handleUrl);

    // Check if app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🚀 App opened with initial URL');
        handleUrl({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
          <Stack.Screen 
            name="RecurringInvoiceEdit" 
            component={RecurringInvoiceEditScreen}
            options={{ 
              headerShown: false,
              animation: 'slide_from_right',
              presentation: 'card'
            }}
          />
          <Stack.Screen 
            name="Clients" 
            component={ClientsScreen}
            options={{ 
              animation: 'slide_from_right',
              presentation: 'card' 
            }}
          />
          <Stack.Screen 
            name="ClientDetail" 
            component={ClientDetailScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Budget" 
            component={BudgetScreen}
            options={{ 
              headerShown: false,
              animation: 'slide_from_right',
              presentation: 'card'
            }}
          />
          <Stack.Screen 
            name="ReportsOverview" 
            component={ReportsOverviewScreen}
            options={{ 
              headerShown: false,
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
          <Stack.Screen
            name="Loans"
            component={LoansScreen}
            options={{
              animation: 'slide_from_right',
              presentation: 'card',
              headerShown: false
            }}
          />
          <Stack.Screen
            name="LoanDetail"
            component={LoanDetailScreen}
            options={{
              animation: 'slide_from_right',
              presentation: 'card',
              headerShown: false
            }}
          />
          <Stack.Screen
            name="CreateLoan"
            component={CreateLoanScreen}
            options={{
              animation: 'slide_from_bottom',
              presentation: 'modal',
              headerShown: false
            }}
          />
          <Stack.Screen
            name="TransactionDetail"
            component={TransactionDetailScreen}
            options={{ 
              animation: 'slide_from_right',
              presentation: 'card' 
            }}
          />
          <Stack.Screen 
            name="InvoiceSettings" 
            component={InvoiceSettingsScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // You can do other async operations here like:
        // - Load fonts
        // - Load cached data
        // - Preload assets
        
        // Artificially delay for demo purposes (remove in production)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the app that it's ready to hide native splash
        setAppIsReady(true);
        // Hide the native splash screen
        await ExpoSplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  // Don't render anything until the app is ready
  if (!appIsReady) {
    return null;
  }

  // Show custom splash screen
  if (showSplash) {
    return <SplashScreen onAnimationComplete={handleSplashComplete} />;
  }

  // Show main app
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