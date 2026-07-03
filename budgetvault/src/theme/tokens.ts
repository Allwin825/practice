export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentLight: string;
  accentText: string;
  danger: string;
  success: string;
  warning: string;
  warningBg: string;
  warningText: string;
  chipBg: string;
  chipActiveBg: string;
  chipActiveText: string;
}

export const lightColors: ColorTokens = {
  bg: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F4F6',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  text: '#1F2937',
  textSecondary: '#374151',
  textMuted: '#9CA3AF',
  accent: '#1A3C5E',
  accentLight: '#EFF6FF',
  accentText: '#1A3C5E',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#EAB308',
  warningBg: '#FEF3C7',
  warningText: '#92400E',
  chipBg: '#F3F4F6',
  chipActiveBg: '#1A3C5E',
  chipActiveText: '#FFFFFF',
};

export const darkColors: ColorTokens = {
  bg: '#111827',
  surface: '#1F2937',
  surfaceAlt: '#374151',
  border: '#374151',
  borderLight: '#2D3748',
  text: '#F9FAFB',
  textSecondary: '#E5E7EB',
  textMuted: '#6B7280',
  accent: '#60A5FA',
  accentLight: '#1E3A5F',
  accentText: '#93C5FD',
  danger: '#F87171',
  success: '#4ADE80',
  warning: '#FBBF24',
  warningBg: '#451A03',
  warningText: '#FDE68A',
  chipBg: '#374151',
  chipActiveBg: '#2563EB',
  chipActiveText: '#FFFFFF',
};
