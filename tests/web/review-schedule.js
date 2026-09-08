const { buildState, buildWrongAnswerItem, runCase, withPage } = require('./shared');
const passages = require('../../src/data/seed/reading_passages.json');
const cases = require('../../src/data/seed/listening_cases.json');
const signal = (question, modeId) => ({
  questionId: question.id, modeId, prompt: question.prompt, source: 'browser-test', tags: question.tags,
  active: true, wrongCount: 2, firstWrongAt: '2026-03-01T00:00:00Z', lastWrongAt: '2026-03-01T00:00:00Z',
});

async function main() {
  await runCase('schedule-reading-target-and-resolve', async () => {
    const passage = passages[3];
    await withPage('schedule-reading-target-and-resolve', buildState({ weaknessSignals: [signal(passage.questions[0], 'reading_drill')] }), async (page, assert) => {
      assert.match(await page.locator('[data-testid="today-review-count"]').textContent(), /1 项待复习/);
      await page.locator('[data-testid="today-plan-start-reading_drill"]').click();
      await page.locator('[data-testid="reading-passage-title"]').waitFor();
      assert.equal(await page.locator('[data-testid="reading-passage-title"]').textContent(), passage.title);
      for (const question of passage.questions) {
        await page.locator(`[data-testid="reading-choice-${question.answer}"]`).click();
        await page.locator('[data-testid="reading-submit"]').click();
        await page.locator('[data-testid="reading-next"]').click();
      }
      await page.locator('[data-testid="reading-result-title"]').waitFor();
      await page.waitForFunction((id) => {
        const item = JSON.parse(localStorage.getItem('jlpt-n2-trainer-state-v1')).weaknessSignals.find((entry) => entry.questionId === id);
        return item?.active === true && item.reviewBox === 2 && item.nextReviewAt > new Date().toISOString();
      }, passage.questions[0].id);
      await page.locator('[data-testid="reading-back-dashboard"]').click();
      await page.locator('[data-testid="today-review-count"]').waitFor();
      assert.match(await page.locator('[data-testid="today-review-count"]').textContent(), /没有到期弱项/);
    });
  });
  await runCase('schedule-listening-target', async () => {
    const target = cases.find((item) => item.questions.length > 1);
    await withPage('schedule-listening-target', buildState({ weaknessSignals: [signal(target.questions[1], 'listening_analyze')] }), async (page, assert) => {
      await page.locator('[data-testid="today-plan-start-listening_analyze"]').click();
      await page.locator('[data-testid="listening-tips-confirm"]').waitFor();
      assert.equal(await page.getByText(target.title, { exact: true }).count(), 1);
      await page.locator('[data-testid="listening-tips-confirm"]').click();
      await page.locator('[data-testid="listening-submit"]').waitFor();
      assert.equal(await page.getByText(target.questions[0].prompt, { exact: true }).count(), 1);
    });
  });
  await runCase('schedule-future-review-not-recommended', async () => {
    await withPage('schedule-future-review-not-recommended', buildState({ wrongAnswers: [buildWrongAnswerItem({ nextReviewAt: '9999-12-31' })] }), async (page, assert) => {
      assert.match(await page.locator('[data-testid="today-review-count"]').textContent(), /没有到期弱项/);
      assert.equal(await page.locator('[data-testid="today-plan-start-review_wrong"]').count(), 0);
    });
  });
}
main().catch((error) => { console.error(error); process.exit(1); });
