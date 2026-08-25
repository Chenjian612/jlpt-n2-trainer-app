require('sucrase/register/ts');

const assert = require('node:assert/strict');

const { createDefaultProgressState } = require('../src/domain/services/progressService.ts');
const {
  getCrossModuleWeaknessSummary,
  getDashboardWeaknessSnapshot,
} = require('../src/domain/services/coachService.ts');

const wrongAnswer = (overrides = {}) => ({
  questionId: 'grammar-001',
  modeId: 'grammar_drill',
  prompt: 'Q',
  choices: ['A', 'B'],
  answer: 0,
  explanation: 'exp',
  choiceInsights: ['a', 'b'],
  reviewNote: 'note',
  tags: ['文法', '限制'],
  source: 'src',
  wrongCount: 3,
  firstWrongAt: '2026-08-20T00:00:00.000Z',
  lastWrongAt: '2026-08-24T00:00:00.000Z',
  lastUserChoice: 1,
  mastered: false,
  errorTypes: ['grammar_constraint'],
  leitnerBox: 1,
  nextReviewAt: '2026-08-25T00:00:00.000Z',
  ...overrides,
});

module.exports = {
  name: 'crossModuleWeakness',
  tests: [
    {
      name: 'aggregates active records across four learning modules',
      run() {
        const state = {
          ...createDefaultProgressState(),
          wrongAnswers: [
            wrongAnswer(),
            wrongAnswer({ questionId: 'vocab-001', modeId: 'vocab_drill', mastered: true }),
          ],
          weaknessSignals: [
            {
              questionId: 'reading-001-q1',
              modeId: 'reading_drill',
              prompt: 'R',
              source: 'src',
              tags: ['细节题'],
              wrongCount: 2,
              firstWrongAt: '2026-08-20T00:00:00.000Z',
              lastWrongAt: '2026-08-24T00:00:00.000Z',
              active: true,
              errorTypes: ['reading_evidence'],
            },
            {
              questionId: 'listening-q1',
              modeId: 'listening_analyze',
              prompt: 'L',
              source: 'src',
              tags: ['最终决定'],
              wrongCount: 5,
              firstWrongAt: '2026-08-20T00:00:00.000Z',
              lastWrongAt: '2026-08-24T00:00:00.000Z',
              active: false,
              errorTypes: ['listening_final_decision'],
            },
          ],
          studyWeaknesses: [
            {
              id: 'vocab-study-1',
              modeId: 'vocab_study',
              term: '分担',
              coreMeaning: '分担',
              keyUsage: '',
              confusingPair: '',
              example: '',
              memoryHook: '',
              reviewPrompt: '',
              unstableCount: 2,
              firstUnstableAt: '2026-08-20T00:00:00.000Z',
              lastUnstableAt: '2026-08-24T00:00:00.000Z',
              active: true,
            },
          ],
        };

        const summary = getCrossModuleWeaknessSummary(state);
        assert.equal(summary.activeModuleCount, 3);
        assert.equal(summary.activeItemCount, 3);
        assert.equal(summary.exposureCount, 7);
        assert.deepEqual(
          summary.modules.map(({ id, activeItems, exposureCount }) => ({
            id,
            activeItems,
            exposureCount,
          })),
          [
            { id: 'grammar', activeItems: 1, exposureCount: 3 },
            { id: 'vocab', activeItems: 1, exposureCount: 2 },
            { id: 'reading', activeItems: 1, exposureCount: 2 },
            { id: 'listening', activeItems: 0, exposureCount: 0 },
          ],
        );
      },
    },
    {
      name: 'summarizes transfer accuracy and latest retry questions',
      run() {
        const state = {
          ...createDefaultProgressState(),
          transferResults: [
            { questionId: 'grammar-001', contextVersion: '1', selectedChoice: 0, correct: true, answeredAt: '2026-08-20' },
            { questionId: 'grammar-001', contextVersion: '2', selectedChoice: 1, correct: false, answeredAt: '2026-08-21' },
            { questionId: 'vocab-001', contextVersion: '1', selectedChoice: 0, correct: true, answeredAt: '2026-08-22' },
          ],
        };

        const summary = getCrossModuleWeaknessSummary(state);
        assert.equal(summary.transferVerification.attempts, 3);
        assert.equal(summary.transferVerification.correctCount, 2);
        assert.equal(summary.transferVerification.accuracy, 2 / 3);
        assert.equal(summary.transferVerification.retryQuestionCount, 1);
      },
    },
    {
      name: 'dashboard snapshot always exposes the cross-module summary',
      run() {
        const snapshot = getDashboardWeaknessSnapshot(
          createDefaultProgressState(),
          '2026-08-25',
        );
        assert.equal(snapshot.crossModuleSummary.activeItemCount, 0);
        assert.equal(snapshot.crossModuleSummary.modules.length, 4);
        assert.equal(snapshot.crossModuleSummary.transferVerification.accuracy, null);
      },
    },
  ],
};
