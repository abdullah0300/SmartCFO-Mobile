// src/services/supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Helper functions for crypto polyfill
function arrayBufferToString(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  let binaryString = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }
  return binaryString;
}

function hexStringToArrayBuffer(hexString: string): ArrayBuffer {
  // Remove any spaces and convert hex string to ArrayBuffer
  const cleanHex = hexString.replace(/\s/g, '');
  const buffer = new ArrayBuffer(cleanHex.length / 2);
  const uint8Array = new Uint8Array(buffer);

  for (let i = 0; i < cleanHex.length; i += 2) {
    uint8Array[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }

  return buffer;
}

// Polyfill for crypto.getRandomValues
if (!global.crypto) {
  global.crypto = {} as any;
}

if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = function <T extends ArrayBufferView>(array: T): T {
    // expo-crypto's getRandomBytes returns a Uint8Array
    const randomBytes = Crypto.getRandomBytes(array.byteLength);

    // Copy the random bytes into the provided array
    const uint8Array = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    uint8Array.set(randomBytes);

    return array;
  };
}

// Polyfill for crypto.subtle (for PKCE)
if (!global.crypto.subtle) {
  global.crypto.subtle = {
    digest: async (algorithm: string | { name: string }, data: BufferSource): Promise<ArrayBuffer> => {
      // Convert BufferSource to string for expo-crypto
      let inputString: string;

      if (typeof data === 'string') {
        inputString = data;
      } else if (data instanceof ArrayBuffer) {
        inputString = arrayBufferToString(data);
      } else if (ArrayBuffer.isView(data)) {
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        inputString = arrayBufferToString(buffer);
      } else {
        throw new Error('Unsupported data type for digest');
      }

      // Get the hash as hex string from expo-crypto
      const hashHex = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        inputString
      );

      // Convert hex string to ArrayBuffer
      return hexStringToArrayBuffer(hashHex);
    },
  } as any;
}

// Your Supabase credentials
const supabaseUrl = 'https://adsbnzqorfmgnneiopcr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkc2JuenFvcmZtZ25uZWlvcGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3NzM1NzAsImV4cCI6MjA2NDM0OTU3MH0.To7RgYgKu1yKVBSNVYzvce92kcLAXW0G_9jppFdeaU4';

// Chunked Secure Storage Adapter to handle large tokens
const ChunkedSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      // Try to get the item directly first (for backward compatibility)
      const directValue = await SecureStore.getItemAsync(key);
      if (directValue) {
        return directValue;
      }

      // If not found, try to get chunked value
      const chunks = await SecureStore.getItemAsync(`${key}_chunks`);
      if (!chunks) {
        return null;
      }

      const chunkCount = parseInt(chunks, 10);
      let value = '';
      
      for (let i = 0; i < chunkCount; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
        if (chunk) {
          value += chunk;
        }
      }

      return value || null;
    } catch (error) {
      console.error('Error getting item from SecureStore:', error);
      // Fallback to AsyncStorage if SecureStore fails
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const chunkSize = 2000; // Stay well below 2048 limit
      
      // If value is small enough, store directly
      if (value.length < chunkSize) {
        await SecureStore.setItemAsync(key, value);
        // Clean up any old chunks
        const oldChunks = await SecureStore.getItemAsync(`${key}_chunks`);
        if (oldChunks) {
          const chunkCount = parseInt(oldChunks, 10);
          for (let i = 0; i < chunkCount; i++) {
            await SecureStore.deleteItemAsync(`${key}_${i}`);
          }
          await SecureStore.deleteItemAsync(`${key}_chunks`);
        }
        return;
      }

      // For large values, split into chunks
      const chunks = Math.ceil(value.length / chunkSize);
      await SecureStore.setItemAsync(`${key}_chunks`, chunks.toString());

      for (let i = 0; i < chunks; i++) {
        const chunk = value.slice(i * chunkSize, (i + 1) * chunkSize);
        await SecureStore.setItemAsync(`${key}_${i}`, chunk);
      }

      // Remove direct value if it exists
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {
        // Ignore if doesn't exist
      }
    } catch (error) {
      console.error('Error setting item in SecureStore:', error);
      // Fallback to AsyncStorage if SecureStore fails
      await AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      // Remove direct value
      await SecureStore.deleteItemAsync(key);

      // Remove chunked values if they exist
      const chunks = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunks) {
        const chunkCount = parseInt(chunks, 10);
        for (let i = 0; i < chunkCount; i++) {
          await SecureStore.deleteItemAsync(`${key}_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }
    } catch (error) {
      console.error('Error removing item from SecureStore:', error);
      // Also try to remove from AsyncStorage
      await AsyncStorage.removeItem(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ChunkedSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,  // Disabled - we handle OAuth callbacks manually in App.tsx
    flowType: 'pkce',
  },
});