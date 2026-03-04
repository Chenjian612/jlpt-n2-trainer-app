import type { TrainingModeId } from './training';

export type CompletedByDay = Partial<Record<string, TrainingModeId[]>>;

export type ProgressState = {
  weeklyGoal: number;
  completedByDay: CompletedByDay;
};

export type DashboardMetrics = {
  todayCompletedCount: number;
  weeklySessions: number;
  totalSessions: number;
  currentStreak: number;
  bestStreak: number;
};

export type RecentDay = {
  dayKey: string;
  label: string;
  count: number;
};
