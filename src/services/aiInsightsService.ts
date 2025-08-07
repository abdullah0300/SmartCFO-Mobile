import { supabase } from './supabase';

export interface AIInsight {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'info' | 'urgent';
  category: 'cash_flow' | 'collections' | 'spending' | 'revenue' | 'clients' | 'strategy';
  priority: number;
  action?: {
    label: string;
    link: string;
  };
}

export interface InsightsResponse {
  insights: AIInsight[];
  generated_at: string;
  source: 'cache' | 'contextual_ai' | 'ai';
  needsContext?: boolean;
  missingFields?: any[];
  message?: string;
}

export const getAIInsights = async (userId: string): Promise<AIInsight[]> => {
  try {
    console.log('Fetching AI insights for user:', userId);
    
    // Get the session token for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('Session error:', sessionError);
      throw new Error('Authentication required');
    }

    // Call the edge function with proper authentication
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        userId: userId,
        feature: 'get_insights'
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    console.log('AI Response:', data);

    if (error) {
      console.error('AI Edge Function Error:', error);
      throw error;
    }
    
    // Handle the response based on your edge function's structure
    if (data?.success === false) {
      throw new Error(data.error || 'Failed to get insights');
    }

    // Check if context is needed
    if (data?.needsContext) {
      console.log('User needs to provide context');
      return [];
    }

    // Extract insights from the response
    const insights = data?.insights || [];
    
    // Transform the insights to match the mobile app interface
    return insights.map((insight: any) => ({
      id: insight.id,
      title: insight.title,
      message: insight.message,
      type: insight.type,
      category: insight.category,
      priority: insight.priority,
      action: insight.action
    }));

  } catch (error) {
    console.error('Error fetching AI insights:', error);
    
    // Return empty array instead of fallback to avoid confusion
    return [];
  }
};

// Additional helper to check if user needs context
export const checkUserContext = async (userId: string) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No session');

    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        userId: userId,
        feature: 'get_missing_context'
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error checking context:', error);
    return { hasAllContext: true, missingFields: [] };
  }
};