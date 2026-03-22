import type { ReadingModeId } from '../../domain/models/training';
import type { ReadingPassage } from '../../domain/models/trainingContent';
import readingPassagesData from './reading_passages.json';

const READING_PASSAGES: ReadingPassage[] =
  readingPassagesData as ReadingPassage[];

export const getReadingPassagesByMode = (
  modeId: ReadingModeId,
): ReadingPassage[] =>
  READING_PASSAGES.filter((passage) => passage.modeId === modeId);

export const getReadingPassageForSession = (
  modeId: ReadingModeId,
  sessionCount: number = 0,
): ReadingPassage | undefined => {
  const passages = getReadingPassagesByMode(modeId);

  if (passages.length === 0) {
    return undefined;
  }

  const index = ((sessionCount % passages.length) + passages.length) % passages.length;
  return passages[index];
};

export const getReadingPassageByMode = (
  modeId: ReadingModeId,
): ReadingPassage | undefined => getReadingPassageForSession(modeId, 0);
