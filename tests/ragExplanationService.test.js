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
const { mergeWrongAnswerAiText } = require('../src/services/aiCoachClient.ts');

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
  ],
};
