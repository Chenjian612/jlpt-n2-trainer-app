import type { TrainingModeId, TrainingSessionKind } from './training';
import type {
  StudyWeaknessItem,
  WeaknessErrorType,
  WeaknessSignalItem,
  WrongAnswerItem,
} from './trainingContent';

export type TrainingSessionRecord = {
  id: string;
  modeId: TrainingModeId;
  completedAt: string;
  kind: TrainingSessionKind;
};

export type SessionsByDay = Partial<Record<string, TrainingSessionRecord[]>>;

export type ProgressState = {
  weeklyGoal: number;
  sessionsByDay: SessionsByDay;
  wrongAnswers: WrongAnswerItem[];
  weaknessSignals: WeaknessSignalItem[];
  studyWeaknesses: StudyWeaknessItem[];
};

export type CapabilityDistribution = {
  grammar: number;
  vocab: number;
  reading: number;
  listening: number;
};

export type DashboardMetrics = {
  todayCompletedCount: number;
  weeklySessions: number;
  totalSessions: number;
  currentStreak: number;
  bestStreak: number;
  capabilityDistribution: CapabilityDistribution;
};

export type DashboardInsightTone = 'review' | 'focus' | 'push' | 'steady';

export type HeroBattleState =
  | 'first_battle'
  | 'recovering'
  | 'sprint'
  | 'goal_reached';

export type DashboardInsight = {
  headline: string;
  body: string;
  recommendedModeId?: TrainingModeId;
  tone: DashboardInsightTone;
  battleState: HeroBattleState;
};

export type RecentDay = {
  dayKey: string;
  label: string;
  count: number;
};

export type WeaknessFocusItem = {
  id: WeaknessErrorType;
  label: string;
  questionCount: number;
  wrongCount: number;
  statusLabel: string;
  sourceModeId: TrainingModeId;
  recommendedModeId: TrainingModeId;
  body: string;
  coachPoint: string;
};

export type CoachPlanStep = {
  title: string;
  body: string;
  recommendedModeId?: TrainingModeId;
};

export type DashboardWeaknessSnapshot = {
  headline: string;
  body: string;
  focusItems: WeaknessFocusItem[];
  planSteps: CoachPlanStep[];
  recommendedModeId?: TrainingModeId;
};
