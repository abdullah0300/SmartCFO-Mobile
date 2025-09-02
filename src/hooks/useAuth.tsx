// src/hooks/useAuth.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import * as SecureStore from 'expo-secure-store';
import { BiometricService } from '../services/biometricService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithBiometric: () => Promise<boolean>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    checkSession();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Store session for persistence - CHANGED TO STORE ONLY REFRESH TOKEN
        if (session) {
          await SecureStore.setItemAsync('refresh_token', session.refresh_token);
        } else {
          await SecureStore.deleteItemAsync('refresh_token');
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    try {
      // First check for stored refresh token - CHANGED FROM supabase_session
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      
      if (refreshToken) {
        // Use refresh token to get session - CHANGED FROM JSON.parse
        const { data } = await supabase.auth.refreshSession({
          refresh_token: refreshToken
        });
        
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
        } else {
          // Token expired, clear stored data
          await SecureStore.deleteItemAsync('refresh_token');
        }
      } else {
        // No stored session, check with Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
          setUser(session.user);
          await SecureStore.setItemAsync('refresh_token', session.refresh_token);
        }
      }
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    setUser(data.user);
    setSession(data.session);
    
    // Store refresh token - CHANGED FROM FULL SESSION
    await SecureStore.setItemAsync('refresh_token', data.session.refresh_token);
  };

  const signInWithBiometric = async (): Promise<boolean> => {
    try {
      // Get credentials from biometric
      const credentials = await BiometricService.getCredentials();
      if (!credentials) return false;

      // Sign in with stored credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        // If password changed, disable biometric
        if (error.message.includes('Invalid login credentials')) {
          await BiometricService.disable();
        }
        throw error;
      }

      setUser(data.user);
      setSession(data.session);
      
      // Store refresh token - CHANGED FROM FULL SESSION
      await SecureStore.setItemAsync('refresh_token', data.session.refresh_token);
      
      return true;
    } catch (error) {
      console.error('Biometric sign in error:', error);
      return false;
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      setUser(data.user);
      setSession(data.session);
    }
  };

  const signOut = async () => {
    // Disable biometric on sign out
   
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    setUser(null);
    setSession(null);
    
    // Clear stored refresh token - CHANGED FROM supabase_session
    await SecureStore.deleteItemAsync('refresh_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signInWithBiometric,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}