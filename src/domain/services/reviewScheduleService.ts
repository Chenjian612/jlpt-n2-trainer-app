import type { ProgressState } from '../models/progress';
import type { TrainingModeId } from '../models/training';
import type { ListeningCase, ReadingPassage } from '../models/trainingContent';
import {
  getActiveStudyWeaknesses,
  getActiveWeaknessSignals,
  getDueWrongAnswersForMode,
} from './progressService';
import { APP_CONFIG } from '../../config/constants';
import { getDayKey, parseDayKey } from '../../utils/dateUtils';

export type ReviewTask = {
  modeId: TrainingModeId;
  itemIds: string[];
  count: number;
  overdueCount: number;
  oldestDueAt: string;
  reason: string;
};

const LABELS: Partial<Record<TrainingModeId, string>> = {
  review_wrong: '文法错题', vocab_review_wrong: '词汇错题',
  grammar_study: '文法记忆项', vocab_study: '词汇记忆项',
  reading_drill: '读解弱项', listening_analyze: '听力弱项',
};

// One read-only schedule shared by the dashboard, coach and session selection.
// No new progress schema: preserve Leitner, study cooldown and signal mastery.
export function getReviewTasks(state: ProgressState, now: Date = new Date()): ReviewTask[] {
  const groups = new Map<TrainingModeId, { id: string; due: Date }[]>();
  const today = getDayKey(now);
  const add = (modeId: TrainingModeId, id: string, due: Date) => {
    const safeDue = Number.isNaN(due.getTime()) ? now : due;
    if (safeDue > now) return;
    const entries = groups.get(modeId) ?? [];
    if (!entries.some((entry) => entry.id === id)) entries.push({ id, due: safeDue });
    groups.set(modeId, entries);
  };
  for (const mode of ['grammar_drill', 'vocab_drill'] as const) {
    for (const item of getDueWrongAnswersForMode(state, mode, now)) {
      add(mode === 'grammar_drill' ? 'review_wrong' : 'vocab_review_wrong', item.questionId,
        parseDayKey((item.nextReviewAt || today).slice(0, 10)));
    }
  }
  for (const item of getActiveStudyWeaknesses(state, undefined, now)) {
    add(item.modeId, item.id, new Date(new Date(item.lastUnstableAt).getTime() + APP_CONFIG.STUDY_REAPPEAR_HOURS * 3600000));
  }
  for (const item of getActiveWeaknessSignals(state)) {
    add(item.modeId, item.questionId, new Date(item.lastWrongAt));
  }
  return [...groups].map(([modeId, entries]) => {
    entries.sort((a, b) => a.due.getTime() - b.due.getTime() || a.id.localeCompare(b.id));
    const overdueCount = entries.filter((entry) => getDayKey(entry.due) < today).length;
    return {
      modeId, itemIds: entries.map((entry) => entry.id), count: entries.length,
      overdueCount, oldestDueAt: entries[0].due.toISOString(),
      reason: `${LABELS[modeId]} ${entries.length} 项待复习${overdueCount ? `，其中 ${overdueCount} 项已跨日待复习` : ''}`,
    };
  }).sort((a, b) => a.oldestDueAt.localeCompare(b.oldestDueAt) || b.count - a.count || a.modeId.localeCompare(b.modeId));
}

export function selectReadingReviewPassage(
  passages: ReadingPassage[], state: ProgressState, fallback: ReadingPassage | undefined, now = new Date(),
): ReadingPassage | undefined {
  const task = getReviewTasks(state, now).find((item) => item.modeId === 'reading_drill');
  for (const id of task?.itemIds ?? []) {
    const passage = passages.find((item) => item.questions.some((question) => question.id === id));
    if (passage) return passage;
  }
  return fallback;
}

export function prioritizeListeningReviewCases(cases: ListeningCase[], state: ProgressState, now = new Date()): ListeningCase[] {
  const ids = getReviewTasks(state, now).find((item) => item.modeId === 'listening_analyze')?.itemIds ?? [];
  const ranks = new Map(ids.map((id, index) => [id, index]));
  const rank = (item: ListeningCase) => Math.min(...item.questions.map((question) => ranks.get(question.id) ?? Infinity));
  // Stable sorting keeps each case and its questions together, including synthesis.
  return [...cases].sort((a, b) => rank(a) - rank(b));
}
