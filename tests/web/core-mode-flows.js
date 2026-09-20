const { buildState, runCase, withPage } = require('./shared');

async function completeDrill(page, assert, modeId) {
  await page.click(`[data-testid="mode-card-start-${modeId}"]`);
  const action = `[data-testid="drill-primary-action-${modeId}"]`;
  await page.waitForSelector(action);

  for (let index = 0; index < 5; index += 1) {
    await page.click(`[data-testid="drill-choice-${modeId}-0"]`);
    await page.click(action);
    await page.click(action);
  }

  await page.waitForSelector(`[data-testid="drill-result-title-${modeId}"]`);
  const persisted = await page.evaluate((completedModeId) => {
    const state = JSON.parse(localStorage.getItem('jlpt-n2-trainer-state-v1'));
    return Object.values(state.sessionsByDay)
      .flat()
      .filter((session) => session.modeId === completedModeId).length;
  }, modeId);
  assert.equal(persisted, 1);
}

async function completeStudyPack(page, assert, modeId) {
  await page.click(`[data-testid="mode-card-start-${modeId}"]`);
  const resultSelector = `[data-testid="study-result-title-${modeId}"]`;

  for (let index = 0; index < 100; index += 1) {
    if (await page.locator(resultSelector).count()) break;
    await page.click(`[data-testid="study-reveal-${modeId}"]`);
    await page.click(`[data-testid="study-mark-known-${modeId}"]`);
  }

  await page.waitForSelector(resultSelector);
  const persisted = await page.evaluate((completedModeId) => {
    const state = JSON.parse(localStorage.getItem('jlpt-n2-trainer-state-v1'));
    return Object.values(state.sessionsByDay)
      .flat()
      .filter((session) => session.modeId === completedModeId).length;
  }, modeId);
  assert.equal(persisted, 1);
}

async function main() {
  for (const modeId of ['grammar_drill', 'vocab_drill']) {
    await runCase(`${modeId}-complete-flow`, async () => {
      await withPage(`${modeId}-complete-flow`, buildState(), async (page, assert) => {
        await completeDrill(page, assert, modeId);
      });
    });
  }

  for (const modeId of ['grammar_study', 'vocab_study']) {
    await runCase(`${modeId}-complete-flow`, async () => {
      await withPage(`${modeId}-complete-flow`, buildState(), async (page, assert) => {
        await completeStudyPack(page, assert, modeId);
      });
    });
  }

  await runCase('grammar200-complete-sort-flow', async () => {
    await withPage('grammar200-complete-sort-flow', buildState(), async (page, assert) => {
      await page.click('[data-testid="mode-card-start-grammar_200"]');
      await page.locator('[data-testid^="grammar200-chapter-"]').first().click();
      await page.click('[data-testid="grammar200-start-study"]');
      await page.click('[data-testid="grammar200-jump-to-sort"]');

      for (let question = 0; question < 10; question += 1) {
        for (let fragment = 0; fragment < 4; fragment += 1) {
          await page.click(`[data-testid="grammar200-fragment-${fragment}"]`);
        }
        await page.click('[data-testid="grammar200-submit-sort"]');
        await page.click('[data-testid="grammar200-next-sort"]');
      }

      await page.waitForSelector('[data-testid="grammar200-result-title"]');
      const persisted = await page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('jlpt-n2-trainer-state-v1'));
        return Object.values(state.sessionsByDay)
          .flat()
          .filter((session) => session.modeId === 'grammar_200').length;
      });
      assert.equal(persisted, 1);
    });
  });
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
