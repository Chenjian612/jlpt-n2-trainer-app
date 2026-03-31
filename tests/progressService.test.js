require('sucrase/register/ts');

const assert = require('node:assert/strict');

const {
  clampWeeklyGoal,
  clearDay,
  createDefaultProgressState,
  createTrainingSession,
  getActiveStudyWeaknesses,
  getCompletedModeIdsForDay,
  getModeSessionCountForDay,
  getPrioritizedWrongAnswersForMode,
  getWrongAnswerPriorityLabel,
  getWrongAnswerPriorityScore,
  normalizeProgressState,
  recordDrillSessionResult,
  recordStudyWeaknesses,
  recordTrainingSession,
  recordWeaknessSignals,
  recordWrongAnswers,
  recordWrongReviewSession,
  removeLatestSessionForMode,
} = require('../src/domain/services/progressService.ts');

const buildStudyDraft = (overrides = {}) => ({
  item: {
    id: 'grammar-study-1',
    modeId: 'grammar_study',
    term: 'わけではない',
    reading: undefined,
    coreMeaning: 'not necessarily',
    keyUsage: 'Used to partially deny a generalization.',
    confusingPair: 'わけがない',
    example: '毎日残業しているが、仕事が嫌いなわけではない。',
    memoryHook: 'Partial denial, not total negation.',
    reviewPrompt: 'Explain the nuance difference from わけがない.',
    ...overrides,
  },
  wasConfident: false,
});

const buildWrongAnswerDraft = (overrides = {}) => ({
  question: {
    id: 'grammar-q1',
    modeId: 'grammar_drill',
    prompt: '最も自然な文を選んでください。',
    choices: ['A', 'B', 'C', 'D'],
    answer: 2,
    explanation: 'C is correct because it matches the grammar constraint.',
    choiceInsights: ['A wrong', 'B wrong', 'C right', 'D wrong'],
    reviewNote: 'Check the grammar trigger before choosing.',
    tags: ['限制'],
    source: 'unit-test',
    ...overrides,
  },
  selectedChoice: 1,
});

const buildWeaknessSignalDraft = (overrides = {}) => ({
  questionId: 'reading-q1',
  modeId: 'reading_drill',
  prompt: 'Find the author\'s claim.',
  source: 'unit-test',
  tags: ['reading_evidence'],
  wasCorrect: false,
  ...overrides,
});

module.exports = {
  name: 'progressService',
  tests: [
    {
      name: 'clampWeeklyGoal respects min max and rounding',
      run() {
        assert.equal(clampWeeklyGoal(1), 6);
        assert.equal(clampWeeklyGoal(28.4), 28);
        assert.equal(clampWeeklyGoal(10.6), 11);
      },
    },
    {
      name: 'normalizeProgressState returns defaults for null and invalid json',
      run() {
        assert.deepEqual(normalizeProgressState(null), createDefaultProgressState());
        assert.deepEqual(normalizeProgressState('{bad json'), createDefaultProgressState());
      },
    },
    {
      name: 'normalizeProgressState migrates legacy completedByDay and sanitizes weeklyGoal',
      run() {
        const raw = JSON.stringify({
          weeklyGoal: 100,
          completedByDay: {
            '2026-03-19': ['grammar_drill', 'review_wrong', 'bad_mode'],
          },
        });

        const state = normalizeProgressState(raw);

        assert.equal(state.weeklyGoal, 28);
        assert.equal(state.sessionsByDay['2026-03-19'].length, 2);
        assert.deepEqual(getCompletedModeIdsForDay(state, '2026-03-19'), ['grammar_drill', 'review_wrong']);
      },
    },
    {
      name: 'normalizeProgressState infers missing error types and drops invalid records',
      run() {
        const raw = JSON.stringify({
          wrongAnswers: [
            {
              questionId: 'q1',
              modeId: 'grammar_drill',
              prompt: 'Q1',
              choices: ['A', 'B'],
              answer: 0,
              explanation: 'exp',
              source: 'src',
              tags: ['限制'],
            },
            { bad: true },
          ],
          weaknessSignals: [
            {
              questionId: 'r1',
              modeId: 'reading_drill',
              prompt: 'R1',
              source: 'src',
              tags: ['reading_evidence'],
            },
          ],
          studyWeaknesses: [
            {
              id: 's1',
              modeId: 'grammar_study',
              term: 'わけではない',
            },
          ],
        });

        const state = normalizeProgressState(raw);

        assert.equal(state.wrongAnswers.length, 1);
        assert.deepEqual(state.wrongAnswers[0].errorTypes, ['grammar_constraint']);
        assert.equal(state.weaknessSignals.length, 1);
        assert.deepEqual(state.weaknessSignals[0].errorTypes, ['reading_evidence']);
        assert.equal(state.studyWeaknesses.length, 1);
      },
    },
    {
      name: 'priority label covers new overdue stable and high priority branches',
      run() {
        const base = {
          questionId: 'q',
          modeId: 'grammar_drill',
          prompt: 'Q',
          choices: ['A', 'B'],
          answer: 0,
          explanation: 'exp',
          choiceInsights: ['', ''],
          reviewNote: 'note',
          tags: [],
          source: 'src',
          wrongCount: 1,
          firstWrongAt: '2026-03-18T00:00:00.000Z',
          lastWrongAt: '2026-03-18T00:00:00.000Z',
          lastUserChoice: 1,
          mastered: false,
          errorTypes: ['grammar_constraint'],
        };

        assert.equal(getWrongAnswerPriorityLabel({ ...base, wrongCount: 3 }), '高优先级');
        assert.equal(getWrongAnswerPriorityLabel(base), '待首次回收');
        assert.equal(getWrongAnswerPriorityLabel({ ...base, lastReviewedAt: '2026-03-01T00:00:00.000Z' }), '该复习了');
        assert.equal(getWrongAnswerPriorityLabel({ ...base, lastReviewedAt: new Date().toISOString() }), '继续巩固');
      },
    },
    {
      name: 'prioritized wrong answers sort by score and ignore mastered items',
      run() {
        const now = new Date().toISOString();
        const old = '2026-03-01T00:00:00.000Z';
        const state = {
          ...createDefaultProgressState(),
          wrongAnswers: [
            {
              questionId: 'low',
              modeId: 'grammar_drill',
              prompt: 'low',
              choices: ['A', 'B'],
              answer: 0,
              explanation: 'exp',
              choiceInsights: ['', ''],
              reviewNote: 'note',
              tags: [],
              source: 'src',
              wrongCount: 1,
              firstWrongAt: old,
              lastWrongAt: old,
              lastUserChoice: 1,
              mastered: false,
              errorTypes: ['grammar_constraint'],
            },
            {
              questionId: 'high',
              modeId: 'grammar_drill',
              prompt: 'high',
              choices: ['A', 'B'],
              answer: 0,
              explanation: 'exp',
              choiceInsights: ['', ''],
              reviewNote: 'note',
              tags: [],
              source: 'src',
              wrongCount: 4,
              firstWrongAt: old,
              lastWrongAt: now,
              lastUserChoice: 1,
              mastered: false,
              errorTypes: ['grammar_constraint'],
            },
            {
              questionId: 'mastered',
              modeId: 'grammar_drill',
              prompt: 'mastered',
              choices: ['A', 'B'],
              answer: 0,
              explanation: 'exp',
              choiceInsights: ['', ''],
              reviewNote: 'note',
              tags: [],
              source: 'src',
              wrongCount: 10,
              firstWrongAt: old,
              lastWrongAt: now,
              lastUserChoice: 1,
              mastered: true,
              errorTypes: ['grammar_constraint'],
            },
          ],
        };

        const prioritized = getPrioritizedWrongAnswersForMode(state, 'grammar_drill', 2);

        assert.deepEqual(prioritized.map((item) => item.questionId), ['high', 'low']);
        assert.equal(getWrongAnswerPriorityScore(prioritized[0]) > getWrongAnswerPriorityScore(prioritized[1]), true);
      },
    },
    {
      name: 'recordWrongAnswers increments an existing item and clears mastered status',
      run() {
        const initial = recordWrongAnswers(createDefaultProgressState(), [buildWrongAnswerDraft()], new Date('2026-03-19T09:00:00.000Z'));
        initial.wrongAnswers[0].mastered = true;

        const next = recordWrongAnswers(initial, [buildWrongAnswerDraft()], new Date('2026-03-19T10:00:00.000Z'));

        assert.equal(next.wrongAnswers.length, 1);
        assert.equal(next.wrongAnswers[0].wrongCount, 2);
        assert.equal(next.wrongAnswers[0].mastered, false);
        assert.equal(next.wrongAnswers[0].lastWrongAt, '2026-03-19T10:00:00.000Z');
      },
    },
    {
      name: 'recordWeaknessSignals activates on wrong answer and resolves on correct answer',
      run() {
        const wrongState = recordWeaknessSignals(
          createDefaultProgressState(),
          [buildWeaknessSignalDraft()],
          new Date('2026-03-19T09:00:00.000Z'),
        );
        const resolvedState = recordWeaknessSignals(
          wrongState,
          [buildWeaknessSignalDraft({ wasCorrect: true })],
          new Date('2026-03-19T10:00:00.000Z'),
        );

        assert.equal(wrongState.weaknessSignals[0].active, true);
        assert.equal(resolvedState.weaknessSignals[0].active, false);
        assert.equal(resolvedState.weaknessSignals[0].lastResolvedAt, '2026-03-19T10:00:00.000Z');
      },
    },
    {
      name: 'study weaknesses stay hidden until the 4-hour cooldown has passed',
      run() {
        const recordedAt = new Date('2026-03-19T08:00:00.000Z');
        const state = recordStudyWeaknesses(
          createDefaultProgressState(),
          [buildStudyDraft()],
          recordedAt,
        );

        const tooSoon = getActiveStudyWeaknesses(
          state,
          'grammar_study',
          new Date('2026-03-19T11:59:59.000Z'),
        );
        const readyAgain = getActiveStudyWeaknesses(
          state,
          'grammar_study',
          new Date('2026-03-19T12:00:00.000Z'),
        );

        assert.equal(tooSoon.length, 0);
        assert.equal(readyAgain.length, 1);
      },
    },
    {
      name: 'recordStudyWeaknesses resolves an item when user is confident again',
      run() {
        const unstable = recordStudyWeaknesses(
          createDefaultProgressState(),
          [buildStudyDraft()],
          new Date('2026-03-19T08:00:00.000Z'),
        );
        const resolved = recordStudyWeaknesses(
          unstable,
          [{ ...buildStudyDraft(), wasConfident: true }],
          new Date('2026-03-19T13:00:00.000Z'),
        );

        assert.equal(resolved.studyWeaknesses[0].active, false);
        assert.equal(resolved.studyWeaknesses[0].lastResolvedAt, '2026-03-19T13:00:00.000Z');
      },
    },
    {
      name: 'recordDrillSessionResult writes both a session and wrong answers',
      run() {
        const next = recordDrillSessionResult(
          createDefaultProgressState(),
          '2026-03-19',
          'grammar_drill',
          'drill',
          [buildWrongAnswerDraft()],
          new Date('2026-03-19T09:00:00.000Z'),
        );

        assert.equal(getModeSessionCountForDay(next, '2026-03-19', 'grammar_drill'), 1);
        assert.equal(next.wrongAnswers.length, 1);
      },
    },
    {
      name: 'wrong review writes back the re-answer choice and mastery result',
      run() {
        const wrongState = recordWrongAnswers(
          createDefaultProgressState(),
          [buildWrongAnswerDraft()],
          new Date('2026-03-19T09:00:00.000Z'),
        );

        const reviewedState = recordWrongReviewSession(
          wrongState,
          '2026-03-19',
          'review_wrong',
          [{ questionId: 'grammar-q1', selectedChoice: 2, mastered: true }],
          new Date('2026-03-19T10:00:00.000Z'),
        );

        // Leitner: answering correctly advances box (1→2), not immediately mastered.
        // mastered only becomes true when box reaches 5.
        assert.equal(reviewedState.wrongAnswers[0].mastered, false);
        assert.equal(reviewedState.wrongAnswers[0].leitnerBox, 2);
        assert.equal(reviewedState.wrongAnswers[0].nextReviewAt, '2026-03-21'); // box 2 = +2 days
        assert.equal(reviewedState.wrongAnswers[0].lastUserChoice, 2);
        assert.equal(reviewedState.wrongAnswers[0].lastReviewedAt, '2026-03-19T10:00:00.000Z');
        assert.equal(reviewedState.sessionsByDay['2026-03-19'].length, 1);
      },
    },
    {
      name: 'removeLatestSessionForMode removes only the latest matching record',
      run() {
        let state = createDefaultProgressState();
        state = recordTrainingSession(state, '2026-03-19', createTrainingSession('2026-03-19', 'grammar_drill', 'drill', new Date('2026-03-19T09:00:00.000Z')));
        state = recordTrainingSession(state, '2026-03-19', createTrainingSession('2026-03-19', 'vocab_drill', 'drill', new Date('2026-03-19T10:00:00.000Z')));
        state = recordTrainingSession(state, '2026-03-19', createTrainingSession('2026-03-19', 'grammar_drill', 'drill', new Date('2026-03-19T11:00:00.000Z')));

        const next = removeLatestSessionForMode(state, '2026-03-19', 'grammar_drill');

        assert.equal(getModeSessionCountForDay(next, '2026-03-19', 'grammar_drill'), 1);
        assert.equal(getModeSessionCountForDay(next, '2026-03-19', 'vocab_drill'), 1);
      },
    },
    {
      name: 'clearDay removes sessions for the target day only',
      run() {
        let state = createDefaultProgressState();
        state = recordTrainingSession(state, '2026-03-18', createTrainingSession('2026-03-18', 'grammar_drill', 'drill', new Date('2026-03-18T09:00:00.000Z')));
        state = recordTrainingSession(state, '2026-03-19', createTrainingSession('2026-03-19', 'vocab_drill', 'drill', new Date('2026-03-19T09:00:00.000Z')));

        const next = clearDay(state, '2026-03-19');

        assert.equal(next.sessionsByDay['2026-03-19'], undefined);
        assert.equal(next.sessionsByDay['2026-03-18'].length, 1);
      },
    },
  ],
};

