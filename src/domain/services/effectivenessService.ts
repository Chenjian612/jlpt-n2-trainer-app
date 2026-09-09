import type { LearningEffectivenessSnapshot, ProgressState } from '../models/progress';
import { addDays, getDayKey, parseDayKey } from '../../utils/dateUtils';
import { getReviewTasks } from './reviewScheduleService';

export const getLearningEffectiveness = (
  state: ProgressState,
  todayKey: string,
  now: Date = new Date(),
): LearningEffectivenessSnapshot => {
  const today = parseDayKey(todayKey);
  const sessions = Array.from({ length: 7 }, (_, offset) => {
    const dayKey = getDayKey(addDays(today, -offset));
    return state.sessionsByDay[dayKey] ?? [];
  });
  const transferAttempts = state.transferResults.length;
  const transferCorrect = state.transferResults.filter((result) => result.correct).length;
  const recentStart = new Date(addDays(today, -6).setHours(0, 0, 0, 0));
  const priorStart = new Date(addDays(today, -13).setHours(0, 0, 0, 0));
  const priorEnd = recentStart;
  const exposure = (start: Date, end: Date) => [
    ...state.wrongAnswers.map((item) => ({ at: item.lastWrongAt, count: item.wrongCount })),
    ...state.weaknessSignals.map((item) => ({ at: item.lastWrongAt, count: item.wrongCount })),
    ...state.studyWeaknesses.map((item) => ({ at: item.lastUnstableAt, count: item.unstableCount })),
  ].filter((item) => {
    const at = new Date(item.at).getTime();
    return at >= start.getTime() && at < end.getTime();
  }).reduce((sum, item) => sum + item.count, 0);
  const recentErrorExposure = exposure(recentStart, new Date(addDays(today, 1).setHours(0, 0, 0, 0)));
  const priorErrorExposure = exposure(priorStart, priorEnd);
  const errorTrend = priorErrorExposure === 0
    ? (recentErrorExposure === 0 ? 'stable' : 'worsening')
    : recentErrorExposure < priorErrorExposure * 0.8
      ? 'improving'
      : recentErrorExposure > priorErrorExposure * 1.2 ? 'worsening' : 'stable';
  const repeatErrorCount = [
    ...state.wrongAnswers.filter((item) => !item.mastered && item.wrongCount >= 2),
    ...state.weaknessSignals.filter((item) => item.active && item.wrongCount >= 2),
    ...state.studyWeaknesses.filter((item) => item.active && item.unstableCount >= 2),
  ].length;
  const spacedProgressCount = [
    ...state.weaknessSignals.filter((item) => item.active && (item.reviewBox ?? 1) >= 2),
    ...state.studyWeaknesses.filter((item) => item.active && (item.reviewBox ?? 1) >= 2),
  ].length;
  return {
    dueReviewCount: getReviewTasks(state, now).reduce((sum, task) => sum + task.count, 0),
    repeatErrorCount,
    spacedProgressCount,
    transferAttempts,
    transferAccuracy: transferAttempts > 0 ? transferCorrect / transferAttempts : null,
    sessionsLast7Days: sessions.reduce((sum, day) => sum + day.length, 0),
    activeDaysLast7Days: sessions.filter((day) => day.length > 0).length,
    reviewSessionsLast7Days: sessions.flat().filter((session) => session.kind === 'review').length,
    recentErrorExposure,
    priorErrorExposure,
    errorTrend,
  };
};
