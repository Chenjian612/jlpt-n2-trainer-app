const { buildState, buildWrongAnswerItem, runCase, withPage } = require('./shared');
const passages = require('../../src/data/seed/reading_passages.json');
const cases = require('../../src/data/seed/listening_cases.json');
const officialDecks = require('../../src/data/seed/official_vocab_decks.json');
const grammar200 = require('../../src/data/seed/n2_grammar_200.json');
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
  await runCase('schedule-official-vocab-review-and-advance', async () => {
    const deck = officialDecks.find((item) => item.status === 'ready');
    const item = deck.items[0];
    const weakness = {
      ...item,
      modeId: 'official_vocab_memory',
      confusingPair: item.sourceHint,
      reviewPrompt: '回忆读音、核心义和搭配。',
      unstableCount: 1,
      firstUnstableAt: '2026-03-01T00:00:00.000Z',
      lastUnstableAt: '2026-03-01T00:00:00.000Z',
      active: true,
      reviewBox: 1,
      nextReviewAt: '2026-03-01T00:00:00.000Z',
    };
    await withPage('schedule-official-vocab-review-and-advance', buildState({ studyWeaknesses: [weakness] }), async (page, assert) => {
      assert.match(await page.locator('[data-testid="today-review-count"]').textContent(), /1 项待复习/);
      await page.locator('[data-testid="today-plan-start-official_vocab_memory"]').click();
      const openDeck = page.locator(`[data-testid="official-open-deck-${deck.id}"]`);
      await openDeck.waitFor();
      assert.match(await openDeck.textContent(), /先复习 1 项/);
      await openDeck.click();
      await page.locator('[data-testid="official-reveal-card"]').click();
      await page.locator('[data-testid="official-mark-known"]').click();
      await page.locator('[data-testid="official-back-to-library"]').waitFor();
      await page.waitForFunction((id) => {
        const state = JSON.parse(localStorage.getItem('jlpt-n2-trainer-state-v1'));
        const stored = state.studyWeaknesses.find((entry) => entry.id === id);
        return stored?.reviewBox === 2 && stored.nextReviewAt > new Date().toISOString();
      }, item.id);
      await page.getByText('继续今天的安排', { exact: true }).click();
      await page.locator('[data-testid="today-review-count"]').waitFor();
      assert.match(await page.locator('[data-testid="today-review-count"]').textContent(), /没有到期弱项/);
    });
  });
  await runCase('schedule-grammar200-target-chapter', async () => {
    const chapter = grammar200.chapters.find((item) => item.published && item.index > 1)
      || grammar200.chapters.find((item) => item.published);
    const pattern = chapter.patterns[0];
    const weakness = {
      id: `grammar200:pattern:${pattern.id}`,
      modeId: 'grammar_200',
      term: pattern.term,
      reading: pattern.reading,
      coreMeaning: pattern.meaningZh,
      keyUsage: pattern.usage,
      confusingPair: pattern.confusingWith || '',
      example: pattern.examples[0].jp,
      memoryHook: pattern.memoryHook,
      reviewPrompt: '回忆核心义、接续和例句。',
      unstableCount: 1,
      firstUnstableAt: '2026-03-01T00:00:00.000Z',
      lastUnstableAt: '2026-03-01T00:00:00.000Z',
      active: true,
      reviewBox: 1,
      nextReviewAt: '2026-03-01T00:00:00.000Z',
    };
    await withPage('schedule-grammar200-target-chapter', buildState({ studyWeaknesses: [weakness] }), async (page, assert) => {
      await page.locator('[data-testid="today-plan-start-grammar_200"]').click();
      const target = page.locator(`[data-testid="grammar200-chapter-${chapter.id}"]`);
      await target.waitFor();
      assert.equal(
        await page.locator('[data-testid^="grammar200-chapter-"]').first().getAttribute('data-testid'),
        `grammar200-chapter-${chapter.id}`,
      );
      assert.match(await target.textContent(), /待复习 1|本章有 1 项到期/);
    });
  });
}
main().catch((error) => { console.error(error); process.exit(1); });
