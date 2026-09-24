const { buildState, buildWrongAnswerItem, runCase, withPage } = require('./shared');
const readingPassages = require('../../src/data/seed/reading_passages.json');
const listeningCases = require('../../src/data/seed/listening_cases.json');

async function mockTutorProxy(page) {
  await page.route('**/v1/chat/completions', async (route) => {
    const content = JSON.stringify({
      diagnosisSummary: '你把先出现的信息当成了最终依据。',
      whyYouChoseIt: '本次误选复述了局部信息，但没有保留证据中的决定性变化。',
      reasoningSteps: ['确认题干要求', '定位决定性证据', '核对选项是否完整改写证据'],
      confusionComparison: { decisiveDifference: '正确项保留最终结论，误选只保留局部信息。' },
      reviewPlan: [{ timing: 'now', action: '重新指出决定答案的证据。' }],
      transferQuestion: {
        prompt: '哪一项完整保留了最终证据？',
        choices: ['只保留前半段信息', '保留转折后的最终结论'],
        answer: 1,
        explanation: '应以转折后的最终结论为准。',
      },
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content } }] }),
    });
  });
}

function lockedCorrectIndex(questionId) {
  const correctFirst = [...questionId]
    .reduce((total, character) => total + character.charCodeAt(0), 0) % 2 === 0;
  return correctFirst ? 0 : 1;
}

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
      assert.equal(await page.locator('[data-testid^="official-open-deck-"]').count(), 6);

      const firstDeck = page.locator('[data-testid^="official-open-deck-"]').first();
      await firstDeck.click();
      await page.waitForSelector('[data-testid="official-reveal-card"]');
      await page.click('[data-testid="official-reveal-card"]');
      await page.click('[data-testid="official-mark-known"]');
      await page.waitForSelector('[data-testid="official-reveal-card"]');
      assert.equal(await page.locator('[data-testid="official-reveal-card"]').count(), 1);
    });
  });

  await runCase('reading-ai-tutor-flow', async () => {
    await withPage('reading-ai-tutor-flow', buildState(), async (page, assert) => {
      await mockTutorProxy(page);
      const question = readingPassages[0].questions[0];
      const wrongChoice = question.answer === 0 ? 1 : 0;
      await page.click('[data-testid="mode-card-start-reading_drill"]');
      await page.locator(`[data-testid="reading-choice-${wrongChoice}"]`).click();
      await page.locator('[data-testid="reading-submit"]').click();
      await page.locator('[data-testid="reading-ai-tutor"]').click();
      await page.locator('[data-testid="reading-ai-tutor-result"]').waitFor();
      await page.locator(`[data-testid="reading-tutor-transfer-choice-${lockedCorrectIndex(question.id)}"]`).click();
      await page.locator('[data-testid="reading-tutor-transfer-submit"]').click();
      assert.match(
        await page.locator('[data-testid="reading-ai-tutor-result"]').innerText(),
        /验证通过/,
      );
    });
  });

  await runCase('listening-ai-tutor-flow', async () => {
    await withPage('listening-ai-tutor-flow', buildState(), async (page, assert) => {
      await mockTutorProxy(page);
      const question = listeningCases[0].questions[0];
      const wrongChoice = question.answer === 0 ? 1 : 0;
      await page.click('[data-testid="mode-card-start-listening_analyze"]');
      await page.locator('[data-testid="listening-tips-confirm"]').click();
      await page.locator('[data-testid="listening-play-button"]').click();
      await page.locator(`[data-testid="listening-choice-${wrongChoice}"]`).click();
      await page.locator('[data-testid="listening-submit"]').click();
      await page.locator('[data-testid="listening-ai-tutor"]').click();
      await page.locator('[data-testid="listening-ai-tutor-result"]').waitFor();
      await page.locator(`[data-testid="listening-tutor-transfer-choice-${lockedCorrectIndex(question.id)}"]`).click();
      await page.locator('[data-testid="listening-tutor-transfer-submit"]').click();
      assert.match(
        await page.locator('[data-testid="listening-ai-tutor-result"]').innerText(),
        /验证通过/,
      );
    });
  });
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
