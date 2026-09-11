require('sucrase/register/ts');

const assert = require('node:assert/strict');
const grammar200 = require('../src/data/seed/n2_grammar_200.json');
const {
  buildGrammar200ReviewDrafts,
  getGrammar200ChapterDueCount,
  getGrammar200PatternWeaknessId,
  getGrammar200SortWeaknessId,
} = require('../src/domain/services/grammar200ReviewService.ts');
const {
  createDefaultProgressState,
  recordStudyWeaknesses,
} = require('../src/domain/services/progressService.ts');
const { getReviewTasks } = require('../src/domain/services/reviewScheduleService.ts');

module.exports = {
  name: 'grammar200Review',
  tests: [
    {
      name: 'converts explicit card marks and sort attempts into scheduled chapter weaknesses',
      run() {
        const chapter = grammar200.chapters[0];
        const [unstablePattern, stablePattern] = chapter.patterns;
        const [wrongSort, correctSort] = chapter.sortQuestions;
        const drafts = buildGrammar200ReviewDrafts(
          chapter,
          { [unstablePattern.id]: true, [stablePattern.id]: false },
          [
            { questionId: wrongSort.id, correct: false },
            { questionId: correctSort.id, correct: true },
            { questionId: 'removed-question', correct: false },
          ],
        );

        assert.equal(drafts.length, 4);
        assert.equal(drafts[0].item.id, getGrammar200PatternWeaknessId(unstablePattern.id));
        assert.equal(drafts[0].wasConfident, false);
        assert.equal(drafts[1].wasConfident, true);
        assert.equal(drafts[2].item.id, getGrammar200SortWeaknessId(wrongSort.id));
        assert.equal(drafts[2].wasConfident, false);

        const recordedAt = new Date('2026-09-11T08:00:00.000Z');
        const state = recordStudyWeaknesses(
          createDefaultProgressState(),
          drafts,
          recordedAt,
        );
        const tasks = getReviewTasks(
          state,
          new Date('2026-09-11T12:00:00.000Z'),
        );

        assert.equal(state.studyWeaknesses.length, 2);
        assert.equal(tasks[0].modeId, 'grammar_200');
        assert.equal(tasks[0].count, 2);
        assert.equal(
          getGrammar200ChapterDueCount(chapter, new Set(tasks[0].itemIds)),
          2,
        );
      },
    },
  ],
};
