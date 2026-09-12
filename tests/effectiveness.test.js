require('sucrase/register/ts');
const assert = require('node:assert/strict');
const { createDefaultProgressState } = require('../src/domain/services/progressService.ts');
const { getLearningEffectiveness } = require('../src/domain/services/effectivenessService.ts');

module.exports = { name: 'effectiveness', tests: [
  { name: 'summarizes due work, repeated errors, spaced progress and transfer accuracy', run() {
    const state = {
      ...createDefaultProgressState(),
      sessionsByDay: { '2026-09-08': [{ id: 'a', modeId: 'grammar_drill', kind: 'drill', completedAt: '2026-09-08T09:00:00Z' }], '2026-09-07': [{ id: 'b', modeId: 'reading_drill', kind: 'review', completedAt: '2026-09-07T09:00:00Z' }] },
      wrongAnswers: [{ mastered: false, wrongCount: 2, modeId: 'grammar_drill', lastWrongAt: '2026-09-08T08:00:00Z', nextReviewAt: '2026-09-08', questionId: 'g' }],
      weaknessSignals: [{ active: true, wrongCount: 2, lastWrongAt: '2026-09-08T07:00:00Z', reviewBox: 2, nextReviewAt: '2026-09-08T00:00:00Z', modeId: 'reading_drill', questionId: 'r' }],
      studyWeaknesses: [{ active: true, unstableCount: 2, lastUnstableAt: '2026-09-08T06:00:00Z', reviewBox: 3, nextReviewAt: '2026-09-08T00:00:00Z', modeId: 'grammar_study', id: 's' }],
      transferResults: [{ correct: true }, { correct: false }],
    };
    const result = getLearningEffectiveness(state, '2026-09-08', new Date('2026-09-08T12:00:00Z'));
    assert.equal(result.dueReviewCount, 3);
    assert.equal(result.repeatErrorCount, 3);
    assert.equal(result.spacedProgressCount, 2);
    assert.equal(result.transferAccuracy, 0.5);
    assert.equal(result.sessionsLast7Days, 2);
    assert.equal(result.activeDaysLast7Days, 2);
    assert.equal(result.reviewSessionsLast7Days, 1);
    assert.equal(result.recentErrorExposure, 6);
    assert.equal(result.priorErrorExposure, 0);
    assert.equal(result.errorTrend, 'stable');
    assert.equal(result.errorTrendReady, false);
    assert.equal(result.errorExposureBasis, 'legacy_aggregate');
  } },
  { name: 'uses individual error events instead of assigning lifetime counts to the latest date', run() {
    const state = {
      ...createDefaultProgressState(),
      wrongAnswers: [{ mastered: false, wrongCount: 99, modeId: 'grammar_drill', lastWrongAt: '2026-09-08T08:00:00Z', nextReviewAt: '2026-09-08', questionId: 'g' }],
      errorEvents: [
        { id: 'recent-1', occurredAt: '2026-09-08T08:00:00Z', source: 'drill_wrong', modeId: 'grammar_drill', itemId: 'g' },
        { id: 'recent-2', occurredAt: '2026-09-04T08:00:00Z', source: 'study_unstable', modeId: 'vocab_study', itemId: 'v' },
        { id: 'prior-1', occurredAt: '2026-09-01T08:00:00Z', source: 'weakness_wrong', modeId: 'reading_drill', itemId: 'r1' },
        { id: 'prior-2', occurredAt: '2026-08-31T08:00:00Z', source: 'weakness_wrong', modeId: 'reading_drill', itemId: 'r2' },
        { id: 'prior-3', occurredAt: '2026-08-30T08:00:00Z', source: 'review_wrong', modeId: 'grammar_drill', itemId: 'g' },
        { id: 'prior-4', occurredAt: '2026-08-29T08:00:00Z', source: 'study_unstable', modeId: 'grammar_study', itemId: 's' },
      ],
      errorTrackingStartedAt: '2026-08-20T08:00:00Z',
    };

    const result = getLearningEffectiveness(state, '2026-09-08', new Date('2026-09-08T12:00:00Z'));

    assert.equal(result.recentErrorExposure, 2);
    assert.equal(result.priorErrorExposure, 4);
    assert.equal(result.errorTrend, 'improving');
    assert.equal(result.errorTrendReady, true);
    assert.equal(result.errorExposureBasis, 'event_history');
  } },
  { name: 'does not invent a transfer rate without transfer attempts', run() {
    const result = getLearningEffectiveness(createDefaultProgressState(), '2026-09-08', new Date('2026-09-08T12:00:00Z'));
    assert.equal(result.transferAccuracy, null);
    assert.equal(result.dueReviewCount, 0);
    assert.equal(result.errorExposureBasis, 'empty');
    assert.equal(result.errorTrendReady, false);
  } },
] };
