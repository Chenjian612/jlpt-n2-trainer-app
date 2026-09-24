import { getAiKnowledgeForQuestion } from '../../data/seed/aiKnowledge';
import type { WrongAnswerExplanation } from '../models/aiExplanation';
import type { DrillModeId, ListeningModeId, ReadingModeId } from '../models/training';

export type ReadingRagEvidence = {
  testedPoint: string;
  evidence: string;
};

export type ListeningRagEvidence = {
  testedPoint: string;
  basisLine: string;
  keySignal: string;
  trapPoint: string;
};

export type RagExplanationRequest = {
  questionId: string;
  modeId: DrillModeId | ReadingModeId | ListeningModeId;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
  choiceInsights: string[];
  reviewNote: string;
  tags: string[];
  source: string;
  wrongCount: number;
  selectedChoice: number;
  readingEvidence?: ReadingRagEvidence;
  listeningEvidence?: ListeningRagEvidence;
};

export const buildLocalRagExplanation = (
  request: RagExplanationRequest,
): WrongAnswerExplanation | null => {
  const knowledge = getAiKnowledgeForQuestion(request.questionId);
  const hasReadingEvidence = request.modeId === 'reading_drill' && request.readingEvidence;
  const hasListeningEvidence = request.modeId === 'listening_analyze' && request.listeningEvidence;
  if (!knowledge && !hasReadingEvidence && !hasListeningEvidence) {
    return null;
  }

  const correctChoice = request.choices[request.answer] ?? '正确选项';
  const selectedChoice = request.choices[request.selectedChoice] ?? '未记录选项';
  const correctReason = request.choiceInsights[request.answer] ?? request.explanation;
  const testedPoint =
    knowledge?.title ??
    request.readingEvidence?.testedPoint ??
    request.listeningEvidence!.testedPoint;
  const wrongReason =
    request.choiceInsights[request.selectedChoice] ??
    `「${selectedChoice}」与本题考查的「${testedPoint}」不匹配。`;
  const isListening = request.modeId === 'listening_analyze';
  const isReading = request.modeId === 'reading_drill';

  return {
    testedPoint,
    mistakePattern: isListening
      ? `这次误选说明「${testedPoint}」还不稳定，需要把答案重新锚定到原文依据，而不是停在先出现的信息上。`
      : isReading
        ? `这次误选说明「${testedPoint}」还不稳定，需要把题干要求、原文证据和选项改写重新对齐。`
        : request.modeId === 'grammar_drill'
          ? `这次错误反映出对「${testedPoint}」的接续或语义条件判断不够稳定。`
          : `这次错误反映出对「${testedPoint}」的词义、搭配或语境限制掌握不够稳定。`,
    whyCorrect: `正确答案是「${correctChoice}」。${correctReason}`,
    whyUserWrong: `你选择了「${selectedChoice}」。${wrongReason}`,
    whyDistractorFooled: wrongReason,
    watchNextTime: isListening
      ? `${request.listeningEvidence!.keySignal} ${request.reviewNote}`
      : isReading
        ? `${request.readingEvidence!.evidence} ${request.reviewNote}`
        : knowledge!.usage || request.reviewNote,
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
        id: knowledge?.id ?? `${isReading ? 'reading' : 'listening'}-${request.questionId}`,
        title: knowledge
          ? `${knowledge.level} ${knowledge.title}`
          : `N2 ${isReading ? '读解' : '听力'} ${testedPoint}`,
        snippet:
          knowledge?.meaning ??
          request.readingEvidence?.evidence ??
          request.listeningEvidence!.basisLine,
        sourceLabel: knowledge?.sourceLabel ?? request.source,
        sourceType: 'local_knowledge',
      },
    ],
    confidence: 'high',
    generationMode: 'local_knowledge',
  };
};
