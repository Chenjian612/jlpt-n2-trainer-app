import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppBackground } from './AppBackground';
import { colors, fonts } from '../../theme/tokens';

export function LoadingScreen() {
  return (
    <AppBackground>
      <View style={styles.container}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.text}>正在载入你的 N2 训练节奏...</Text>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    fontSize: 16,
    color: colors.inkBody,
    fontFamily: fonts.body,
  },
});
