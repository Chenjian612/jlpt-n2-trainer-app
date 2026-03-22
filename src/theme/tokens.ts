import { Platform } from 'react-native';

export const colors = {
  background: '#EAE3D6',
  backgroundCard: '#FFFFFF',
  backgroundCardMuted: '#F4EBE0',
  inkStrong: '#17211D',
  inkBody: '#3F4B46',
  inkMuted: '#6E7974',
  inkSoft: '#958879',
  hero: '#173A35',
  heroSoft: '#E0F3EC',
  heroLine: '#8FD1BF',
  heroHighlight: '#F0C252',
  lineSoft: '#DDD0BD',
  lineStrong: '#C8B28E',
  warmCard: '#FAF2E7',
  teal: '#145C50',
  tealSoft: '#D8EDE8',
  yellow: '#E8B34E',
  copper: '#A35A3C',
  plum: '#5D5067',
  mist: '#ECF2EE',
  slateSoft: '#EAE4DC',
  barIdle: '#CEC8BF',
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
          boxShadow: '0px 1px 3px rgba(41, 31, 19, 0.05), 0px 4px 16px rgba(41, 31, 19, 0.08)',
        }
      : {
          shadowColor: '#2B2218',
          shadowOpacity: 0.10,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 5,
        },
} as const;
