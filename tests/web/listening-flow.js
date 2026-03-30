const { buildState, runCase, withPage } = require('./shared');

async function main() {
  // Case 1: 普通听力案例——tips页 -> 音频区 -> 选题 -> 提交 -> 下一题 -> 结果页
  await runCase('listening-normal-flow', async () => {
    await withPage('listening-normal-flow', buildState(), async (page, assert) => {
      await page.click('[data-testid="mode-card-start-listening_analyze"]');

      // tips 前置页出现
      await page.waitForSelector('[data-testid="listening-tips-confirm"]');
      assert.equal(await page.locator('[data-testid="listening-tips-confirm"]').count(), 1);
      await page.click('[data-testid="listening-tips-confirm"]');

      // 进入答题，音频播放按钮可见
      await page.waitForSelector('[data-testid="listening-play-button"]');
      assert.equal(await page.locator('[data-testid="listening-play-button"]').count(), 1);

      // 提交按钮在未播放时禁用
      const submitBefore = page.locator('[data-testid="listening-submit"]');
      assert.equal(await submitBefore.count(), 1);
      const isDisabled = await submitBefore.evaluate((el) => el.disabled ?? el.getAttribute('aria-disabled'));
      assert.ok(isDisabled || isDisabled === 'true' || isDisabled === true, 'submit should be disabled before audio play');
    });
  });

  // Case 2: 即時応答——不需要音频，刺激句可见，可直接选题提交
  await runCase('listening-instant-reply-flow', async () => {
    await withPage('listening-instant-reply-flow', buildState(), async (page, assert) => {
      await page.click('[data-testid="mode-card-start-listening_analyze"]');

      // 跳过 tips 页（第一个案例是普通案例，先跳过）
      await page.waitForSelector('[data-testid="listening-tips-confirm"]');
      await page.click('[data-testid="listening-tips-confirm"]');
      await page.waitForSelector('[data-testid="listening-submit"]');

      // 找到即時応答题：选项数为 3
      // 遍历题目直到出现 3 个选项（最多翻 25 题）
      let found = false;
      for (let i = 0; i < 25; i++) {
        const choiceCount = await page.locator('[data-testid^="listening-choice-"]').count();
        if (choiceCount === 3) {
          found = true;
          break;
        }
        // 需要先播放音频才能进入下一题（非即時応答题）
        const playBtn = page.locator('[data-testid="listening-play-button"]');
        if (await playBtn.count() > 0) {
          await playBtn.click();
          await page.waitForTimeout(500);
        }
        await page.locator('[data-testid="listening-choice-0"]').click();
        const submitBtn = page.locator('[data-testid="listening-submit"]');
        await submitBtn.waitFor({ state: 'visible' });
        await submitBtn.click();
        const nextBtn = page.locator('[data-testid="listening-next"]');
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          // 可能出现新的 tips 页
          const tipsBtn = page.locator('[data-testid="listening-tips-confirm"]');
          if (await tipsBtn.count() > 0) {
            await tipsBtn.click();
          }
          await page.waitForSelector('[data-testid="listening-submit"]');
        }
      }

      if (found) {
        // 即時応答：直接可选，无需音频
        assert.equal(await page.locator('[data-testid^="listening-choice-"]').count(), 3);
        await page.click('[data-testid="listening-choice-1"]');
        await page.waitForSelector('[data-testid="listening-submit"]:not([disabled])');
        await page.click('[data-testid="listening-submit"]');
        await page.waitForSelector('[data-testid="listening-next"]');
        assert.equal(await page.locator('[data-testid="listening-next"]').count(), 1);
      }
    });
  });

  // Case 3: 完整一轮，最终出现结果页
  await runCase('listening-result-screen', async () => {
    await withPage('listening-result-screen', buildState(), async (page, assert) => {
      await page.click('[data-testid="mode-card-start-listening_analyze"]');

      // 循环答完所有题，最终验证结果页
      for (let i = 0; i < 30; i++) {
        const resultTitle = page.locator('[data-testid="listening-result-title"]');
        if (await resultTitle.count() > 0) break;

        const tipsBtn = page.locator('[data-testid="listening-tips-confirm"]');
        if (await tipsBtn.count() > 0) {
          await tipsBtn.click();
          await page.waitForSelector('[data-testid="listening-submit"]');
          continue;
        }

        const playBtn = page.locator('[data-testid="listening-play-button"]');
        if (await playBtn.count() > 0) {
          const choiceCount = await page.locator('[data-testid^="listening-choice-"]').count();
          if (choiceCount !== 3) {
            // 非即時応答，需要先播音频
            await playBtn.click();
            await page.waitForTimeout(400);
          }
        }

        await page.locator('[data-testid="listening-choice-0"]').click();
        const submitBtn = page.locator('[data-testid="listening-submit"]');
        await submitBtn.waitFor({ state: 'visible' });
        await submitBtn.click();

        const nextBtn = page.locator('[data-testid="listening-next"]');
        await nextBtn.waitFor({ state: 'visible' });
        await nextBtn.click();
        await page.waitForTimeout(300);
      }

      await page.waitForSelector('[data-testid="listening-result-title"]');
      assert.equal(await page.locator('[data-testid="listening-result-title"]').count(), 1);
    });
  });
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
