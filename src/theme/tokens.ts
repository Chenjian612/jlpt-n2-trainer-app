import { Platform } from 'react-native';

export const colors = {
  background: '#F8F3E8',
  backgroundCard: '#FFFFFF',
  inkStrong: '#0F172A',
  inkBody: '#334155',
  inkMuted: '#64748B',
  hero: '#103B36',
  heroSoft: '#D7F5EE',
  heroLine: '#A7F3D0',
  heroHighlight: '#FDE68A',
  lineSoft: '#F1E6D4',
  warmCard: '#FFF8EE',
  teal: '#0F766E',
  tealSoft: '#DCFCE7',
  yellow: '#FBBF24',
  slateSoft: '#F1F5F9',
  barIdle: '#D1D5DB',
} as const;

export const fonts = {
  title: Platform.select({
    ios: 'AvenirNext-Bold',
    android: 'sans-serif-condensed',
    default: 'system-ui',
  }),
  body: Platform.select({
    ios: 'AvenirNext-Medium',
    android: 'sans-serif-medium',
    default: 'system-ui',
  }),
};

export const radii = {
  xl: 28,
  lg: 24,
  md: 20,
  sm: 16,
  pill: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;
