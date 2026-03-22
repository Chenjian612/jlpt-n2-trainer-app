import type { DrillQuestion } from '../../domain/models/trainingContent';
import type { DrillModeId } from '../../domain/models/training';
import drillQuestionsData from './drill_questions.json';

export const DRILL_QUESTIONS: DrillQuestion[] =
  drillQuestionsData as DrillQuestion[];

export const getDrillQuestionsByMode = (modeId: DrillModeId): DrillQuestion[] =>
  DRILL_QUESTIONS.filter((question) => question.modeId === modeId);
