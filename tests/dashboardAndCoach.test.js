require('sucrase/register/ts');

const assert = require('node:assert/strict');

const { TRAINING_MODES } = require('../src/data/seed/trainingModes.ts');
const {
  buildRecentWeek,
  getDashboardInsight,
  getDashboardMetrics,
  getProgressRatio,
  getRecommendedModes,
  getTodayPlan,
} = require('../src/domain/services/dashboardService.ts');
const { getDashboardWeaknessSnapshot } = require('../src/domain/services/coachService.ts');
const { createDefaultProgressState } = require('../src/domain/services/progressService.ts');

const session = (dayKey, modeId, completedAt, kind = 'drill') => ({
  id: `${dayKey}:${modeId}:${completedAt}`,
  modeId,
  completedAt,
  kind,
});

module.exports = {
  name: 'dashboardAndCoach',
  tests: [
    {
      name: 'progress ratio handles zero totals and caps at one',
      run() {
        assert.equal(getProgressRatio(1, 0), 0);
        assert.equal(getProgressRatio(5, 4), 1);
        assert.equal(getProgressRatio(1, 4), 0.25);
      },
    },
    {
      name: 'recommended modes prioritize review backlog first',
      run() {
        const state = {
          ...createDefaultProgressState(),
          wrongAnswers: [
            {
              questionId: 'q1',
              modeId: 'grammar_drill',
              prompt: 'Q1',
              choices: ['A', 'B'],
              answer: 0,
              explanation: 'exp',
              choiceInsights: ['', ''],
              reviewNote: 'note',
              tags: ['grammar_constraint'],
              source: 'src',
              wrongCount: 2,
              firstWrongAt: '2026-03-18T09:00:00.000Z',
              lastWrongAt: '2026-03-19T09:00:00.000Z',
              lastUserChoice: 1,
              mastered: false,
              errorTypes: ['grammar_constraint'],
            },
          ],
        };

        const recommended = getRecommendedModes(TRAINING_MODES, state, '2026-03-19');
        assert.equal(recommended[0].id, 'review_wrong');
      },
    },
    {
      name: 'recommended modes prioritize study backlog when review backlog is empty',
      run() {
        const state = {
          ...createDefaultProgressState(),
          studyWeaknesses: [
            {
              id: 's1',
              modeId: 'grammar_study',
              term: 'わけではない',
              coreMeaning: 'not necessarily',
              keyUsage: '',
              confusingPair: '',
              example: '',
              memoryHook: '',
              reviewPrompt: '',
              unstableCount: 2,
              firstUnstableAt: '2026-03-18T09:00:00.000Z',
              lastUnstableAt: '2026-03-19T00:00:00.000Z',
              active: true,
            },
          ],
        };

        const recommended = getRecommendedModes(TRAINING_MODES, state, '2026-03-19');
        assert.equal(recommended[0].id, 'grammar_study');
      },
    },
    {
      name: 'today plan is capped by the recommendation limit',
      run() {
        const state = createDefaultProgressState();
        const plan = getTodayPlan(TRAINING_MODES, state, '2026-03-19');

        assert.equal(plan.length, 3);
      },
    },
    {
      name: 'dashboard metrics compute streak weekly totals and capability distribution',
      run() {
        const state = {
          ...createDefaultProgressState(),
          sessionsByDay: {
            '2026-03-16': [session('2026-03-16', 'grammar_drill', '2026-03-16T09:00:00.000Z')],
            '2026-03-17': [session('2026-03-17', 'vocab_drill', '2026-03-17T09:00:00.000Z')],
            '2026-03-18': [session('2026-03-18', 'reading_drill', '2026-03-18T09:00:00.000Z')],
            '2026-03-19': [session('2026-03-19', 'listening_analyze', '2026-03-19T09:00:00.000Z')],
          },
        };

        const metrics = getDashboardMetrics(state, '2026-03-19');

        assert.equal(metrics.todayCompletedCount, 1);
        assert.equal(metrics.weeklySessions, 4);
        assert.equal(metrics.totalSessions, 4);
        assert.equal(metrics.currentStreak, 4);
        assert.equal(metrics.bestStreak, 4);
        assert.deepEqual(metrics.capabilityDistribution, {
          grammar: 1,
          vocab: 1,
          reading: 1,
          listening: 1,
        });
      },
    },
    {
      name: 'dashboard insight enters recovering mode for review backlog',
      run() {
        const state = {
          ...createDefaultProgressState(),
          wrongAnswers: [
            {
              questionId: 'q1',
              modeId: 'grammar_drill',
              prompt: 'Q1',
              choices: ['A', 'B'],
              answer: 0,
              explanation: 'exp',
              choiceInsights: ['', ''],
              reviewNote: 'note',
              tags: ['grammar_constraint'],
              source: 'src',
              wrongCount: 1,
              firstWrongAt: '2026-03-18T09:00:00.000Z',
              lastWrongAt: '2026-03-19T09:00:00.000Z',
              lastUserChoice: 1,
              mastered: false,
              errorTypes: ['grammar_constraint'],
            },
          ],
        };

        const insight = getDashboardInsight(state, '2026-03-19', 14, TRAINING_MODES);
        assert.equal(insight.battleState, 'recovering');
        assert.equal(insight.tone, 'review');
      },
    },
    {
      name: 'dashboard insight enters recovering mode for study backlog',
      run() {
        const state = {
          ...createDefaultProgressState(),
          studyWeaknesses: [
            {
              id: 's1',
              modeId: 'grammar_study',
              term: 'わけではない',
              coreMeaning: 'not necessarily',
              keyUsage: '',
              confusingPair: '',
              example: '',
              memoryHook: '',
              reviewPrompt: '',
              unstableCount: 2,
              firstUnstableAt: '2026-03-18T09:00:00.000Z',
              lastUnstableAt: '2026-03-18T23:00:00.000Z',
              active: true,
            },
          ],
        };

        const insight = getDashboardInsight(state, '2026-03-19', 14, TRAINING_MODES.filter((mode) => mode.id === 'grammar_study'));
        assert.equal(insight.battleState, 'recovering');
        assert.equal(insight.recommendedModeId, 'grammar_study');
      },
    },
    {
      name: 'dashboard insight enters first battle mode at the start of the day',
      run() {
        const insight = getDashboardInsight(createDefaultProgressState(), '2026-03-19', 14, TRAINING_MODES.slice(0, 3));
        assert.equal(insight.battleState, 'first_battle');
      },
    },
    {
      name: 'dashboard insight stays in sprint mode until the daily target is reached',
      run() {
        const state = {
          ...createDefaultProgressState(),
          sessionsByDay: {
            '2026-03-19': [session('2026-03-19', 'grammar_drill', '2026-03-19T09:00:00.000Z')],
          },
        };

        const insight = getDashboardInsight(state, '2026-03-19', 14, TRAINING_MODES.slice(0, 3));

        assert.equal(insight.battleState, 'sprint');
        assert.equal(insight.headline.includes('2'), true);
      },
    },
    {
      name: 'dashboard insight enters push mode when daily target is done but weekly target is not',
      run() {
        const state = {
          ...createDefaultProgressState(),
          sessionsByDay: {
            '2026-03-19': [
              session('2026-03-19', 'grammar_drill', '2026-03-19T09:00:00.000Z'),
              session('2026-03-19', 'vocab_drill', '2026-03-19T10:00:00.000Z'),
              session('2026-03-19', 'reading_drill', '2026-03-19T11:00:00.000Z'),
            ],
          },
        };

        const insight = getDashboardInsight(state, '2026-03-19', 14, TRAINING_MODES.slice(0, 3));
        assert.equal(insight.tone, 'push');
        assert.equal(insight.battleState, 'goal_reached');
      },
    },
    {
      name: 'dashboard insight enters steady mode when weekly target is already met',
      run() {
        const state = {
          ...createDefaultProgressState(),
          sessionsByDay: {
            '2026-03-13': [session('2026-03-13', 'grammar_drill', '2026-03-13T09:00:00.000Z')],
            '2026-03-14': [session('2026-03-14', 'vocab_drill', '2026-03-14T09:00:00.000Z')],
            '2026-03-15': [session('2026-03-15', 'reading_drill', '2026-03-15T09:00:00.000Z')],
            '2026-03-16': [session('2026-03-16', 'listening_analyze', '2026-03-16T09:00:00.000Z')],
            '2026-03-17': [session('2026-03-17', 'grammar_study', '2026-03-17T09:00:00.000Z')],
            '2026-03-18': [session('2026-03-18', 'vocab_study', '2026-03-18T09:00:00.000Z')],
            '2026-03-19': [
              session('2026-03-19', 'grammar_drill', '2026-03-19T09:00:00.000Z'),
              session('2026-03-19', 'vocab_drill', '2026-03-19T10:00:00.000Z'),
              session('2026-03-19', 'reading_drill', '2026-03-19T11:00:00.000Z'),
              session('2026-03-19', 'listening_analyze', '2026-03-19T12:00:00.000Z'),
              session('2026-03-19', 'grammar_study', '2026-03-19T13:00:00.000Z'),
              session('2026-03-19', 'vocab_study', '2026-03-19T14:00:00.000Z'),
              session('2026-03-19', 'official_vocab_memory', '2026-03-19T15:00:00.000Z', 'study'),
              session('2026-03-19', 'review_wrong', '2026-03-19T16:00:00.000Z', 'review'),
            ],
          },
        };

        const insight = getDashboardInsight(state, '2026-03-19', 10, TRAINING_MODES.slice(0, 3));
        assert.equal(insight.tone, 'steady');
      },
    },
    {
      name: 'recent week always returns seven days with correct counts',
      run() {
        const state = {
          ...createDefaultProgressState(),
          sessionsByDay: {
            '2026-03-18': [session('2026-03-18', 'grammar_drill', '2026-03-18T09:00:00.000Z')],
            '2026-03-19': [
              session('2026-03-19', 'vocab_drill', '2026-03-19T09:00:00.000Z'),
              session('2026-03-19', 'reading_drill', '2026-03-19T10:00:00.000Z'),
            ],
          },
        };

        const recent = buildRecentWeek(state, '2026-03-19');
        assert.equal(recent.length, 7);
        assert.equal(recent[5].count, 1);
        assert.equal(recent[6].count, 2);
      },
    },
    {
      name: 'coach snapshot returns neutral plan when there are no active weaknesses',
      run() {
        const snapshot = getDashboardWeaknessSnapshot(createDefaultProgressState());
        assert.equal(snapshot.focusItems.length, 0);
        assert.equal(snapshot.planSteps.length, 3);
      },
    },
    {
      name: 'coach snapshot surfaces the strongest cross-mode weakness',
      run() {
        const state = {
          ...createDefaultProgressState(),
          wrongAnswers: [
            {
              questionId: 'grammar-q1',
              modeId: 'grammar_drill',
              prompt: 'Q1',
              choices: ['A', 'B'],
              answer: 0,
              explanation: 'Because of the grammar trigger.',
              choiceInsights: ['Correct', 'Wrong'],
              reviewNote: 'Review the trigger.',
              tags: ['grammar_constraint'],
              source: 'unit-test',
              wrongCount: 3,
              firstWrongAt: '2026-03-18T09:00:00.000Z',
              lastWrongAt: '2026-03-19T09:00:00.000Z',
              lastUserChoice: 1,
              mastered: false,
              errorTypes: ['grammar_constraint'],
            },
          ],
          studyWeaknesses: [
            {
              id: 'grammar-study-1',
              modeId: 'grammar_study',
              term: 'わけではない',
              coreMeaning: 'not necessarily',
              keyUsage: 'Used to partially deny a generalization.',
              confusingPair: 'わけがない',
              example: '毎日残業しているが、仕事が嫌いなわけではない。',
              memoryHook: 'Partial denial, not total negation.',
              reviewPrompt: 'Explain the nuance difference from わけがない.',
              unstableCount: 2,
              firstUnstableAt: '2026-03-18T08:00:00.000Z',
              lastUnstableAt: '2026-03-19T08:00:00.000Z',
              active: true,
            },
          ],
        };

        const snapshot = getDashboardWeaknessSnapshot(state);

        assert.equal(snapshot.focusItems.length > 0, true);
        assert.equal(snapshot.recommendedModeId, 'review_wrong');
        assert.equal(snapshot.focusItems[0].id, 'grammar_constraint');
      },
    },
    {
      name: 'coach snapshot ignores mastered wrong answers and inactive signals',
      run() {
        const state = {
          ...createDefaultProgressState(),
          wrongAnswers: [
            {
              questionId: 'grammar-q1',
              modeId: 'grammar_drill',
              prompt: 'Q1',
              choices: ['A', 'B'],
              answer: 0,
              explanation: 'exp',
              choiceInsights: ['Correct', 'Wrong'],
              reviewNote: 'note',
              tags: ['grammar_constraint'],
              source: 'src',
              wrongCount: 5,
              firstWrongAt: '2026-03-18T09:00:00.000Z',
              lastWrongAt: '2026-03-19T09:00:00.000Z',
              lastUserChoice: 1,
              mastered: true,
              errorTypes: ['grammar_constraint'],
            },
          ],
          weaknessSignals: [
            {
              questionId: 'reading-q1',
              modeId: 'reading_drill',
              prompt: 'R1',
              source: 'src',
              tags: ['reading_evidence'],
              wrongCount: 4,
              firstWrongAt: '2026-03-18T09:00:00.000Z',
              lastWrongAt: '2026-03-19T09:00:00.000Z',
              active: false,
              errorTypes: ['reading_evidence'],
            },
          ],
        };

        const snapshot = getDashboardWeaknessSnapshot(state);
        assert.equal(snapshot.focusItems.length, 0);
      },
    },
    {
      name: 'coach snapshot uses study mode as both source and recommendation when weakness comes from study pack',
      run() {
        const state = {
          ...createDefaultProgressState(),
          studyWeaknesses: [
            {
              id: 's1',
              modeId: 'vocab_study',
              term: '取り組む',
              coreMeaning: '',
              keyUsage: '',
              confusingPair: '',
              example: '',
              memoryHook: '',
              reviewPrompt: '',
              unstableCount: 4,
              firstUnstableAt: '2026-03-18T09:00:00.000Z',
              lastUnstableAt: '2026-03-19T09:00:00.000Z',
              active: true,
            },
          ],
        };

        const snapshot = getDashboardWeaknessSnapshot(state);
        assert.equal(snapshot.recommendedModeId, 'vocab_study');
        assert.equal(snapshot.planSteps[0].recommendedModeId, 'vocab_study');
      },
    },
  ],
};
