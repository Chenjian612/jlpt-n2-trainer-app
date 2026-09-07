const { buildState, buildWrongAnswerItem, runCase, withPage } = require('./shared');

async function main() {
  await runCase('dashboard-review-e2e', async () => {
    await withPage(
      'dashboard-review-e2e',
      buildState({ wrongAnswers: [buildWrongAnswerItem({ wrongCount: 3, leitnerBox: 4 })] }),
      async (page, assert) => {
        const beforeHeadline = await page.locator('[data-testid="dashboard-hero-headline"]').textContent();
        const beforeBody = await page.locator('[data-testid="dashboard-hero-body"]').textContent();
        assert.equal((beforeBody || '').includes('1'), true);

        await page.click('[data-testid="mode-card-start-review_wrong"]');
        await page.waitForSelector('[data-testid="wrong-review-submit-answer"]');
        await page.click('[data-testid="wrong-review-choice-2"]');
        await page.click('[data-testid="wrong-review-submit-answer"]');
        await page.waitForSelector('[data-testid="wrong-review-resolve"]');
        await page.click('[data-testid="wrong-review-resolve"]');
        await page.waitForSelector('[data-testid="wrong-review-result-title"]');
        await page.click('[data-testid="wrong-review-back-dashboard"]');

        await page.waitForSelector('[data-testid="dashboard-hero-headline"]');
        const afterHeadline = await page.locator('[data-testid="dashboard-hero-headline"]').textContent();
        const afterBody = await page.locator('[data-testid="dashboard-hero-body"]').textContent();

        assert.equal((afterBody || '').includes('1'), false);
        assert.equal((afterHeadline || '').includes('2'), true);
        assert.equal(afterHeadline === beforeHeadline, false);
        assert.equal((afterBody || '').length > 0, true);
        await page.waitForFunction(() => {
          const state = JSON.parse(localStorage.getItem('jlpt-n2-trainer-state-v1'));
          const item = state?.wrongAnswers.find((entry) => entry.questionId === 'grammar-q1');
          return item?.leitnerBox === 5 && item.mastered === true;
        });
      },
    );
  });
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
