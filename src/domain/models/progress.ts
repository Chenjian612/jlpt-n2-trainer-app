import type { TrainingModeId, TrainingSessionKind } from './training';
import type { WrongAnswerItem } from './trainingContent';

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
};

export type DashboardMetrics = {
  todayCompletedCount: number;
  weeklySessions: number;
  totalSessions: number;
  currentStreak: number;
  bestStreak: number;
};

export type DashboardInsightTone = 'review' | 'focus' | 'push' | 'steady';

export type DashboardInsight = {
  headline: string;
  body: string;
  recommendedModeId?: TrainingModeId;
  tone: DashboardInsightTone;
};

export type RecentDay = {
  dayKey: string;
  label: string;
  count: number;
};
