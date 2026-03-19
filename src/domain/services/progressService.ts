import type {
  ProgressState,
  SessionsByDay,
  TrainingSessionRecord,
} from '../models/progress';
import type {
  StudyWeaknessDraft,
  StudyWeaknessItem,
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
  StudyModeId,
  TrainingModeId,
  TrainingSessionKind,
} from '../models/training';
import {
  REVIEW_SOURCE_MODE,
  isDrillModeId,
  isListeningModeId,
  isReadingModeId,
  isStudyModeId,
} from '../models/training';
import {
  inferModeWeaknessErrorTypes,
  inferWrongAnswerErrorTypes,
  isWeaknessErrorType,
  isWrongAnswerErrorType,
} from './wrongAnswerClassifier';
import { APP_CONFIG } from '../../config/constants';
import { addDays, diffInDays, getDayKey, parseDayKey } from '../../utils/dateUtils';

export { getDayKey };

export const DEFAULT_WEEKLY_GOAL = APP_CONFIG.DEFAULT_WEEKLY_GOAL;
const MAX_HISTORY_DAYS = APP_CONFIG.MAX_HISTORY_DAYS;

const VALID_MODE_IDS = new Set<TrainingModeId>([
  'grammar_drill',
  'grammar_study',
  'vocab_drill',
  'vocab_study',
  'official_vocab_memory',
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
  official_vocab_memory: 'study',
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
  studyWeaknesses: [],
});

export const clampWeeklyGoal = (goal: number): number =>
  Math.max(APP_CONFIG.MIN_WEEKLY_GOAL, Math.min(APP_CONFIG.MAX_WEEKLY_GOAL, Math.round(goal)));

const diffFromNowInDays = (iso: string): number => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 999;
  return Math.max(0, diffInDays(new Date(), parsed));
};

const diffInHours = (left: Date, right: Date): number => {
  const delta = left.getTime() - right.getTime();
  if (Number.isNaN(delta)) return 999;
  return Math.max(0, delta / (1000 * 60 * 60));
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
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<TrainingSessionRecord>;
  if (!isValidModeId(parsed.modeId)) return null;

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
  if (!value || typeof value !== 'object') return {};
  const next: SessionsByDay = {};

  for (const [dayKey, sessions] of Object.entries(value)) {
    if (!Array.isArray(sessions)) continue;
    const safeSessions = sortSessions(
      sessions
        .map((session, index) => normalizeSessionRecord(session, dayKey, index))
        .filter((session): session is TrainingSessionRecord => session !== null)
    );
    if (safeSessions.length > 0) next[dayKey] = safeSessions;
  }
  return next;
};

export const getWrongAnswerPriorityScore = (item: WrongAnswerItem): number => {
  const wrongWeight = item.wrongCount * APP_CONFIG.PRIORITY_WEIGHT_FREQUENT;
  const recencyWeight = Math.max(0, 14 - diffFromNowInDays(item.lastWrongAt));
  const reviewGapDays = item.lastReviewedAt ? diffFromNowInDays(item.lastReviewedAt) : 21;
  const reviewGapWeight = Math.min(reviewGapDays, APP_CONFIG.PRIORITY_WEIGHT_NEW);

  return wrongWeight + recencyWeight + reviewGapWeight;
};

export const getWrongAnswerPriorityLabel = (item: WrongAnswerItem): string => {
  if (item.wrongCount >= 3) return '高优先级';
  if (!item.lastReviewedAt) return '待首次回收';
  if (diffFromNowInDays(item.lastReviewedAt) >= 5) return '该复习了';
  return '继续巩固';
};

export const getWeaknessSignalPriorityScore = (
  item: WeaknessSignalItem,
): number => {
  const wrongWeight = item.wrongCount * APP_CONFIG.PRIORITY_WEIGHT_FREQUENT;
  const recencyWeight = Math.max(0, 14 - diffFromNowInDays(item.lastWrongAt));
  const unresolvedWeight = item.active ? 6 : 0;
  return wrongWeight + recencyWeight + unresolvedWeight;
};

const sortWrongAnswers = (wrongAnswers: WrongAnswerItem[]): WrongAnswerItem[] =>
  [...wrongAnswers].sort((left, right) => {
    if (left.mastered !== right.mastered) return left.mastered ? 1 : -1;
    const scoreGap = getWrongAnswerPriorityScore(right) - getWrongAnswerPriorityScore(left);
    if (scoreGap !== 0) return scoreGap;
    if (left.wrongCount !== right.wrongCount) return right.wrongCount - left.wrongCount;
    return right.lastWrongAt.localeCompare(left.lastWrongAt);
  });

const sortWeaknessSignals = (
  weaknessSignals: WeaknessSignalItem[],
): WeaknessSignalItem[] =>
  [...weaknessSignals].sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1;
    const scoreGap = getWeaknessSignalPriorityScore(right) - getWeaknessSignalPriorityScore(left);
    if (scoreGap !== 0) return scoreGap;
    if (left.wrongCount !== right.wrongCount) return right.wrongCount - left.wrongCount;
    return right.lastWrongAt.localeCompare(left.lastWrongAt);
  });

const normalizeChoiceInsights = (choices: string[], value: unknown): string[] => {
  const rawInsights = Array.isArray(value) ? value : [];
  return choices.map((_, index) => (typeof rawInsights[index] === 'string' ? rawInsights[index] : ''));
};

const normalizeWrongAnswerErrorTypes = (
  value: unknown,
  modeId: DrillModeId,
  tags: string[],
): WrongAnswerErrorType[] => {
  if (Array.isArray(value)) {
    const errorTypes = value.filter(isWrongAnswerErrorType);
    if (errorTypes.length > 0) return Array.from(new Set(errorTypes));
  }
  return inferWrongAnswerErrorTypes(modeId, tags);
};

const normalizeWrongAnswer = (value: unknown): WrongAnswerItem | null => {
  if (!value || typeof value !== 'object') return null;
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

  const answer = typeof parsed.answer === 'number' && Number.isInteger(parsed.answer) ? parsed.answer : 0;
  if (answer < 0 || answer >= parsed.choices.length) return null;

  const wrongCount = typeof parsed.wrongCount === 'number' && parsed.wrongCount > 0 ? Math.round(parsed.wrongCount) : 1;
  const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((tag): tag is string => typeof tag === 'string') : [];

  return {
    questionId: parsed.questionId,
    modeId: parsed.modeId as DrillModeId,
    prompt: parsed.prompt,
    choices: parsed.choices,
    answer,
    explanation: parsed.explanation,
    choiceInsights: normalizeChoiceInsights(parsed.choices, parsed.choiceInsights),
    reviewNote: typeof parsed.reviewNote === 'string' && parsed.reviewNote.length > 0 ? parsed.reviewNote : parsed.explanation,
    tags,
    source: parsed.source,
    wrongCount,
    firstWrongAt: typeof parsed.firstWrongAt === 'string' && parsed.firstWrongAt.length > 0 ? parsed.firstWrongAt : new Date().toISOString(),
    lastWrongAt: typeof parsed.lastWrongAt === 'string' && parsed.lastWrongAt.length > 0 ? parsed.lastWrongAt : new Date().toISOString(),
    lastUserChoice: typeof parsed.lastUserChoice === 'number' ? parsed.lastUserChoice : null,
    lastReviewedAt: typeof parsed.lastReviewedAt === 'string' && parsed.lastReviewedAt.length > 0 ? parsed.lastReviewedAt : undefined,
    mastered: Boolean(parsed.mastered),
    errorTypes: normalizeWrongAnswerErrorTypes(parsed.errorTypes, parsed.modeId as DrillModeId, tags),
  };
};

const normalizeWrongAnswers = (value: unknown): WrongAnswerItem[] => {
  if (!Array.isArray(value)) return [];
  return sortWrongAnswers(
    value.map((item) => normalizeWrongAnswer(item)).filter((item): item is WrongAnswerItem => item !== null),
  );
};

const normalizeWeaknessSignalErrorTypes = (
  value: unknown,
  modeId: Extract<TrainingModeId, 'reading_drill' | 'listening_analyze'>,
  tags: string[],
): WeaknessErrorType[] => {
  if (Array.isArray(value)) {
    const errorTypes = value.filter(isWeaknessErrorType);
    if (errorTypes.length > 0) return Array.from(new Set(errorTypes));
  }
  return inferModeWeaknessErrorTypes(modeId, tags);
};

const normalizeWeaknessSignal = (value: unknown): WeaknessSignalItem | null => {
  if (!value || typeof value !== 'object') return null;
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

  const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const wrongCount = typeof parsed.wrongCount === 'number' && parsed.wrongCount > 0 ? Math.round(parsed.wrongCount) : 1;

  return {
    questionId: parsed.questionId,
    modeId,
    prompt: parsed.prompt,
    source: parsed.source,
    tags,
    wrongCount,
    firstWrongAt: typeof parsed.firstWrongAt === 'string' && parsed.firstWrongAt.length > 0 ? parsed.firstWrongAt : new Date().toISOString(),
    lastWrongAt: typeof parsed.lastWrongAt === 'string' && parsed.lastWrongAt.length > 0 ? parsed.lastWrongAt : new Date().toISOString(),
    lastResolvedAt: typeof parsed.lastResolvedAt === 'string' && parsed.lastResolvedAt.length > 0 ? parsed.lastResolvedAt : undefined,
    active: typeof parsed.active === 'boolean' ? parsed.active : true,
    errorTypes: normalizeWeaknessSignalErrorTypes(parsed.errorTypes, modeId as any, tags),
  };
};

const normalizeWeaknessSignals = (value: unknown): WeaknessSignalItem[] => {
  if (!Array.isArray(value)) return [];
  return sortWeaknessSignals(
    value.map((item) => normalizeWeaknessSignal(item)).filter((item): item is WeaknessSignalItem => item !== null),
  );
};

const sortStudyWeaknesses = (studyWeaknesses: StudyWeaknessItem[]): StudyWeaknessItem[] =>
  [...studyWeaknesses].sort((left, right) => {
    if (left.active !== right.active) return left.active ? -1 : 1;
    if (left.unstableCount !== right.unstableCount) return right.unstableCount - left.unstableCount;
    return right.lastUnstableAt.localeCompare(left.lastUnstableAt);
  });

const normalizeStudyWeakness = (value: unknown): StudyWeaknessItem | null => {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<StudyWeaknessItem>;
  if (typeof parsed.id !== 'string' || !isStudyModeId(parsed.modeId as any) || typeof parsed.term !== 'string') return null;

  return {
    id: parsed.id,
    modeId: parsed.modeId as StudyModeId,
    term: parsed.term,
    reading: parsed.reading,
    coreMeaning: parsed.coreMeaning ?? '',
    keyUsage: parsed.keyUsage ?? '',
    confusingPair: parsed.confusingPair ?? '',
    example: parsed.example ?? '',
    memoryHook: parsed.memoryHook ?? '',
    reviewPrompt: parsed.reviewPrompt ?? '',
    unstableCount: typeof parsed.unstableCount === 'number' ? Math.round(parsed.unstableCount) : 1,
    firstUnstableAt: typeof parsed.firstUnstableAt === 'string' ? parsed.firstUnstableAt : new Date().toISOString(),
    lastUnstableAt: typeof parsed.lastUnstableAt === 'string' ? parsed.lastUnstableAt : new Date().toISOString(),
    lastResolvedAt: typeof parsed.lastResolvedAt === 'string' ? parsed.lastResolvedAt : undefined,
    active: typeof parsed.active === 'boolean' ? parsed.active : true,
  };
};

const normalizeStudyWeaknesses = (value: unknown): StudyWeaknessItem[] => {
  if (!Array.isArray(value)) return [];
  return sortStudyWeaknesses(
    value.map((item) => normalizeStudyWeakness(item)).filter((item): item is StudyWeaknessItem => item !== null),
  );
};

const migrateCompletedByDay = (completedByDay: LegacyCompletedByDay): SessionsByDay => {
  const next: SessionsByDay = {};
  for (const [dayKey, ids] of Object.entries(completedByDay)) {
    if (!Array.isArray(ids)) continue;
    const safeSessions = sortSessions(
      ids.filter(isValidModeId).map((modeId, index) => ({
        id: createSessionId(dayKey, modeId, `legacy:${index}`),
        modeId,
        completedAt: buildLegacyCompletedAt(dayKey, index),
        kind: getDefaultSessionKind(modeId),
      })),
    );
    if (safeSessions.length > 0) next[dayKey] = safeSessions;
  }
  return next;
};

const pruneHistory = (sessionsByDay: SessionsByDay): SessionsByDay => {
  const cutoff = addDays(new Date(), -MAX_HISTORY_DAYS);
  const next: SessionsByDay = {};
  for (const [dayKey, sessions] of Object.entries(sessionsByDay)) {
    if (!sessions || sessions.length === 0) continue;
    if (diffInDays(parseDayKey(dayKey), cutoff) >= 0) next[dayKey] = sessions;
  }
  return next;
};

export const normalizeProgressState = (raw: string | null): ProgressState => {
  if (!raw) return createDefaultProgressState();
  try {
    const parsed = JSON.parse(raw) as LegacyProgressState;
    const weeklyGoal = typeof parsed.weeklyGoal === 'number' ? clampWeeklyGoal(parsed.weeklyGoal) : DEFAULT_WEEKLY_GOAL;
    const sessionsByDay = parsed.sessionsByDay && typeof parsed.sessionsByDay === 'object' ? normalizeSessionsByDay(parsed.sessionsByDay) : migrateCompletedByDay(parsed.completedByDay ?? {});

    return {
      weeklyGoal,
      sessionsByDay: pruneHistory(sessionsByDay),
      wrongAnswers: normalizeWrongAnswers(parsed.wrongAnswers),
      weaknessSignals: normalizeWeaknessSignals(parsed.weaknessSignals),
      studyWeaknesses: normalizeStudyWeaknesses(parsed.studyWeaknesses),
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
): TrainingSessionRecord => ({
  id: createSessionId(dayKey, modeId, `${completedAt.getTime()}:${Math.floor(Math.random() * 100000)}`),
  modeId,
  completedAt: completedAt.toISOString(),
  kind,
});

export const getSessionsForDay = (state: ProgressState, dayKey: string): TrainingSessionRecord[] => state.sessionsByDay[dayKey] ?? [];

export const getCompletedModeIdsForDay = (state: ProgressState, dayKey: string): TrainingModeId[] =>
  Array.from(new Set(getSessionsForDay(state, dayKey).map((s) => s.modeId)));

export const getModeSessionCountForDay = (state: ProgressState, dayKey: string, modeId: TrainingModeId): number =>
  getSessionsForDay(state, dayKey).filter((s) => s.modeId === modeId).length;

export const getActiveWrongAnswersForMode = (state: ProgressState, modeId: DrillModeId): WrongAnswerItem[] =>
  sortWrongAnswers(state.wrongAnswers.filter((item) => item.modeId === modeId && !item.mastered));

export const getActiveWeaknessSignals = (
  state: ProgressState,
  modeId?: Extract<TrainingModeId, 'reading_drill' | 'listening_analyze'>,
): WeaknessSignalItem[] =>
  sortWeaknessSignals(state.weaknessSignals.filter((item) => item.active && (!modeId || item.modeId === modeId)));

export const getActiveStudyWeaknesses = (
  state: ProgressState,
  modeId?: StudyModeId,
  referenceDate: Date = new Date(),
): StudyWeaknessItem[] => {
  const filtered = state.studyWeaknesses.filter((item) => {
    if (!item.active) return false;
    if (modeId && item.modeId !== modeId) return false;
    const lastLook = new Date(item.lastUnstableAt);
    if (Number.isNaN(lastLook.getTime())) return true;
    return diffInHours(referenceDate, lastLook) >= APP_CONFIG.STUDY_REAPPEAR_HOURS;
  });
  return sortStudyWeaknesses(filtered);
};

export const getPrioritizedWrongAnswersForMode = (state: ProgressState, modeId: DrillModeId, limit?: number): WrongAnswerItem[] => {
  const items = getActiveWrongAnswersForMode(state, modeId);
  return typeof limit === 'number' ? items.slice(0, limit) : items;
};

export const getWrongReviewBacklogCount = (state: ProgressState, modeId: ReviewModeId): number =>
  getActiveWrongAnswersForMode(state, REVIEW_SOURCE_MODE[modeId]).length;

export const getStudyWeaknessBacklogCount = (state: ProgressState, modeId?: StudyModeId): number =>
  getActiveStudyWeaknesses(state, modeId).length;

export const recordTrainingSession = (state: ProgressState, dayKey: string, session: TrainingSessionRecord): ProgressState => {
  const nextSessionsByDay = {
    ...state.sessionsByDay,
    [dayKey]: sortSessions([...(state.sessionsByDay[dayKey] ?? []), session]),
  };
  return { ...state, sessionsByDay: pruneHistory(nextSessionsByDay) };
};

export const recordWrongAnswers = (state: ProgressState, wrongAnswers: WrongAnswerDraft[], recordedAt: Date = new Date()): ProgressState => {
  if (wrongAnswers.length === 0) return state;
  const recordedAtIso = recordedAt.toISOString();
  const nextWrongAnswers = [...state.wrongAnswers];

  for (const draft of wrongAnswers) {
    const idx = nextWrongAnswers.findIndex((item) => item.questionId === draft.question.id);
    if (idx < 0) {
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
        errorTypes: inferWrongAnswerErrorTypes(draft.question.modeId, draft.question.tags),
      });
    } else {
      const existing = nextWrongAnswers[idx];
      nextWrongAnswers[idx] = {
        ...existing,
        wrongCount: existing.wrongCount + 1,
        lastWrongAt: recordedAtIso,
        lastUserChoice: draft.selectedChoice,
        mastered: false,
      };
    }
  }
  return { ...state, wrongAnswers: sortWrongAnswers(nextWrongAnswers) };
};

export const recordWeaknessSignals = (state: ProgressState, weaknessSignals: WeaknessSignalDraft[], recordedAt: Date = new Date()): ProgressState => {
  if (weaknessSignals.length === 0) return state;
  const recordedAtIso = recordedAt.toISOString();
  const nextWeaknessSignals = [...state.weaknessSignals];

  for (const draft of weaknessSignals) {
    const idx = nextWeaknessSignals.findIndex((item) => item.questionId === draft.questionId);
    if (draft.wasCorrect) {
      if (idx >= 0) {
        nextWeaknessSignals[idx] = { ...nextWeaknessSignals[idx], active: false, lastResolvedAt: recordedAtIso };
      }
      continue;
    }
    if (idx < 0) {
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
        errorTypes: inferModeWeaknessErrorTypes(draft.modeId as any, draft.tags),
      });
    } else {
      const existing = nextWeaknessSignals[idx];
      nextWeaknessSignals[idx] = {
        ...existing,
        wrongCount: existing.wrongCount + 1,
        lastWrongAt: recordedAtIso,
        active: true,
      };
    }
  }
  return { ...state, weaknessSignals: sortWeaknessSignals(nextWeaknessSignals) };
};

export const recordStudyWeaknesses = (state: ProgressState, studyWeaknesses: StudyWeaknessDraft[], recordedAt: Date = new Date()): ProgressState => {
  if (studyWeaknesses.length === 0) return state;
  const recordedAtIso = recordedAt.toISOString();
  const nextStudyWeaknesses = [...state.studyWeaknesses];

  for (const draft of studyWeaknesses) {
    const idx = nextStudyWeaknesses.findIndex((item) => item.id === draft.item.id);
    if (draft.wasConfident) {
      if (idx >= 0) {
        nextStudyWeaknesses[idx] = { ...nextStudyWeaknesses[idx], active: false, lastResolvedAt: recordedAtIso };
      }
      continue;
    }
    if (idx < 0) {
      nextStudyWeaknesses.push({ ...draft.item, unstableCount: 1, firstUnstableAt: recordedAtIso, lastUnstableAt: recordedAtIso, active: true });
    } else {
      const existing = nextStudyWeaknesses[idx];
      nextStudyWeaknesses[idx] = { ...existing, unstableCount: existing.unstableCount + 1, lastUnstableAt: recordedAtIso, active: true };
    }
  }
  return { ...state, studyWeaknesses: sortStudyWeaknesses(nextStudyWeaknesses) };
};

export const recordDrillSessionResult = (state: ProgressState, dayKey: string, modeId: DrillModeId, kind: TrainingSessionKind, wrongAnswers: WrongAnswerDraft[], completedAt: Date = new Date()): ProgressState => {
  const nextState = recordTrainingSession(state, dayKey, createTrainingSession(dayKey, modeId, kind, completedAt));
  return recordWrongAnswers(nextState, wrongAnswers, completedAt);
};

export const recordStudySessionResult = (state: ProgressState, dayKey: string, modeId: StudyModeId, kind: TrainingSessionKind, studyWeaknesses: StudyWeaknessDraft[], completedAt: Date = new Date()): ProgressState => {
  const nextState = recordTrainingSession(state, dayKey, createTrainingSession(dayKey, modeId, kind, completedAt));
  return recordStudyWeaknesses(nextState, studyWeaknesses, completedAt);
};

export const recordWrongReviewSession = (state: ProgressState, dayKey: string, modeId: ReviewModeId, decisions: WrongReviewDecision[], completedAt: Date = new Date()): ProgressState => {
  const recordedState = recordTrainingSession(state, dayKey, createTrainingSession(dayKey, modeId, 'review', completedAt));
  const nextWrongAnswers = [...recordedState.wrongAnswers];
  const iso = completedAt.toISOString();

  for (const decision of decisions) {
    const idx = nextWrongAnswers.findIndex((i) => i.questionId === decision.questionId);
    if (idx < 0) continue;
    
    const existing = nextWrongAnswers[idx];
    nextWrongAnswers[idx] = {
      ...existing,
      mastered: decision.mastered,
      lastUserChoice: decision.selectedChoice,
      lastReviewedAt: iso,
    };
  }
  return { ...recordedState, wrongAnswers: sortWrongAnswers(nextWrongAnswers) };
};

export const removeLatestSessionForMode = (state: ProgressState, dayKey: string, modeId: TrainingModeId): ProgressState => {
  const sessions = state.sessionsByDay[dayKey] ?? [];
  const idx = [...sessions].reverse().findIndex((s) => s.modeId === modeId);
  if (idx < 0) return state;
  const actualIdx = sessions.length - 1 - idx;
  const nextSessions = [...sessions];
  nextSessions.splice(actualIdx, 1);
  return { ...state, sessionsByDay: { ...state.sessionsByDay, [dayKey]: nextSessions } };
};

export const clearDay = (state: ProgressState, dayKey: string): ProgressState => {
  if (!state.sessionsByDay[dayKey]) return state;
  const next = { ...state.sessionsByDay };
  delete next[dayKey];
  return { ...state, sessionsByDay: next };
};
