require('sucrase/register/ts');
const assert = require('node:assert/strict');
const { getReviewTasks, selectReadingReviewPassage, prioritizeListeningReviewCases } = require('../src/domain/services/reviewScheduleService.ts');
const { createDefaultProgressState, recordWrongAnswers, recordWrongReviewSession, getDueWrongAnswersForMode, recordWeaknessSignals, recordStudyWeaknesses } = require('../src/domain/services/progressService.ts');
const { getTodayPlan, getDashboardInsight } = require('../src/domain/services/dashboardService.ts');
const { getGeneratedDailyPlan, getDashboardWeaknessSnapshot } = require('../src/domain/services/coachService.ts');
const { TRAINING_MODES } = require('../src/data/seed/trainingModes.ts');
const passages = require('../src/data/seed/reading_passages.json');
const cases = require('../src/data/seed/listening_cases.json');
const drills = require('../src/data/seed/drill_questions.json');
const now = new Date('2026-09-08T12:00:00Z');
const signal = (id, modeId = 'reading_drill', date = '2026-09-06T12:00:00Z') => ({
  questionId: id, modeId, prompt: 'prompt', source: 'test', tags: [], errorTypes: ['reading_evidence'],
  active: true, wrongCount: 1, firstWrongAt: date, lastWrongAt: date,
});
const study = (id, modeId, at) => ({ id, modeId, term: id, unstableCount: 1, active: true, firstUnstableAt: at, lastUnstableAt: at });
const wrong = (id, modeId, due) => ({ questionId: id, modeId, mastered: false, leitnerBox: 1, nextReviewAt: due,
  wrongCount: 1, firstWrongAt: '2026-09-01T00:00:00Z', lastWrongAt: '2026-09-01T00:00:00Z', errorTypes: ['grammar_constraint'] });

module.exports = { name: 'reviewSchedule', tests: [
  { name: 'unifies six review modes and keeps oldest pending work first without mutation', run() {
    const state = { ...createDefaultProgressState(),
      wrongAnswers: [wrong('g', 'grammar_drill', '2026-09-07'), wrong('v', 'vocab_drill', '2026-09-07')],
      studyWeaknesses: [study('sg', 'grammar_study', '2026-09-07T00:00:00Z'), study('sv', 'vocab_study', '2026-09-07T00:00:00Z')],
      weaknessSignals: [signal('r'), signal('l', 'listening_analyze')],
    };
    const before = JSON.stringify(state);
    const tasks = getReviewTasks(state, now);
    assert.equal(tasks.length, 6);
    assert.equal(tasks.reduce((sum, task) => sum + task.count, 0), 6);
    assert.ok(['reading_drill', 'listening_analyze'].includes(tasks[0].modeId));
    assert.ok(tasks.every((task) => task.overdueCount === 1));
    assert.equal(JSON.stringify(state), before);
    assert.deepEqual(getGeneratedDailyPlan(state, '2026-09-08', now).items.map((x) => x.modeId), tasks.map((x) => x.modeId));
  } },
  { name: 'excludes future, mastered, resolved and cooling items from coach and plan', run() {
    const state = { ...createDefaultProgressState(),
      wrongAnswers: [wrong('g', 'grammar_drill', '2026-09-09'), { ...wrong('v', 'vocab_drill', '2026-09-01'), mastered: true }],
      studyWeaknesses: [study('sg', 'grammar_study', '2026-09-08T09:00:00Z')],
      weaknessSignals: [{ ...signal('r'), active: false }],
    };
    assert.deepEqual(getReviewTasks(state, now), []);
    assert.equal(getDashboardWeaknessSnapshot(state, '2026-09-08', now).recommendedModeId, undefined);
    assert.equal(getGeneratedDailyPlan(state, '2026-09-08', now).items[0].modeId, 'grammar_drill');
  } },
  { name: 'study enters the schedule exactly when four-hour cooldown ends', run() {
    const state = { ...createDefaultProgressState(), studyWeaknesses: [study('g', 'grammar_study', '2026-09-08T08:00:00Z')] };
    assert.equal(getReviewTasks(state, new Date('2026-09-08T11:59:59Z')).length, 0);
    assert.equal(getReviewTasks(state, now)[0].count, 1);
  } },
  { name: 'completed mode remains in today plan when pending review is left', run() {
    const state = { ...createDefaultProgressState(), weaknessSignals: [signal('r')],
      sessionsByDay: { '2026-09-08': [{ id: 's', modeId: 'reading_drill', kind: 'drill', completedAt: now.toISOString() }] },
    };
    const plan = getTodayPlan(TRAINING_MODES, state, '2026-09-08', now);
    assert.equal(plan.length, 3);
    assert.equal(plan[0].id, 'reading_drill');
    assert.equal(getDashboardInsight(state, '2026-09-08', 14, plan, now).recommendedModeId, 'reading_drill');
  } },
  { name: 'reading selects the oldest matching weak passage and falls back for removed content', run() {
    const target = passages[3];
    const state = { ...createDefaultProgressState(), weaknessSignals: [signal(target.questions[0].id)] };
    assert.equal(selectReadingReviewPassage(passages, state, passages[0], now).id, target.id);
    state.weaknessSignals[0].questionId = 'removed';
    assert.equal(selectReadingReviewPassage(passages, state, passages[0], now).id, passages[0].id);
  } },
  { name: 'listening prioritizes a synthesis case while preserving its questions and original input', run() {
    const target = cases.find((item) => item.questions.length > 1);
    const state = { ...createDefaultProgressState(), weaknessSignals: [signal(target.questions[1].id, 'listening_analyze')] };
    const before = JSON.stringify(cases);
    const sorted = prioritizeListeningReviewCases(cases, state, now);
    assert.equal(sorted[0].id, target.id);
    assert.deepEqual(sorted[0].questions, target.questions);
    assert.equal(sorted.length, cases.length);
    assert.equal(JSON.stringify(cases), before);
  } },
  { name: 'successful reading and study review remove tasks and restore new training', run() {
    let state = { ...createDefaultProgressState(), weaknessSignals: [signal('r')],
      studyWeaknesses: [study('g', 'grammar_study', '2026-09-07T00:00:00Z')] };
    state = recordWeaknessSignals(state, [{ ...signal('r'), wasCorrect: true }], now);
    state = recordStudyWeaknesses(state, [{ item: state.studyWeaknesses[0], wasConfident: true }], now);
    assert.deepEqual(getReviewTasks(state, now), []);
    assert.equal(getTodayPlan(TRAINING_MODES, state, '2026-09-08', now)[0].id, 'grammar_drill');
  } },
  { name: 'Leitner uses local calendar days near midnight in east and west time zones', run() {
    const original = process.env.TZ;
    try {
      for (const [tz, instant, day, next] of [
        ['Asia/Shanghai', '2026-09-07T16:30:00Z', '2026-09-08', '2026-09-10'],
        ['America/Los_Angeles', '2026-09-08T02:30:00Z', '2026-09-07', '2026-09-09'],
      ]) {
        process.env.TZ = tz;
        const at = new Date(instant);
        const q = drills.find((item) => item.modeId === 'grammar_drill');
        let state = recordWrongAnswers(createDefaultProgressState(), [{ question: q, selectedChoice: 1 }], at);
        assert.equal(state.wrongAnswers[0].nextReviewAt, day);
        assert.equal(getDueWrongAnswersForMode(state, 'grammar_drill', at).length, 1);
        state = recordWrongReviewSession(state, day, 'review_wrong', [{ questionId: q.id, selectedChoice: q.answer, mastered: true }], at);
        assert.equal(state.wrongAnswers[0].nextReviewAt, next);
        assert.equal(getReviewTasks(state, at).length, 0);
      }
    } finally {
      if (original === undefined) delete process.env.TZ; else process.env.TZ = original;
    }
  } },
] };
