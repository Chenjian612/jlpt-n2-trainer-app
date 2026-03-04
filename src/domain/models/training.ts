export type TrainingModeId =
  | 'grammar_drill'
  | 'grammar_study'
  | 'vocab_drill'
  | 'vocab_study'
  | 'reading_drill'
  | 'listening_analyze'
  | 'review_wrong'
  | 'vocab_review_wrong';

export type TrainingMode = {
  id: TrainingModeId;
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
