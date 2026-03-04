import { startTransition, useState } from 'react';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { DashboardScreen } from '../../features/dashboard/screens/DashboardScreen';
import { ModeDetailScreen } from '../../features/mode-detail/screens/ModeDetailScreen';
import type { TrainingMode, TrainingModeId } from '../../domain/models/training';
import { useProgressStore } from '../providers/ProgressProvider';

type Route =
  | { name: 'dashboard' }
  | { name: 'mode-detail'; modeId: TrainingModeId };

export function AppNavigator() {
  const { isHydrated } = useProgressStore();
  const [route, setRoute] = useState<Route>({ name: 'dashboard' });

  if (!isHydrated) {
    return <LoadingScreen />;
  }

  const openMode = (mode: TrainingMode) => {
    startTransition(() => {
      setRoute({ name: 'mode-detail', modeId: mode.id });
    });
  };

  const goBack = () => {
    startTransition(() => {
      setRoute({ name: 'dashboard' });
    });
  };

  if (route.name === 'mode-detail') {
    return <ModeDetailScreen modeId={route.modeId} onBack={goBack} />;
  }

  return <DashboardScreen onOpenMode={openMode} />;
}
