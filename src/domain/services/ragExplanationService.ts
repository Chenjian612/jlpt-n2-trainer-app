import { getAiKnowledgeForQuestion } from '../../data/seed/aiKnowledge';
import type { WrongAnswerExplanation } from '../models/aiExplanation';
import type { WrongAnswerItem } from '../models/trainingContent';

export type RagExplanationRequest = Pick<
  WrongAnswerItem,
  | 'questionId'
  | 'modeId'
  | 'prompt'
  | 'choices'
  | 'answer'
  | 'explanation'
  | 'choiceInsights'
  | 'reviewNote'
  | 'tags'
  | 'source'
  | 'wrongCount'
> & {
  selectedChoice: number;
};

export const buildLocalRagExplanation = (
  request: RagExplanationRequest,
): WrongAnswerExplanation | null => {
  const knowledge = getAiKnowledgeForQuestion(request.questionId);
  if (!knowledge) return null;

  const correctChoice = request.choices[request.answer] ?? '正确选项';
  const selectedChoice = request.choices[request.selectedChoice] ?? '未记录选项';
  const correctReason = request.choiceInsights[request.answer] ?? request.explanation;
  const wrongReason =
    request.choiceInsights[request.selectedChoice] ??
    `「${selectedChoice}」与本题考查的「${knowledge.title}」不匹配。`;

  return {
    testedPoint: knowledge.title,
    mistakePattern:
      request.modeId === 'grammar_drill'
        ? `这次错误反映出对「${knowledge.title}」的接续或语义条件判断不够稳定。`
        : `这次错误反映出对「${knowledge.title}」的词义、搭配或语境限制掌握不够稳定。`,
    whyCorrect: `正确答案是「${correctChoice}」。${correctReason}`,
    whyUserWrong: `你选择了「${selectedChoice}」。${wrongReason}`,
    whyDistractorFooled: wrongReason,
    watchNextTime: knowledge.usage || request.reviewNote,
    choiceAnalysis: request.choices.map((choice, index) => ({
      choice,
      reason: request.choiceInsights[index] ?? '知识库暂未提供这个选项的补充说明。',
      status:
        index === request.answer
          ? 'correct'
          : index === request.selectedChoice
            ? 'selected_wrong'
            : 'other',
    })),
    sources: [
      {
        id: knowledge.id,
        title: `${knowledge.level} ${knowledge.title}`,
        snippet: knowledge.meaning,
        sourceLabel: knowledge.sourceLabel,
        sourceType: 'local_knowledge',
      },
    ],
    confidence: 'high',
    generationMode: 'local_knowledge',
  };
};
