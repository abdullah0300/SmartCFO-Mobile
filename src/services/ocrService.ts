// src/services/ocrService.ts
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './api';
import { Alert } from 'react-native';

interface OCRResult {
  amount?: number;
  vendor?: string;
  date?: string | null;
  description?: string;
  items?: string[];
  paymentMethod?: string;
}

export class OCRService {
  // Add the missing camera method
  static async pickImageFromCamera(): Promise<string | null> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is required to scan receipts');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return null;
    return result.assets[0].uri;
  }

  // Add the missing gallery method
  static async pickImageFromGallery(): Promise<string | null> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Gallery permission is required to select receipts');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return null;
    return result.assets[0].uri;
  }

  static async processReceipt(imageUri: string): Promise<OCRResult> {
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1000 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!compressed.base64) {
        throw new Error('Failed to process image');
      }

      const { data, error } = await supabase.functions.invoke('process-receipt', {
        body: { image: compressed.base64 }
      });

      if (error) {
        console.error('OCR Edge Function Error:', error);
        throw error;
      }

      // Return all the data from OCR with proper defaults
      return {
        amount: data?.amount || 0,
        vendor: data?.vendor || '',
        date: data?.date || null,
        description: data?.description || '',
        items: data?.items || [],
        paymentMethod: data?.paymentMethod || ''
      };
    } catch (error) {
      console.error('OCR Error:', error);
      
      Alert.alert(
        'Receipt Scanning Issue', 
        'Some details could not be extracted. Please verify the information.',
        [{ text: 'OK' }]
      );
      
      return {
        amount: 0,
        vendor: '',
        date: null,
        description: '',
        items: []
      };
    }
  }
}