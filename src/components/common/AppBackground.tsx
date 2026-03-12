import type { ReactNode } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { colors } from '../../theme/tokens';

type AppBackgroundProps = {
  children: ReactNode;
};

export function AppBackground({ children }: AppBackgroundProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.background}>
        <View style={styles.topMist} />
        <View style={styles.cornerPool} />
        <View style={styles.sideRibbon} />
        <View style={styles.bottomPool} />
        <View style={styles.paperRing} />
        <View style={styles.horizonLine} />
      </View>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  topMist: {
    position: 'absolute',
    top: -180,
    right: -90,
    width: 430,
    height: 430,
    borderRadius: 215,
    backgroundColor: '#EFD3A1',
    opacity: 0.44,
  },
  cornerPool: {
    position: 'absolute',
    top: 120,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#D9EEE8',
    opacity: 0.78,
  },
  sideRibbon: {
    position: 'absolute',
    top: 180,
    left: -130,
    width: 240,
    height: 520,
    borderRadius: 140,
    backgroundColor: '#F1E3CE',
    opacity: 0.78,
    transform: [{ rotate: '18deg' }],
  },
  bottomPool: {
    position: 'absolute',
    bottom: 80,
    left: -70,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#D8EDE4',
    opacity: 0.64,
  },
  paperRing: {
    position: 'absolute',
    bottom: -80,
    right: 40,
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 26,
    borderColor: 'rgba(207, 185, 152, 0.26)',
  },
  horizonLine: {
    position: 'absolute',
    top: 122,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(207, 185, 152, 0.34)',
  },
});
