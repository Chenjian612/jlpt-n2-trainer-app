const { buildState, buildWrongAnswerItem, runCase, withPage } = require('./shared');

async function main() {
  await runCase('wrong-review-screen', async () => {
    await withPage(
      'wrong-review-screen',
      buildState({ wrongAnswers: [buildWrongAnswerItem()] }),
      async (page, assert) => {
        await page.click('[data-testid="mode-card-start-review_wrong"]');
        await page.waitForSelector('[data-testid="wrong-review-submit-answer"]');
        await page.click('[data-testid="wrong-review-choice-0"]');
        await page.click('[data-testid="wrong-review-submit-answer"]');
        await page.waitForSelector('[data-testid="wrong-review-keep-in-queue"]');
        await page.click('[data-testid="wrong-review-keep-in-queue"]');
        await page.waitForSelector('[data-testid="wrong-review-result-title"]');
        assert.equal(await page.locator('[data-testid="wrong-review-result-title"]').count(), 1);
      },
    );
  });

  await runCase('official-vocab-screen', async () => {
    await withPage('official-vocab-screen', buildState(), async (page, assert) => {
      await page.click('[data-testid="mode-card-start-official_vocab_memory"]');
      await page.waitForSelector('[data-testid^="official-open-deck-"]');

      assert.equal(await page.locator('[data-testid="official-filter-reading"]').count(), 1);
      assert.equal(await page.locator('[data-testid^="official-open-deck-"]').count(), 3);

      const firstDeck = page.locator('[data-testid^="official-open-deck-"]').first();
      await firstDeck.click();
      await page.waitForSelector('[data-testid="official-reveal-card"]');
      await page.click('[data-testid="official-reveal-card"]');
      await page.click('[data-testid="official-mark-known"]');
      await page.waitForSelector('[data-testid="official-reveal-card"]');
      assert.equal(await page.locator('[data-testid="official-reveal-card"]').count(), 1);
    });
  });
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
