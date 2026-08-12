import type { DrillQuestion } from '../../domain/models/trainingContent';
import { DRILL_QUESTIONS } from './drillQuestions';

export type AiKnowledgeEntry = {
  id: string;
  type: 'grammar' | 'vocab';
  level: 'N2';
  title: string;
  meaning: string;
  usage: string;
  sourceLabel: string;
  questionId: string;
};

export type AiQuestionMapping = {
  questionId: string;
  testedPointId: string;
};

const isSupportedQuestion = (question: DrillQuestion): boolean =>
  question.modeId === 'grammar_drill' || question.modeId === 'vocab_drill';

const toKnowledgeEntry = (question: DrillQuestion): AiKnowledgeEntry => ({
  id: `knowledge-${question.id}`,
  type: question.modeId === 'grammar_drill' ? 'grammar' : 'vocab',
  level: 'N2',
  title: question.tags[1] ?? question.choices[question.answer] ?? question.id,
  meaning: question.explanation,
  usage: question.reviewNote,
  sourceLabel: question.source,
  questionId: question.id,
});

export const AI_KNOWLEDGE_ENTRIES: AiKnowledgeEntry[] = DRILL_QUESTIONS
  .filter(isSupportedQuestion)
  .map(toKnowledgeEntry);

export const AI_QUESTION_MAPPINGS: AiQuestionMapping[] = AI_KNOWLEDGE_ENTRIES.map(
  (entry) => ({
    questionId: entry.questionId,
    testedPointId: entry.id,
  }),
);

const knowledgeById = new Map(AI_KNOWLEDGE_ENTRIES.map((entry) => [entry.id, entry]));
const mappingByQuestionId = new Map(
  AI_QUESTION_MAPPINGS.map((mapping) => [mapping.questionId, mapping]),
);

export const getAiKnowledgeForQuestion = (
  questionId: string,
): AiKnowledgeEntry | null => {
  const mapping = mappingByQuestionId.get(questionId);
  return mapping ? knowledgeById.get(mapping.testedPointId) ?? null : null;
};
