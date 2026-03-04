import type { ProgressState } from '../../domain/models/progress';
import {
  createDefaultProgressState,
  normalizeProgressState,
} from '../../domain/services/progressService';
import { asyncStorageClient } from '../storage/asyncStorageClient';

export const PROGRESS_STORAGE_KEY = 'jlpt-n2-trainer-state-v1';

export const progressRepository = {
  async load(): Promise<ProgressState> {
    const raw = await asyncStorageClient.getItem(PROGRESS_STORAGE_KEY);
    return normalizeProgressState(raw);
  },

  async save(state: ProgressState): Promise<void> {
    await asyncStorageClient.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify(state),
    );
  },

  createDefaultState(): ProgressState {
    return createDefaultProgressState();
  },
};
