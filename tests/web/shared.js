const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:19006';
const STORAGE_KEY = 'jlpt-n2-trainer-state-v1';
const ARTIFACT_DIR = path.resolve(process.cwd(), 'output', 'playwright');

function ensureArtifactsDir() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function createPage(state) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  await context.addInitScript(
    ({ key, value }) => {
      window.localStorage.clear();
      if (value) {
        window.localStorage.setItem(key, value);
      }
    },
    { key: STORAGE_KEY, value: state ? JSON.stringify(state) : null },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  return { browser, context, page };
}

async function openApp(page) {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="dashboard-hero-headline"]');
}

async function runCase(name, fn) {
  ensureArtifactsDir();
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error.message || String(error));
    throw error;
  }
}

async function withPage(name, state, fn) {
  const { browser, page } = await createPage(state);
  try {
    await openApp(page);
    await fn(page, assert);
  } catch (error) {
    const file = path.join(ARTIFACT_DIR, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
}

function buildWrongAnswerItem(overrides = {}) {
  return {
    questionId: 'grammar-q1',
    modeId: 'grammar_drill',
    prompt: '最も自然な文を選んでください。',
    choices: ['A', 'B', 'C', 'D'],
    answer: 2,
    explanation: 'C is correct because it matches the grammar constraint.',
    choiceInsights: ['A wrong', 'B wrong', 'C right', 'D wrong'],
    reviewNote: 'Check the grammar trigger before choosing.',
    tags: ['限制'],
    source: 'playwright-seed',
    wrongCount: 2,
    firstWrongAt: '2026-03-18T09:00:00.000Z',
    lastWrongAt: '2026-03-19T09:00:00.000Z',
    lastUserChoice: 1,
    mastered: false,
    errorTypes: ['grammar_constraint'],
    ...overrides,
  };
}

function buildState(overrides = {}) {
  return {
    weeklyGoal: 14,
    sessionsByDay: {},
    wrongAnswers: [],
    weaknessSignals: [],
    studyWeaknesses: [],
    ...overrides,
  };
}

module.exports = {
  ARTIFACT_DIR,
  BASE_URL,
  assert,
  buildState,
  buildWrongAnswerItem,
  runCase,
  withPage,
};
