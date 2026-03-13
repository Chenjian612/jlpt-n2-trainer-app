import type {
  ProgressState,
  SessionsByDay,
  TrainingSessionRecord,
} from '../models/progress';
import type {
  WeaknessErrorType,
  WeaknessSignalDraft,
  WeaknessSignalItem,
  WrongAnswerDraft,
  WrongAnswerErrorType,
  WrongAnswerItem,
  WrongReviewDecision,
} from '../models/trainingContent';
import type {
  DrillModeId,
  ReviewModeId,
  TrainingModeId,
  TrainingSessionKind,
} from '../models/training';
import {
  REVIEW_SOURCE_MODE,
  isDrillModeId,
  isListeningModeId,
  isReadingModeId,
} from '../models/training';
import {
  inferModeWeaknessErrorTypes,
  inferWrongAnswerErrorTypes,
  isWeaknessErrorType,
  isWrongAnswerErrorType,
} from './wrongAnswerClassifier';

export const DEFAULT_WEEKLY_GOAL = 14;
const MAX_HISTORY_DAYS = 45;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const VALID_MODE_IDS = new Set<TrainingModeId>([
  'grammar_drill',
  'grammar_study',
  'vocab_drill',
  'vocab_study',
  'reading_drill',
  'listening_analyze',
  'review_wrong',
  'vocab_review_wrong',
]);
const VALID_SESSION_KINDS = new Set<TrainingSessionKind>([
  'drill',
  'study',
  'review',
]);
const SESSION_KIND_BY_MODE: Record<TrainingModeId, TrainingSessionKind> = {
  grammar_drill: 'drill',
  grammar_study: 'study',
  vocab_drill: 'drill',
  vocab_study: 'study',
  reading_drill: 'drill',
  listening_analyze: 'drill',
  review_wrong: 'review',
  vocab_review_wrong: 'review',
};

type LegacyCompletedByDay = Partial<Record<string, TrainingModeId[]>>;
type LegacyProgressState = Partial<ProgressState> & {
  completedByDay?: LegacyCompletedByDay;
};

export const createDefaultProgressState = (): ProgressState => ({
  weeklyGoal: DEFAULT_WEEKLY_GOAL,
  sessionsByDay: {},
  wrongAnswers: [],
  weaknessSignals: [],
});

export const getDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const clampWeeklyGoal = (goal: number): number =>
  Math.max(6, Math.min(28, Math.round(goal)));

const parseDayKey = (dayKey: string): Date => {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, amount: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const diffInDays = (left: Date, right: Date): number =>
  Math.round(
    (startOfDay(left).getTime() - startOfDay(right).getTime()) / MS_PER_DAY,
  );

const diffFromNowInDays = (iso: string): number => {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    return 999;
  }

  return Math.max(0, diffInDays(new Date(), parsed));
};

const buildLegacyCompletedAt = (dayKey: string, index: number): string =>
  `${dayKey}T${String(9 + Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00`;

const sortSessions = (
  sessions: TrainingSessionRecord[],
): TrainingSessionRecord[] =>
  [...sessions].sort((left, right) =>
    left.completedAt.localeCompare(right.completedAt),
  );

const createSessionId = (
  dayKey: string,
  modeId: TrainingModeId,
  salt: string,
): string => `${dayKey}:${modeId}:${salt}`;

const isValidModeId = (value: unknown): value is TrainingModeId =>
  typeof value === 'string' && VALID_MODE_IDS.has(value as TrainingModeId);

const isValidSessionKind = (value: unknown): value is TrainingSessionKind =>
  typeof value === 'string' &&
  VALID_SESSION_KINDS.has(value as TrainingSessionKind);

const getDefaultSessionKind = (
  modeId: TrainingModeId,
): TrainingSessionKind => SESSION_KIND_BY_MODE[modeId];

const normalizeSessionRecord = (
  value: unknown,
  dayKey: string,
  index: number,
): TrainingSessionRecord | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const parsed = value as Partial<TrainingSessionRecord>;

  if (!isValidModeId(parsed.modeId)) {
    return null;
  }

  const completedAt =
    typeof parsed.completedAt === 'string' && parsed.completedAt.length > 0
      ? parsed.completedAt
      : buildLegacyCompletedAt(dayKey, index);

  return {
    id:
      typeof parsed.id === 'string' && parsed.id.length > 0
        ? parsed.id
        : createSessionId(dayKey, parsed.modeId, `${completedAt}:${index}`),
    modeId: parsed.modeId,
    completedAt,
    kind: isValidSessionKind(parsed.kind)
      ? parsed.kind
      : getDefaultSessionKind(parsed.modeId),
  };
};

const normalizeSessionsByDay = (value: unknown): SessionsByDay => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const next: SessionsByDay = {};

  for (const [dayKey, sessions] of Object.entries(value)) {
    if (!Array.isArray(sessions)) {
      continue;
    }

    const safeSessions = sortSessions(
      sessions
        .map((session, index) => normalizeSessionRecord(session, dayKey, index))
        .filter((session): session is TrainingSessionRecord => session !== null)
    );

    if (safeSessions.length > 0) {
      next[dayKey] = safeSessions;
    }
  }

  return next;
};

export const getWrongAnswerPriorityScore = (item: WrongAnswerItem): number => {
  const wrongWeight = item.wrongCount * 10;
  const recencyWeight = Math.max(0, 14 - diffFromNowInDays(item.lastWrongAt));
  const reviewGapDays = item.lastReviewedAt
    ? diffFromNowInDays(item.lastReviewedAt)
    : 21;
  const reviewGapWeight = Math.min(reviewGapDays, 21);

  return wrongWeight + recencyWeight + reviewGapWeight;
};

export const getWrongAnswerPriorityLabel = (item: WrongAnswerItem): string => {
  if (item.wrongCount >= 3) {
    return '高优先级';
  }

  if (!item.lastReviewedAt) {
    return '待首次回收';
  }

  if (diffFromNowInDays(item.lastReviewedAt) >= 5) {
    return '该复习了';
  }

  return '继续巩固';
};

export const getWeaknessSignalPriorityScore = (
  item: WeaknessSignalItem,
): number => {
  const wrongWeight = item.wrongCount * 10;
  const recencyWeight = Math.max(0, 14 - diffFromNowInDays(item.lastWrongAt));
  const unresolvedWeight = item.active ? 6 : 0;

  return wrongWeight + recencyWeight + unresolvedWeight;
};

const sortWrongAnswers = (wrongAnswers: WrongAnswerItem[]): WrongAnswerItem[] =>
  [...wrongAnswers].sort((left, right) => {
    if (left.mastered !== right.mastered) {
      return left.mastered ? 1 : -1;
    }

    const scoreGap = getWrongAnswerPriorityScore(right) - getWrongAnswerPriorityScore(left);
    if (scoreGap !== 0) {
      return scoreGap;
    }

    if (left.wrongCount !== right.wrongCount) {
      return right.wrongCount - left.wrongCount;
    }

    return right.lastWrongAt.localeCompare(left.lastWrongAt);
  });

const sortWeaknessSignals = (
  weaknessSignals: WeaknessSignalItem[],
): WeaknessSignalItem[] =>
  [...weaknessSignals].sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1;
    }

    const scoreGap = getWeaknessSignalPriorityScore(right) - getWeaknessSignalPriorityScore(left);
    if (scoreGap !== 0) {
      return scoreGap;
    }

    if (left.wrongCount !== right.wrongCount) {
      return right.wrongCount - left.wrongCount;
    }

    return right.lastWrongAt.localeCompare(left.lastWrongAt);
  });

const normalizeChoiceInsights = (
  choices: string[],
  value: unknown,
): string[] => {
  const rawInsights = Array.isArray(value) ? value : [];

  return choices.map((_, index) =>
    typeof rawInsights[index] === 'string' ? rawInsights[index] : '',
  );
};

const normalizeWrongAnswerErrorTypes = (
  value: unknown,
  modeId: DrillModeId,
  tags: string[],
): WrongAnswerErrorType[] => {
  if (Array.isArray(value)) {
    const errorTypes = value.filter(isWrongAnswerErrorType);

    if (errorTypes.length > 0) {
      return Array.from(new Set(errorTypes));
    }
  }

  return inferWrongAnswerErrorTypes(modeId, tags);
};

const normalizeWrongAnswer = (value: unknown): WrongAnswerItem | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const parsed = value as Partial<WrongAnswerItem>;

  if (
    typeof parsed.questionId !== 'string' ||
    !isDrillModeId(parsed.modeId as TrainingModeId) ||
    typeof parsed.prompt !== 'string' ||
    !Array.isArray(parsed.choices) ||
    parsed.choices.some((choice) => typeof choice !== 'string') ||
    typeof parsed.explanation !== 'string' ||
    typeof parsed.source !== 'string'
  ) {
    return null;
  }

  const answer =
    typeof parsed.answer === 'number' && Number.isInteger(parsed.answer)
      ? parsed.answer
      : 0;

  if (answer < 0 || answer >= parsed.choices.length) {
    return null;
  }

  const wrongCount =
    typeof parsed.wrongCount === 'number' && parsed.wrongCount > 0
      ? Math.round(parsed.wrongCount)
      : 1;
  const lastUserChoice =
    typeof parsed.lastUserChoice === 'number' &&
    Number.isInteger(parsed.lastUserChoice)
      ? parsed.lastUserChoice
      : null;
  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];

  return {
    questionId: parsed.questionId,
    modeId: parsed.modeId as DrillModeId,
    prompt: parsed.prompt,
    choices: parsed.choices,
    answer,
    explanation: parsed.explanation,
    choiceInsights: normalizeChoiceInsights(parsed.choices, parsed.choiceInsights),
    reviewNote:
      typeof parsed.reviewNote === 'string' && parsed.reviewNote.length > 0
        ? parsed.reviewNote
        : parsed.explanation,
    tags,
    source: parsed.source,
    wrongCount,
    firstWrongAt:
      typeof parsed.firstWrongAt === 'string' && parsed.firstWrongAt.length > 0
        ? parsed.firstWrongAt
        : new Date().toISOString(),
    lastWrongAt:
      typeof parsed.lastWrongAt === 'string' && parsed.lastWrongAt.length > 0
        ? parsed.lastWrongAt
        : new Date().toISOString(),
    lastUserChoice,
    lastReviewedAt:
      typeof parsed.lastReviewedAt === 'string' && parsed.lastReviewedAt.length > 0
        ? parsed.lastReviewedAt
        : undefined,
    mastered: Boolean(parsed.mastered),
    errorTypes: normalizeWrongAnswerErrorTypes(
      parsed.errorTypes,
      parsed.modeId as DrillModeId,
      tags,
    ),
  };
};

const normalizeWrongAnswers = (value: unknown): WrongAnswerItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return sortWrongAnswers(
    value
      .map((item) => normalizeWrongAnswer(item))
      .filter((item): item is WrongAnswerItem => item !== null),
  );
};

const normalizeWeaknessSignalErrorTypes = (
  value: unknown,
  modeId: Extract<TrainingModeId, 'reading_drill' | 'listening_analyze'>,
  tags: string[],
): WeaknessErrorType[] => {
  if (Array.isArray(value)) {
    const errorTypes = value.filter(isWeaknessErrorType);

    if (errorTypes.length > 0) {
      return Array.from(new Set(errorTypes));
    }
  }

  return inferModeWeaknessErrorTypes(modeId, tags);
};

const normalizeWeaknessSignal = (value: unknown): WeaknessSignalItem | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const parsed = value as Partial<WeaknessSignalItem>;
  const modeId = parsed.modeId as TrainingModeId;

  if (
    typeof parsed.questionId !== 'string' ||
    (!isReadingModeId(modeId) && !isListeningModeId(modeId)) ||
    typeof parsed.prompt !== 'string' ||
    typeof parsed.source !== 'string'
  ) {
    return null;
  }

  const tags = Array.isArray(parsed.tags)
    ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  const wrongCount =
    typeof parsed.wrongCount === 'number' && parsed.wrongCount > 0
      ? Math.round(parsed.wrongCount)
      : 1;

  return {
    questionId: parsed.questionId,
    modeId,
    prompt: parsed.prompt,
    source: parsed.source,
    tags,
    wrongCount,
    firstWrongAt:
      typeof parsed.firstWrongAt === 'string' && parsed.firstWrongAt.length > 0
        ? parsed.firstWrongAt
        : new Date().toISOString(),
    lastWrongAt:
      typeof parsed.lastWrongAt === 'string' && parsed.lastWrongAt.length > 0
        ? parsed.lastWrongAt
        : new Date().toISOString(),
    lastResolvedAt:
      typeof parsed.lastResolvedAt === 'string' && parsed.lastResolvedAt.length > 0
        ? parsed.lastResolvedAt
        : undefined,
    active: typeof parsed.active === 'boolean' ? parsed.active : true,
    errorTypes: normalizeWeaknessSignalErrorTypes(parsed.errorTypes, modeId, tags),
  };
};

const normalizeWeaknessSignals = (value: unknown): WeaknessSignalItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return sortWeaknessSignals(
    value
      .map((item) => normalizeWeaknessSignal(item))
      .filter((item): item is WeaknessSignalItem => item !== null),
  );
};

const migrateCompletedByDay = (completedByDay: LegacyCompletedByDay): SessionsByDay => {
  const next: SessionsByDay = {};

  for (const [dayKey, ids] of Object.entries(completedByDay)) {
    if (!Array.isArray(ids)) {
      continue;
    }

    const safeSessions = sortSessions(
      ids
        .filter(isValidModeId)
        .map((modeId, index) => ({
          id: createSessionId(dayKey, modeId, `legacy:${index}`),
          modeId,
          completedAt: buildLegacyCompletedAt(dayKey, index),
          kind: getDefaultSessionKind(modeId),
        })),
    );

    if (safeSessions.length > 0) {
      next[dayKey] = safeSessions;
    }
  }

  return next;
};

const pruneHistory = (sessionsByDay: SessionsByDay): SessionsByDay => {
  const cutoff = addDays(new Date(), -MAX_HISTORY_DAYS);
  const next: SessionsByDay = {};

  for (const [dayKey, sessions] of Object.entries(sessionsByDay)) {
    const safeSessions = sessions ?? [];

    if (safeSessions.length === 0) {
      continue;
    }

    if (diffInDays(parseDayKey(dayKey), cutoff) >= 0) {
      next[dayKey] = safeSessions;
    }
  }

  return next;
};

export const normalizeProgressState = (raw: string | null): ProgressState => {
  if (!raw) {
    return createDefaultProgressState();
  }

  try {
    const parsed = JSON.parse(raw) as LegacyProgressState;
    const weeklyGoal =
      typeof parsed.weeklyGoal === 'number' && Number.isFinite(parsed.weeklyGoal)
        ? clampWeeklyGoal(parsed.weeklyGoal)
        : DEFAULT_WEEKLY_GOAL;
    const sessionsByDay =
      parsed.sessionsByDay && typeof parsed.sessionsByDay === 'object'
        ? normalizeSessionsByDay(parsed.sessionsByDay)
        : migrateCompletedByDay(parsed.completedByDay ?? {});

    return {
      weeklyGoal,
      sessionsByDay: pruneHistory(sessionsByDay),
      wrongAnswers: normalizeWrongAnswers(parsed.wrongAnswers),
      weaknessSignals: normalizeWeaknessSignals(parsed.weaknessSignals),
    };
  } catch {
    return createDefaultProgressState();
  }
};

export const createTrainingSession = (
  dayKey: string,
  modeId: TrainingModeId,
  kind: TrainingSessionKind,
  completedAt: Date = new Date(),
): TrainingSessionRecord => {
  const completedAtIso = completedAt.toISOString();

  return {
    id: createSessionId(
      dayKey,
      modeId,
      `${completedAt.getTime()}:${Math.floor(Math.random() * 100000)}`,
    ),
    modeId,
    completedAt: completedAtIso,
    kind,
  };
};

export const getSessionsForDay = (
  state: ProgressState,
  dayKey: string,
): TrainingSessionRecord[] => state.sessionsByDay[dayKey] ?? [];

export const getCompletedModeIdsForDay = (
  state: ProgressState,
  dayKey: string,
): TrainingModeId[] =>
  Array.from(new Set(getSessionsForDay(state, dayKey).map((session) => session.modeId)));

export const getModeSessionCountForDay = (
  state: ProgressState,
  dayKey: string,
  modeId: TrainingModeId,
): number =>
  getSessionsForDay(state, dayKey).filter((session) => session.modeId === modeId)
    .length;

export const getActiveWrongAnswersForMode = (
  state: ProgressState,
  modeId: DrillModeId,
): WrongAnswerItem[] =>
  sortWrongAnswers(
    state.wrongAnswers.filter(
      (item) => item.modeId === modeId && item.mastered === false,
    ),
  );

export const getActiveWeaknessSignals = (
  state: ProgressState,
  modeId?: Extract<TrainingModeId, 'reading_drill' | 'listening_analyze'>,
): WeaknessSignalItem[] =>
  sortWeaknessSignals(
    state.weaknessSignals.filter(
      (item) => item.active && (!modeId || item.modeId === modeId),
    ),
  );

export const getPrioritizedWrongAnswersForMode = (
  state: ProgressState,
  modeId: DrillModeId,
  limit?: number,
): WrongAnswerItem[] => {
  const items = getActiveWrongAnswersForMode(state, modeId);
  return typeof limit === 'number' ? items.slice(0, limit) : items;
};

export const getWrongReviewBacklogCount = (
  state: ProgressState,
  modeId: ReviewModeId,
): number => getActiveWrongAnswersForMode(state, REVIEW_SOURCE_MODE[modeId]).length;

export const recordTrainingSession = (
  state: ProgressState,
  dayKey: string,
  session: TrainingSessionRecord,
): ProgressState => {
  const nextSessionsByDay = {
    ...state.sessionsByDay,
    [dayKey]: sortSessions([...(state.sessionsByDay[dayKey] ?? []), session]),
  };

  return {
    ...state,
    sessionsByDay: pruneHistory(nextSessionsByDay),
  };
};

export const recordWrongAnswers = (
  state: ProgressState,
  wrongAnswers: WrongAnswerDraft[],
  recordedAt: Date = new Date(),
): ProgressState => {
  if (wrongAnswers.length === 0) {
    return state;
  }

  const recordedAtIso = recordedAt.toISOString();
  const nextWrongAnswers = [...state.wrongAnswers];

  for (const draft of wrongAnswers) {
    const existingIndex = nextWrongAnswers.findIndex(
      (item) => item.questionId === draft.question.id,
    );

    if (existingIndex < 0) {
      nextWrongAnswers.push({
        questionId: draft.question.id,
        modeId: draft.question.modeId,
        prompt: draft.question.prompt,
        choices: draft.question.choices,
        answer: draft.question.answer,
        explanation: draft.question.explanation,
        choiceInsights: draft.question.choiceInsights,
        reviewNote: draft.question.reviewNote,
        tags: draft.question.tags,
        source: draft.question.source,
        wrongCount: 1,
        firstWrongAt: recordedAtIso,
        lastWrongAt: recordedAtIso,
        lastUserChoice: draft.selectedChoice,
        mastered: false,
        errorTypes: inferWrongAnswerErrorTypes(
          draft.question.modeId,
          draft.question.tags,
        ),
      });
      continue;
    }

    const existing = nextWrongAnswers[existingIndex];
    nextWrongAnswers[existingIndex] = {
      ...existing,
      prompt: draft.question.prompt,
      choices: draft.question.choices,
      answer: draft.question.answer,
      explanation: draft.question.explanation,
      choiceInsights: draft.question.choiceInsights,
      reviewNote: draft.question.reviewNote,
      tags: draft.question.tags,
      source: draft.question.source,
      wrongCount: existing.wrongCount + 1,
      lastWrongAt: recordedAtIso,
      lastUserChoice: draft.selectedChoice,
      mastered: false,
      errorTypes: inferWrongAnswerErrorTypes(
        draft.question.modeId,
        draft.question.tags,
      ),
    };
  }

  return {
    ...state,
    wrongAnswers: sortWrongAnswers(nextWrongAnswers),
  };
};

export const recordWeaknessSignals = (
  state: ProgressState,
  weaknessSignals: WeaknessSignalDraft[],
  recordedAt: Date = new Date(),
): ProgressState => {
  if (weaknessSignals.length === 0) {
    return state;
  }

  const recordedAtIso = recordedAt.toISOString();
  const nextWeaknessSignals = [...state.weaknessSignals];

  for (const draft of weaknessSignals) {
    const existingIndex = nextWeaknessSignals.findIndex(
      (item) => item.questionId === draft.questionId,
    );

    if (draft.wasCorrect) {
      if (existingIndex < 0) {
        continue;
      }

      const existing = nextWeaknessSignals[existingIndex];
      nextWeaknessSignals[existingIndex] = {
        ...existing,
        prompt: draft.prompt,
        source: draft.source,
        tags: draft.tags,
        active: false,
        lastResolvedAt: recordedAtIso,
        errorTypes:
          draft.errorTypes.length > 0
            ? Array.from(new Set(draft.errorTypes))
            : existing.errorTypes,
      };
      continue;
    }

    if (existingIndex < 0) {
      nextWeaknessSignals.push({
        questionId: draft.questionId,
        modeId: draft.modeId,
        prompt: draft.prompt,
        source: draft.source,
        tags: draft.tags,
        wrongCount: 1,
        firstWrongAt: recordedAtIso,
        lastWrongAt: recordedAtIso,
        active: true,
        errorTypes:
          draft.errorTypes.length > 0
            ? Array.from(new Set(draft.errorTypes))
            : inferModeWeaknessErrorTypes(draft.modeId, draft.tags),
      });
      continue;
    }

    const existing = nextWeaknessSignals[existingIndex];
    nextWeaknessSignals[existingIndex] = {
      ...existing,
      modeId: draft.modeId,
      prompt: draft.prompt,
      source: draft.source,
      tags: draft.tags,
      wrongCount: existing.wrongCount + 1,
      lastWrongAt: recordedAtIso,
      active: true,
      errorTypes:
        draft.errorTypes.length > 0
          ? Array.from(new Set(draft.errorTypes))
          : inferModeWeaknessErrorTypes(draft.modeId, draft.tags),
    };
  }

  return {
    ...state,
    weaknessSignals: sortWeaknessSignals(nextWeaknessSignals),
  };
};

export const recordDrillSessionResult = (
  state: ProgressState,
  dayKey: string,
  modeId: DrillModeId,
  kind: TrainingSessionKind,
  wrongAnswers: WrongAnswerDraft[],
  completedAt: Date = new Date(),
): ProgressState => {
  const session = createTrainingSession(dayKey, modeId, kind, completedAt);
  const nextState = recordTrainingSession(state, dayKey, session);
  return recordWrongAnswers(nextState, wrongAnswers, completedAt);
};

export const applyWrongReviewDecisions = (
  state: ProgressState,
  decisions: WrongReviewDecision[],
  reviewedAt: Date = new Date(),
): ProgressState => {
  if (decisions.length === 0) {
    return state;
  }

  const reviewedAtIso = reviewedAt.toISOString();
  const decisionMap = new Map(
    decisions.map((decision) => [decision.questionId, decision.mastered]),
  );

  return {
    ...state,
    wrongAnswers: sortWrongAnswers(
      state.wrongAnswers.map((item) => {
        const mastered = decisionMap.get(item.questionId);

        if (mastered === undefined) {
          return item;
        }

        return {
          ...item,
          mastered,
          lastReviewedAt: reviewedAtIso,
        };
      }),
    ),
  };
};

export const recordWrongReviewSession = (
  state: ProgressState,
  dayKey: string,
  modeId: ReviewModeId,
  decisions: WrongReviewDecision[],
  completedAt: Date = new Date(),
): ProgressState => {
  const nextState = applyWrongReviewDecisions(state, decisions, completedAt);
  return recordTrainingSession(
    nextState,
    dayKey,
    createTrainingSession(dayKey, modeId, 'review', completedAt),
  );
};

export const removeLatestSessionForMode = (
  state: ProgressState,
  dayKey: string,
  modeId: TrainingModeId,
): ProgressState => {
  const todaySessions = state.sessionsByDay[dayKey] ?? [];

  if (todaySessions.length === 0) {
    return state;
  }

  const targetIndex = todaySessions.findLastIndex(
    (session) => session.modeId === modeId,
  );

  if (targetIndex < 0) {
    return state;
  }

  const nextDaySessions = todaySessions.filter((_, index) => index !== targetIndex);
  const nextSessionsByDay = { ...state.sessionsByDay };

  if (nextDaySessions.length === 0) {
    delete nextSessionsByDay[dayKey];
  } else {
    nextSessionsByDay[dayKey] = nextDaySessions;
  }

  return {
    ...state,
    sessionsByDay: nextSessionsByDay,
  };
};

export const clearDay = (state: ProgressState, dayKey: string): ProgressState => {
  if (!state.sessionsByDay[dayKey]) {
    return state;
  }

  const nextSessionsByDay = { ...state.sessionsByDay };
  delete nextSessionsByDay[dayKey];

  return {
    ...state,
    sessionsByDay: nextSessionsByDay,
  };
};



