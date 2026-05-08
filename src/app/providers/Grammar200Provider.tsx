import type { ReactNode } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { grammar200Repository } from '../../data/repositories/grammar200Repository';
import type {
  Grammar200ChapterId,
  Grammar200ProgressState,
  Grammar200SortAiExplanation,
  Grammar200SortQuestionId,
} from '../../domain/models/grammar200';

type Grammar200ContextValue = {
  isHydrated: boolean;
  state: Grammar200ProgressState;
  recordChapterCompletion: (
    chapterId: Grammar200ChapterId,
    score: number,
  ) => void;
  resetChapter: (chapterId: Grammar200ChapterId) => void;
  saveAiExplanation: (
    questionId: Grammar200SortQuestionId,
    explanation: Grammar200SortAiExplanation,
  ) => void;
};

const Grammar200Context = createContext<Grammar200ContextValue | null>(null);

type Grammar200ProviderProps = {
  children: ReactNode;
};

export function Grammar200Provider({ children }: Grammar200ProviderProps) {
  const [state, setState] = useState<Grammar200ProgressState>(() =>
    grammar200Repository.createDefaultState(),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const next = await grammar200Repository.load();
        if (isMounted) setState(next);
      } finally {
        if (isMounted) {
          hasLoadedRef.current = true;
          setIsHydrated(true);
        }
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    void grammar200Repository.save(state);
  }, [state]);

  const recordChapterCompletion = useCallback(
    (chapterId: Grammar200ChapterId, score: number) => {
      const completedAt = new Date().toISOString();
      setState((current) => {
        const existing = current.chapters[chapterId];
        const nextBest = Math.max(existing?.bestScore ?? 0, score);
        return {
          ...current,
          chapters: {
            ...current.chapters,
            [chapterId]: {
              chapterId,
              lastCompletedAt: completedAt,
              bestScore: nextBest,
              attemptCount: (existing?.attemptCount ?? 0) + 1,
            },
          },
        };
      });
    },
    [],
  );

  const resetChapter = useCallback((chapterId: Grammar200ChapterId) => {
    setState((current) => {
      if (!current.chapters[chapterId]) return current;
      const { [chapterId]: _removed, ...rest } = current.chapters;
      return { ...current, chapters: rest };
    });
  }, []);

  const saveAiExplanation = useCallback(
    (
      questionId: Grammar200SortQuestionId,
      explanation: Grammar200SortAiExplanation,
    ) => {
      setState((current) => ({
        ...current,
        aiExplanationCache: {
          ...current.aiExplanationCache,
          [questionId]: explanation,
        },
      }));
    },
    [],
  );

  const value = useMemo<Grammar200ContextValue>(
    () => ({
      isHydrated,
      state,
      recordChapterCompletion,
      resetChapter,
      saveAiExplanation,
    }),
    [isHydrated, state, recordChapterCompletion, resetChapter, saveAiExplanation],
  );

  return (
    <Grammar200Context.Provider value={value}>
      {children}
    </Grammar200Context.Provider>
  );
}

export function useGrammar200Store() {
  const context = useContext(Grammar200Context);
  if (!context) {
    throw new Error(
      'useGrammar200Store must be used within Grammar200Provider',
    );
  }
  return context;
}
