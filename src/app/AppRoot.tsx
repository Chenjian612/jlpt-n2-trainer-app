import { StatusBar } from 'expo-status-bar';

import { AppNavigator } from './navigation/AppNavigator';
import { Grammar200Provider } from './providers/Grammar200Provider';
import { ProgressProvider } from './providers/ProgressProvider';

export function AppRoot() {
  return (
    <ProgressProvider>
      <Grammar200Provider>
        <StatusBar style="dark" />
        <AppNavigator />
      </Grammar200Provider>
    </ProgressProvider>
  );
}
