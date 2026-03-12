import { Platform } from 'react-native';

export const colors = {
  background: '#F5EDDF',
  backgroundCard: '#FFFDF8',
  backgroundCardMuted: '#F4EBDD',
  inkStrong: '#17211D',
  inkBody: '#3F4B46',
  inkMuted: '#6E7974',
  inkSoft: '#958879',
  hero: '#173A35',
  heroSoft: '#E3F4ED',
  heroLine: '#9FD8C8',
  heroHighlight: '#F0C36B',
  lineSoft: '#E6D5BC',
  lineStrong: '#CFB998',
  warmCard: '#F7EEE1',
  teal: '#165E56',
  tealSoft: '#DCEFE7',
  yellow: '#E8B65E',
  copper: '#A35A3C',
  plum: '#5D5067',
  mist: '#EEF3EF',
  slateSoft: '#ECE7DE',
  barIdle: '#D1CBC1',
} as const;

export const fonts = {
  title: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'Georgia, "Times New Roman", serif',
  }),
  body: Platform.select({
    ios: 'AvenirNext-Medium',
    android: 'sans-serif',
    default: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif',
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
  card:
    Platform.OS === 'web'
      ? {
          boxShadow: '0px 16px 32px rgba(41, 31, 19, 0.12)',
        }
      : {
          shadowColor: '#2B2218',
          shadowOpacity: 0.12,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 12 },
          elevation: 8,
        },
} as const;
