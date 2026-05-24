export const colors = {
  background: '#000000',
  surface: '#0f0f0f',
  card: '#141414',
  cardElevated: '#1a1a1a',
  border: '#222222',
  borderLight: '#2a2a2a',

  text: '#ffffff',
  textSecondary: '#888888',
  textMuted: '#555555',
  textDisabled: '#333333',

  primary: '#ffffff',
  accent: '#e0e0e0',

  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',

  power: '#ff6b35',
  craft: '#7c4dff',
  mind: '#00bcd4',
  purity: '#66bb6a',
  consistency: '#ffd54f',

  overlay: 'rgba(0,0,0,0.85)',
  overlayLight: 'rgba(0,0,0,0.5)',

  inputBg: '#111111',
  inputBorder: '#2a2a2a',
  inputFocusBorder: '#555555',

  badgeBg: '#1f1f1f',
  badgeText: '#cccccc',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: '600' as const },
  h4: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5 },
  button: { fontSize: 15, fontWeight: '600' as const },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
};

export const theme = { colors, spacing, radius, typography, shadows };
export default theme;
