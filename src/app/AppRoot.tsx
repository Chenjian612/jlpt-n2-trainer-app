import { StatusBar } from 'expo-status-bar';

import { AppNavigator } from './navigation/AppNavigator';
import { ProgressProvider } from './providers/ProgressProvider';

export function AppRoot() {
  return (
    <ProgressProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </ProgressProvider>
  );
}
