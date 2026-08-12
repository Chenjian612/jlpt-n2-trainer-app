require('sucrase/register/ts');

const assert = require('node:assert/strict');

const {
  AI_KNOWLEDGE_ENTRIES,
  AI_QUESTION_MAPPINGS,
  getAiKnowledgeForQuestion,
} = require('../src/data/seed/aiKnowledge.ts');
const {
  buildLocalRagExplanation,
} = require('../src/domain/services/ragExplanationService.ts');
const {
  buildTutorLearningContext,
  getTutorCacheKey,
} = require('../src/domain/services/personalizedTutorService.ts');
const {
  mergePersonalizedTutorResponse,
  mergeWrongAnswerAiText,
} = require('../src/services/aiCoachClient.ts');

const grammarQuestion = require('../src/data/seed/drill_questions.json')[0];

module.exports = {
  name: 'ragExplanationService',
  tests: [
    {
      name: 'indexes every grammar and vocabulary drill question',
      run() {
        assert.equal(AI_KNOWLEDGE_ENTRIES.length, 800);
        assert.equal(AI_QUESTION_MAPPINGS.length, 800);
        assert.equal(getAiKnowledgeForQuestion('grammar-001').title, 'わけにはいかない');
      },
    },
    {
      name: 'builds grounded explanation with source and choice evidence',
      run() {
        const result = buildLocalRagExplanation({
          ...grammarQuestion,
          questionId: grammarQuestion.id,
          selectedChoice: 1,
          wrongCount: 2,
        });

        assert.ok(result);
        assert.equal(result.testedPoint, 'わけにはいかない');
        assert.equal(result.sources[0].id, 'knowledge-grammar-001');
        assert.equal(result.choiceAnalysis[0].status, 'correct');
        assert.equal(result.choiceAnalysis[1].status, 'selected_wrong');
        assert.equal(result.generationMode, 'local_knowledge');
      },
    },
    {
      name: 'refuses to explain a question without mapped evidence',
      run() {
        const result = buildLocalRagExplanation({
          ...grammarQuestion,
          questionId: 'missing-question',
          selectedChoice: 1,
          wrongCount: 1,
        });
        assert.equal(result, null);
      },
    },
    {
      name: 'AI text merge cannot overwrite answer evidence or sources',
      run() {
        const local = buildLocalRagExplanation({
          ...grammarQuestion,
          questionId: grammarQuestion.id,
          selectedChoice: 1,
          wrongCount: 2,
        });
        const result = mergeWrongAnswerAiText(local, {
          mistakePattern: 'AI 错误模式',
          whyCorrect: 'AI 正确原因',
          whyUserWrong: 'AI 误选原因',
          whyDistractorFooled: 'AI 干扰项原因',
          watchNextTime: 'AI 复习建议',
          testedPoint: '伪造考点',
          sources: [{ title: '伪造来源' }],
        });

        assert.equal(result.generationMode, 'ai_service');
        assert.equal(result.whyCorrect, 'AI 正确原因');
        assert.equal(result.testedPoint, local.testedPoint);
        assert.deepEqual(result.sources, local.sources);
        assert.deepEqual(result.choiceAnalysis, local.choiceAnalysis);
      },
    },
    {
      name: 'personalized tutor locks factual learning context',
      run() {
        const params = {
          ...grammarQuestion,
          questionId: grammarQuestion.id,
          selectedChoice: 1,
          wrongCount: 3,
          weaknessType: '近义句型辨析',
          recentSimilarWrongCount: 2,
          recentSimilarPointIds: ['grammar-002'],
        };
        const local = buildLocalRagExplanation(params);
        const result = mergePersonalizedTutorResponse(
          {
            diagnosisSummary: '个性化诊断',
            whyYouChoseIt: '误选原因',
            reasoningSteps: ['第一步', '第二步', '第三步'],
            confusionComparison: {
              correctPoint: '伪造考点',
              confusedPoint: '伪造误选',
              decisiveDifference: '决定性差异',
            },
            reviewPlan: [{ timing: 'now', action: '立即对比' }],
            personalizationEvidence: { wrongCount: 99 },
            transferQuestion: {
              prompt: '迁移题',
              choices: ['A', 'B'],
              answer: 0,
              testedPoint: '伪造考点',
              explanation: '迁移解释',
            },
          },
          local,
          params,
        );

        assert.equal(result.confusionComparison.correctPoint, local.testedPoint);
        assert.equal(result.confusionComparison.confusedPoint, grammarQuestion.choices[1]);
        assert.equal(result.personalizationEvidence.wrongCount, 3);
        assert.equal(result.personalizationEvidence.recentSimilarWrongCount, 2);
        assert.equal(result.transferQuestion.testedPoint, local.testedPoint);
      },
    },
    {
      name: 'tutor context version changes after transfer verification',
      run() {
        const item = {
          questionId: grammarQuestion.id,
          modeId: grammarQuestion.modeId,
          prompt: grammarQuestion.prompt,
          choices: grammarQuestion.choices,
          answer: grammarQuestion.answer,
          explanation: grammarQuestion.explanation,
          choiceInsights: grammarQuestion.choiceInsights,
          reviewNote: grammarQuestion.reviewNote,
          tags: grammarQuestion.tags,
          source: grammarQuestion.source,
          wrongCount: 3,
          firstWrongAt: '2026-08-01T00:00:00.000Z',
          lastWrongAt: '2026-08-12T00:00:00.000Z',
          lastUserChoice: 1,
          mastered: false,
          errorTypes: ['grammar_judgement'],
          leitnerBox: 1,
          nextReviewAt: '2026-08-12',
        };
        const baseState = {
          weeklyGoal: 14,
          sessionsByDay: {},
          wrongAnswers: [item],
          weaknessSignals: [],
          studyWeaknesses: [],
          aiExplanationCache: {},
          personalizedTutorCache: {},
          transferResults: [],
        };
        const before = buildTutorLearningContext(baseState, item, 1);
        const after = buildTutorLearningContext(
          {
            ...baseState,
            transferResults: [
              {
                questionId: item.questionId,
                contextVersion: before.contextVersion,
                selectedChoice: 0,
                correct: true,
                answeredAt: '2026-08-12T01:00:00.000Z',
              },
            ],
          },
          item,
          1,
        );

        assert.notEqual(before.contextVersion, after.contextVersion);
        assert.notEqual(
          getTutorCacheKey(item.questionId, before.contextVersion),
          getTutorCacheKey(item.questionId, after.contextVersion),
        );
      },
    },
  ],
};
