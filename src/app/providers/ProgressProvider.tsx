import type { ReactNode } from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { progressRepository } from '../../data/repositories/progressRepository';
import type { ProgressState } from '../../domain/models/progress';
import type {
  WrongAnswerDraft,
  WrongReviewDecision,
} from '../../domain/models/trainingContent';
import type {
  DrillModeId,
  ReviewModeId,
  TrainingModeId,
  TrainingSessionKind,
} from '../../domain/models/training';
import {
  clampWeeklyGoal,
  clearDay,
  createTrainingSession,
  createDefaultProgressState,
  getDayKey,
  recordDrillSessionResult,
  recordTrainingSession,
  recordWrongReviewSession,
  removeLatestSessionForMode,
} from '../../domain/services/progressService';

type ProgressContextValue = {
  isHydrated: boolean;
  state: ProgressState;
  todayKey: string;
  recordSession: (modeId: TrainingModeId, kind: TrainingSessionKind) => void;
  recordDrillSession: (
    modeId: DrillModeId,
    wrongAnswers: WrongAnswerDraft[],
  ) => void;
  completeWrongReviewSession: (
    modeId: ReviewModeId,
    decisions: WrongReviewDecision[],
  ) => void;
  removeLatestSession: (modeId: TrainingModeId) => void;
  clearToday: () => void;
  setWeeklyGoal: (goal: number) => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

type ProgressProviderProps = {
  children: ReactNode;
};

export function ProgressProvider({ children }: ProgressProviderProps) {
  const todayKey = getDayKey(new Date());
  const [state, setState] = useState<ProgressState>(createDefaultProgressState);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const loadState = async () => {
      try {
        const nextState = await progressRepository.load();

        if (isMounted) {
          setState(nextState);
        }
      } finally {
        if (isMounted) {
          hasLoadedRef.current = true;
          setIsHydrated(true);
        }
      }
    };

    void loadState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }

    void progressRepository.save(state);
  }, [state]);

  const value = useMemo<ProgressContextValue>(
    () => ({
      isHydrated,
      state,
      todayKey,
      recordSession: (modeId, kind) => {
        setState((current) =>
          recordTrainingSession(
            current,
            todayKey,
            createTrainingSession(todayKey, modeId, kind),
          ),
        );
      },
      recordDrillSession: (modeId, wrongAnswers) => {
        setState((current) =>
          recordDrillSessionResult(
            current,
            todayKey,
            modeId,
            'drill',
            wrongAnswers,
          ),
        );
      },
      completeWrongReviewSession: (modeId, decisions) => {
        setState((current) =>
          recordWrongReviewSession(current, todayKey, modeId, decisions),
        );
      },
      removeLatestSession: (modeId) => {
        setState((current) =>
          removeLatestSessionForMode(current, todayKey, modeId),
        );
      },
      clearToday: () => {
        setState((current) => clearDay(current, todayKey));
      },
      setWeeklyGoal: (goal) => {
        setState((current) => ({
          ...current,
          weeklyGoal: clampWeeklyGoal(goal),
        }));
      },
    }),
    [isHydrated, state, todayKey],
  );

  return (
    <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
  );
}

export function useProgressStore() {
  const context = useContext(ProgressContext);

  if (!context) {
    throw new Error('useProgressStore must be used within ProgressProvider');
  }

  return context;
}
