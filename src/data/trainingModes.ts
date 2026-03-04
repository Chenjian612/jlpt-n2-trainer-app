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
  duration: string;
  focus: string;
  accent: string;
  surface: string;
};

export const TRAINING_MODES: TrainingMode[] = [
  {
    id: 'grammar_drill',
    title: '文法闯关',
    shortTitle: '文法',
    subtitle: 'Grammar Drill',
    description: '用近义句型和接续辨析维持手感，适合每天快速热身。',
    duration: '18 分钟',
    focus: '接续、语气、误选排除',
    accent: '#0E7490',
    surface: '#E0F2FE',
  },
  {
    id: 'grammar_study',
    title: '文法记忆包',
    shortTitle: '记忆',
    subtitle: 'Grammar Study',
    description: '集中记住 3 个核心句型，压缩成可复习的记忆块。',
    duration: '12 分钟',
    focus: '核心意思、混淆点、记忆钩子',
    accent: '#D97706',
    surface: '#FEF3C7',
  },
  {
    id: 'vocab_drill',
    title: '词汇刷题',
    shortTitle: '词汇',
    subtitle: 'Vocab Drill',
    description: '优先练语境填空和近义词选择，减少只会背不会用。',
    duration: '15 分钟',
    focus: '语境、搭配、近义词',
    accent: '#B45309',
    surface: '#FFEDD5',
  },
  {
    id: 'vocab_study',
    title: '词汇记忆包',
    shortTitle: '背词',
    subtitle: 'Vocab Study',
    description: '按一天 12 词推进，保留读音、核心义和短例句。',
    duration: '14 分钟',
    focus: '读音、核心义、对比记忆',
    accent: '#BE123C',
    surface: '#FFE4E6',
  },
  {
    id: 'reading_drill',
    title: '读解实战',
    shortTitle: '读解',
    subtitle: 'Reading Drill',
    description: '按考试节奏先读文章再做题，训练定位证据和排除干扰。',
    duration: '22 分钟',
    focus: '证据定位、题型判断、速读',
    accent: '#4F46E5',
    surface: '#E0E7FF',
  },
  {
    id: 'listening_analyze',
    title: '听力陷阱分析',
    shortTitle: '听力',
    subtitle: 'Listening Analyze',
    description: '拆关键词、转折信号和高频陷阱，比单纯重听更有效。',
    duration: '16 分钟',
    focus: '关键词、转折、陷阱',
    accent: '#7C3AED',
    surface: '#EDE9FE',
  },
  {
    id: 'review_wrong',
    title: '文法错题回收',
    shortTitle: '错题',
    subtitle: 'Grammar Review',
    description: '回收近期最常错的句型点，避免重复踩同一类坑。',
    duration: '10 分钟',
    focus: '弱点聚类、针对强化',
    accent: '#15803D',
    surface: '#DCFCE7',
  },
  {
    id: 'vocab_review_wrong',
    title: '词汇错题回收',
    shortTitle: '回收',
    subtitle: 'Vocab Review',
    description: '按词义、搭配、近义词三类复盘，补齐记忆断层。',
    duration: '10 分钟',
    focus: '近义词、搭配、误选原因',
    accent: '#C2410C',
    surface: '#FFEDD5',
  },
];
