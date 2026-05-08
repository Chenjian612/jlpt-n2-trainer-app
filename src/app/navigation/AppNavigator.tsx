import { startTransition, useState } from 'react';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { DrillSessionScreen } from '../../features/drill-session/screens/DrillSessionScreen';
import { DashboardScreen } from '../../features/dashboard/screens/DashboardScreen';
import { Grammar200Screen } from '../../features/grammar-200/screens/Grammar200Screen';
import { ListeningSessionScreen } from '../../features/listening-session/screens/ListeningSessionScreen';
import { ModeDetailScreen } from '../../features/mode-detail/screens/ModeDetailScreen';
import { OfficialVocabMemoryScreen } from '../../features/official-vocab-memory/screens/OfficialVocabMemoryScreen';
import { ReadingSessionScreen } from '../../features/reading-session/screens/ReadingSessionScreen';
import { StudyPackScreen } from '../../features/study-pack/screens/StudyPackScreen';
import { TrainingSessionScreen } from '../../features/training-session/screens/TrainingSessionScreen';
import { WrongReviewScreen } from '../../features/wrong-review/screens/WrongReviewScreen';
import {
  isDrillModeId,
  isGrammar200ModeId,
  isListeningModeId,
  isOfficialVocabMemoryModeId,
  isReadingModeId,
  isReviewModeId,
  isStudyModeId,
  type TrainingMode,
  type TrainingModeId,
} from '../../domain/models/training';
import { useProgressStore } from '../providers/ProgressProvider';

type Route =
  | { name: 'dashboard' }
  | { name: 'mode-detail'; modeId: TrainingModeId }
  | {
      name: 'training-session';
      modeId: TrainingModeId;
      returnTo: 'dashboard' | 'mode-detail';
    };

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

  const openModeDetail = (modeId: TrainingModeId) => {
    startTransition(() => {
      setRoute({ name: 'mode-detail', modeId });
    });
  };

  const startModeSession = (
    modeId: TrainingModeId,
    returnTo: 'dashboard' | 'mode-detail',
  ) => {
    startTransition(() => {
      setRoute({ name: 'training-session', modeId, returnTo });
    });
  };

  const goBack = () => {
    startTransition(() => {
      setRoute({ name: 'dashboard' });
    });
  };

  const leaveSession = (
    modeId: TrainingModeId,
    returnTo: 'dashboard' | 'mode-detail',
  ) => {
    startTransition(() => {
      setRoute(
        returnTo === 'mode-detail'
          ? { name: 'mode-detail', modeId }
          : { name: 'dashboard' },
      );
    });
  };

  if (route.name === 'mode-detail') {
    return (
      <ModeDetailScreen
        modeId={route.modeId}
        onBack={goBack}
        onStartSession={(modeId) => startModeSession(modeId, 'mode-detail')}
      />
    );
  }

  if (route.name === 'training-session') {
    if (isDrillModeId(route.modeId)) {
      return (
        <DrillSessionScreen
          modeId={route.modeId}
          onExit={() => leaveSession(route.modeId, route.returnTo)}
          onBackToDetail={() => openModeDetail(route.modeId)}
          onBackToDashboard={goBack}
        />
      );
    }

    if (isReadingModeId(route.modeId)) {
      return (
        <ReadingSessionScreen
          modeId={route.modeId}
          onExit={() => leaveSession(route.modeId, route.returnTo)}
          onBackToDetail={() => openModeDetail(route.modeId)}
          onBackToDashboard={goBack}
        />
      );
    }

    if (isListeningModeId(route.modeId)) {
      return (
        <ListeningSessionScreen
          modeId={route.modeId}
          onExit={() => leaveSession(route.modeId, route.returnTo)}
          onBackToDetail={() => openModeDetail(route.modeId)}
          onBackToDashboard={goBack}
        />
      );
    }

    if (isOfficialVocabMemoryModeId(route.modeId)) {
      return (
        <OfficialVocabMemoryScreen
          modeId={route.modeId}
          onExit={() => leaveSession(route.modeId, route.returnTo)}
          onBackToDetail={() => openModeDetail(route.modeId)}
          onBackToDashboard={goBack}
        />
      );
    }

    if (isReviewModeId(route.modeId)) {
      return (
        <WrongReviewScreen
          modeId={route.modeId}
          onExit={() => leaveSession(route.modeId, route.returnTo)}
          onBackToDetail={() => openModeDetail(route.modeId)}
          onBackToDashboard={goBack}
        />
      );
    }

    if (isGrammar200ModeId(route.modeId)) {
      return (
        <Grammar200Screen
          modeId={route.modeId}
          onExit={() => leaveSession(route.modeId, route.returnTo)}
          onBackToDetail={() => openModeDetail(route.modeId)}
          onBackToDashboard={goBack}
        />
      );
    }

    if (isStudyModeId(route.modeId)) {
      return (
        <StudyPackScreen
          modeId={route.modeId}
          onExit={() => leaveSession(route.modeId, route.returnTo)}
          onBackToDetail={() => openModeDetail(route.modeId)}
          onBackToDashboard={goBack}
        />
      );
    }

    return (
      <TrainingSessionScreen
        modeId={route.modeId}
        onExit={() => leaveSession(route.modeId, route.returnTo)}
        onBackToDetail={() => openModeDetail(route.modeId)}
        onBackToDashboard={goBack}
      />
    );
  }

  return (
    <DashboardScreen
      onOpenMode={openMode}
      onStartMode={(mode) => startModeSession(mode.id, 'dashboard')}
    />
  );
}
