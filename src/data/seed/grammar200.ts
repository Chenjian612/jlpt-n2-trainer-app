import type {
  Grammar200Chapter,
  Grammar200ChapterId,
  Grammar200Pattern,
  Grammar200SortQuestion,
} from '../../domain/models/grammar200';
import data from './n2_grammar_200.json';

type Grammar200JsonRoot = {
  source: string;
  chapters: Grammar200Chapter[];
};

const root = data as Grammar200JsonRoot;

export const GRAMMAR_200_SOURCE_LABEL: string = root.source;

export const GRAMMAR_200_CHAPTERS: Grammar200Chapter[] = root.chapters;

export const getGrammar200ChapterById = (
  chapterId: Grammar200ChapterId,
): Grammar200Chapter | undefined =>
  GRAMMAR_200_CHAPTERS.find((chapter) => chapter.id === chapterId);

export const getPublishedGrammar200Chapters = (): Grammar200Chapter[] =>
  GRAMMAR_200_CHAPTERS.filter((chapter) => chapter.published);

export const findGrammar200PatternByNo = (
  chapter: Grammar200Chapter,
  no: number,
): Grammar200Pattern | undefined =>
  chapter.patterns.find((pattern) => pattern.no === no);

export const getSortQuestionPatternRefs = (
  chapter: Grammar200Chapter,
  question: Grammar200SortQuestion,
): Grammar200Pattern[] =>
  question.patternRefs
    .map((no) => findGrammar200PatternByNo(chapter, no))
    .filter((pattern): pattern is Grammar200Pattern => Boolean(pattern));
