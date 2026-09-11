import type { Grammar200Chapter } from '../models/grammar200';
import type { StudyWeaknessDraft } from '../models/trainingContent';

export type Grammar200SortReviewAttempt = {
  questionId: string;
  correct: boolean;
};

export const getGrammar200PatternWeaknessId = (id: string): string =>
  `grammar200:pattern:${id}`;

export const getGrammar200SortWeaknessId = (id: string): string =>
  `grammar200:sort:${id}`;

export const getGrammar200ChapterDueCount = (
  chapter: Grammar200Chapter,
  dueIds: Set<string>,
): number => [
  ...chapter.patterns.map((pattern) => getGrammar200PatternWeaknessId(pattern.id)),
  ...chapter.sortQuestions.map((question) => getGrammar200SortWeaknessId(question.id)),
].filter((id) => dueIds.has(id)).length;

export const buildGrammar200ReviewDrafts = (
  chapter: Grammar200Chapter,
  unstableByPatternId: Record<string, boolean>,
  sortAttempts: Grammar200SortReviewAttempt[],
): StudyWeaknessDraft[] => {
  const patternDrafts: StudyWeaknessDraft[] = chapter.patterns
    .filter((pattern) =>
      Object.prototype.hasOwnProperty.call(unstableByPatternId, pattern.id),
    )
    .map((pattern) => ({
      item: {
        id: getGrammar200PatternWeaknessId(pattern.id),
        modeId: 'grammar_200',
        term: pattern.term,
        reading: pattern.reading,
        coreMeaning: pattern.meaningZh,
        keyUsage: `${pattern.structure}；${pattern.usage}`,
        confusingPair: pattern.confusingWith ?? '',
        example: pattern.examples[0]?.jp ?? '',
        memoryHook: pattern.memoryHook,
        reviewPrompt: `回忆「${pattern.term}」的核心义、接续和一个例句。`,
      },
      wasConfident: unstableByPatternId[pattern.id] === false,
    }));

  const sortDrafts = sortAttempts.flatMap<StudyWeaknessDraft>((attempt) => {
    const question = chapter.sortQuestions.find(
      (item) => item.id === attempt.questionId,
    );
    if (!question) return [];
    const patternTerms = chapter.patterns
      .filter((pattern) => question.patternRefs.includes(pattern.no))
      .map((pattern) => pattern.term)
      .join(' / ');
    return [{
      item: {
        id: getGrammar200SortWeaknessId(question.id),
        modeId: 'grammar_200',
        term: `排序题 ${question.index}`,
        reading: question.fullSentenceReading,
        coreMeaning: question.fullSentenceZh,
        keyUsage: question.explanation,
        confusingPair: question.fragments.join(' / '),
        example: question.fullSentenceJp,
        memoryHook: patternTerms,
        reviewPrompt: '先锁定句尾，再重新排列四个语块。',
      },
      wasConfident: attempt.correct,
    }];
  });

  return [...patternDrafts, ...sortDrafts];
};
