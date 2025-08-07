// Lighter, modern versions of your brand colors
export const Colors = {
  light: {
    // Primary - Lighter blue gradient
    primary: '#60A5FA',      // Lighter blue-400
    primaryDark: '#3B82F6',  // Original blue-500
    
    // Secondary - Lighter purple
    secondary: '#A78BFA',    // Lighter purple-400
    secondaryDark: '#8B5CF6', // purple-500
    
    // Background colors
    background: '#FFFFFF',
    backgroundSecondary: '#F8FAFC', // Very light gray
    card: '#FFFFFF',
    
    // Text colors
    text: '#1E293B',         // slate-800
    textSecondary: '#64748B', // slate-500
    textTertiary: '#94A3B8',  // slate-400
    
    // Accent colors
    success: '#34D399',      // emerald-400
    warning: '#FBBF24',      // amber-400
    error: '#F87171',        // red-400
    info: '#60A5FA',         // blue-400
    
    // Borders and dividers
    border: '#E2E8F0',       // slate-200
    divider: '#F1F5F9',      // slate-100
    
    // Special
    tabBar: '#FFFFFF',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#3B82F6',
  },
  dark: {
    // We'll implement dark mode later
    primary: '#60A5FA',
    secondary: '#A78BFA',
    background: '#0F172A',
    // ... rest of dark colors
  }
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Typography = {
  largeTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    letterSpacing: 0.374,
  },
  title1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: 0.364,
  },
  title2: {
    fontSize: 22,
    fontWeight: '600' as const,
    letterSpacing: 0.352,
  },
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.38,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.408,
  },
  body: {
    fontSize: 17,
    fontWeight: '400' as const,
    letterSpacing: -0.408,
  },
  callout: {
    fontSize: 16,
    fontWeight: '400' as const,
    letterSpacing: -0.32,
  },
  subhead: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: -0.24,
  },
  footnote: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: -0.078,
  },
  caption1: {
    fontSize: 12,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  caption2: {
    fontSize: 11,
    fontWeight: '400' as const,
    letterSpacing: 0.066,
  },
};