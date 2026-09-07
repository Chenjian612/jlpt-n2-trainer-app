const { buildState, runCase, withPage } = require('./shared');
const cases = require('../../src/data/seed/listening_cases.json');
const questions = cases.flatMap((item) => item.questions);

async function enterQuestion(page) {
  await page.locator('[data-testid="listening-tips-confirm"], [data-testid="listening-submit"]').first().waitFor();
  const tips = page.locator('[data-testid="listening-tips-confirm"]');
  if (await tips.count()) await tips.click();
  await page.locator('[data-testid="listening-submit"]').waitFor();
}

async function answerQuestion(page, question, assert) {
  await enterQuestion(page);
  assert.equal(await page.locator('[data-testid^="listening-choice-"]').count(), question.choices.length);
  if (!question.tags.includes('即時応答')) {
    // Wait for the real MP3 to load and the button to enable.
    await page.locator('[data-testid="listening-play-button"]').click();
  }
  await page.locator('[data-testid="listening-choice-0"]').click();
  await page.locator('[data-testid="listening-submit"]').click();
  await page.locator('[data-testid="listening-next"]').waitFor();
}

async function main() {
  await runCase('listening-normal-flow', async () => {
    await withPage('listening-normal-flow', buildState(), async (page, assert) => {
      await page.click('[data-testid="mode-card-start-listening_analyze"]');
      await enterQuestion(page);
      await page.locator('[data-testid="listening-choice-0"]').click();
      assert.equal(await page.locator('[data-testid="listening-submit"]').getAttribute('aria-disabled'), 'true');
      assert.equal(await page.locator('[data-testid="listening-play-button"]').count(), 1);
    });
  });

  await runCase('listening-instant-reply-flow', async () => {
    await withPage('listening-instant-reply-flow', buildState(), async (page, assert) => {
      const target = questions.findIndex((q) => q.tags.includes('即時応答'));
      assert.ok(target >= 0, 'fixture must contain instant reply');
      await page.click('[data-testid="mode-card-start-listening_analyze"]');
      for (let i = 0; i <= target; i++) {
        await answerQuestion(page, questions[i], assert);
        if (i < target) await page.locator('[data-testid="listening-next"]').click();
      }
    });
  });

  await runCase('listening-result-screen', async () => {
    await withPage('listening-result-screen', buildState(), async (page, assert) => {
      await page.click('[data-testid="mode-card-start-listening_analyze"]');
      for (const question of questions) {
        await answerQuestion(page, question, assert);
        await page.locator('[data-testid="listening-next"]').click();
      }
      await page.locator('[data-testid="listening-result-title"]').waitFor();
      assert.equal(await page.locator('[data-testid="listening-result-title"]').count(), 1);
      await page.waitForFunction(() => {
        const state = JSON.parse(localStorage.getItem('jlpt-n2-trainer-state-v1'));
        return Object.values(state?.sessionsByDay || {}).flat().some((session) => session.modeId === 'listening_analyze');
      });
    });
  });
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
