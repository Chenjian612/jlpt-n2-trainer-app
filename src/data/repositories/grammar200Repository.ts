import type { Grammar200ProgressState } from '../../domain/models/grammar200';
import { asyncStorageClient } from '../storage/asyncStorageClient';

export const GRAMMAR_200_STORAGE_KEY = 'jlpt-n2-grammar200-progress-v1';

const createDefaultState = (): Grammar200ProgressState => ({
  chapters: {},
  aiExplanationCache: {},
});

const AI_REQUIRED_KEYS = [
  'lockEnding',
  'identifyChunks',
  'chainParticles',
  'finalOrder',
  'transferRule',
] as const;

const filterValidAiCache = (
  cache: Record<string, unknown>,
): Grammar200ProgressState['aiExplanationCache'] => {
  const out: Grammar200ProgressState['aiExplanationCache'] = {};
  for (const [key, raw] of Object.entries(cache)) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const allValid = AI_REQUIRED_KEYS.every((k) => typeof entry[k] === 'string');
    if (!allValid) continue;
    out[key] = {
      lockEnding: entry.lockEnding as string,
      identifyChunks: entry.identifyChunks as string,
      chainParticles: entry.chainParticles as string,
      finalOrder: entry.finalOrder as string,
      transferRule: entry.transferRule as string,
      generatedAt:
        typeof entry.generatedAt === 'string'
          ? entry.generatedAt
          : new Date().toISOString(),
    };
  }
  return out;
};

const normalizeProgressState = (value: unknown): Grammar200ProgressState => {
  if (!value || typeof value !== 'object') return createDefaultState();
  const candidate = value as Partial<Grammar200ProgressState> & {
    aiExplanationCache?: Record<string, unknown>;
  };
  return {
    chapters:
      candidate.chapters && typeof candidate.chapters === 'object'
        ? candidate.chapters
        : {},
    aiExplanationCache:
      candidate.aiExplanationCache &&
      typeof candidate.aiExplanationCache === 'object'
        ? filterValidAiCache(candidate.aiExplanationCache)
        : {},
  };
};

export const grammar200Repository = {
  async load(): Promise<Grammar200ProgressState> {
    const raw = await asyncStorageClient.getItem(GRAMMAR_200_STORAGE_KEY);
    if (!raw) return createDefaultState();

    try {
      const parsed = JSON.parse(raw) as unknown;
      return normalizeProgressState(parsed);
    } catch {
      return createDefaultState();
    }
  },

  async save(state: Grammar200ProgressState): Promise<void> {
    await asyncStorageClient.setItem(
      GRAMMAR_200_STORAGE_KEY,
      JSON.stringify(state),
    );
  },

  createDefaultState,
};
