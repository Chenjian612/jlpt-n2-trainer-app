export const APP_CONFIG = {
  // Progress & History
  MAX_HISTORY_DAYS: 45,
  DEFAULT_WEEKLY_GOAL: 14,
  MIN_WEEKLY_GOAL: 6,
  MAX_WEEKLY_GOAL: 28,

  // Dashboard & Goals
  DAILY_RECOMMENDATION_LIMIT: 3,
  DAILY_TARGET_SESSIONS: 3,
  
  // Review System
  REVIEW_BATCH_SIZE: 5,
  MASTERED_THRESHOLD: 6, // Times correct before considered mastered
  
  // Priority Weights
  PRIORITY_WEIGHT_NEW: 21,
  PRIORITY_WEIGHT_FREQUENT: 14,
  PRIORITY_WEIGHT_RECENT: 10,
  PRIORITY_WEIGHT_STUDY: 8,

  // Spaced Repetition (Simple)
  STUDY_REAPPEAR_HOURS: 4, // Don't show unstable items again within 4 hours of last look

  // AI Coach
  AI_PROVIDER: 'claude' as 'claude' | 'deepseek',
  AI_API_KEY: process.env.EXPO_PUBLIC_AI_API_KEY ?? '',
};
