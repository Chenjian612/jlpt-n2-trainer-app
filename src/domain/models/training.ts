export type TrainingModeId =
  | 'grammar_drill'
  | 'grammar_study'
  | 'vocab_drill'
  | 'vocab_study'
  | 'reading_drill'
  | 'listening_analyze'
  | 'review_wrong'
  | 'vocab_review_wrong';

export type DrillModeId = 'grammar_drill' | 'vocab_drill';
export type StudyModeId = 'grammar_study' | 'vocab_study';
export type ReviewModeId = 'review_wrong' | 'vocab_review_wrong';
export type TrainingSessionKind = 'drill' | 'study' | 'review';

export const DRILL_MODE_IDS = ['grammar_drill', 'vocab_drill'] as const;
export const STUDY_MODE_IDS = ['grammar_study', 'vocab_study'] as const;
export const REVIEW_MODE_IDS = ['review_wrong', 'vocab_review_wrong'] as const;
export const REVIEW_SOURCE_MODE: Record<ReviewModeId, DrillModeId> = {
  review_wrong: 'grammar_drill',
  vocab_review_wrong: 'vocab_drill',
};

export const isDrillModeId = (modeId: TrainingModeId): modeId is DrillModeId =>
  DRILL_MODE_IDS.includes(modeId as DrillModeId);

export const isStudyModeId = (modeId: TrainingModeId): modeId is StudyModeId =>
  STUDY_MODE_IDS.includes(modeId as StudyModeId);

export const isReviewModeId = (
  modeId: TrainingModeId,
): modeId is ReviewModeId => REVIEW_MODE_IDS.includes(modeId as ReviewModeId);

export type TrainingMode = {
  id: TrainingModeId;
  sessionKind: TrainingSessionKind;
  title: string;
  shortTitle: string;
  subtitle: string;
  description: string;
  durationLabel: string;
  focus: string;
  sourceLabel: string;
  detailIntro: string;
  sessionFlow: string[];
  checklist: string[];
  targetOutput: string;
  reviewTip: string;
  accent: string;
  surface: string;
};
