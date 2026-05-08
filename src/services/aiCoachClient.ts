import { APP_CONFIG } from '../config/constants';

export type WrongAnswerExplanationParams = {
  question: string;
  choices: string[];
  selectedChoice: number;
  correctChoice: number;
  tags: string[];
  modeId: string;
  wrongCount: number;
};

export type WrongAnswerExplanation = {
  mistakePattern: string;
  whyDistractorFooled: string;
  watchNextTime: string;
};

const SYSTEM_PROMPT =
  'You are a JLPT N2 Japanese exam coach. A student answered a question incorrectly. ' +
  'Always respond in Chinese (Simplified). ' +
  'Return ONLY valid JSON with exactly these three fields:\n' +
  '{\n' +
  '  "mistakePattern": "one sentence: what error pattern this reveals about the student",\n' +
  '  "whyDistractorFooled": "one sentence: why the wrong choice looked plausible",\n' +
  '  "watchNextTime": "one sentence: specific thing to remember to avoid this next time"\n' +
  '}\n' +
  'No preamble. No markdown. Only the JSON object.';

const buildUserContent = (params: WrongAnswerExplanationParams): string => {
  const choicesText = params.choices
    .map((c, i) => `${i + 1}. ${c}`)
    .join(' / ');
  return [
    `Question: ${params.question}`,
    `Choices: ${choicesText}`,
    `Student chose: ${params.choices[params.selectedChoice] ?? '(unknown)'}`,
    `Correct answer: ${params.choices[params.correctChoice] ?? '(unknown)'}`,
    `Tags: ${params.tags.join(', ')}`,
    `Times this student has gotten this wrong: ${params.wrongCount}`,
  ].join('\n');
};

const parseExplanation = (raw: string): WrongAnswerExplanation => {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    throw new Error(`AI returned non-JSON: ${stripped.slice(0, 100)}`);
  }
  if (
    typeof parsed.mistakePattern !== 'string' ||
    typeof parsed.whyDistractorFooled !== 'string' ||
    typeof parsed.watchNextTime !== 'string'
  ) {
    throw new Error('Invalid explanation shape');
  }
  return {
    mistakePattern: parsed.mistakePattern,
    whyDistractorFooled: parsed.whyDistractorFooled,
    watchNextTime: parsed.watchNextTime,
  };
};

type ClaudeResponse = {
  content: Array<{ type: string; text: string }>;
};

type OpenAIResponse = {
  choices: Array<{ message: { content: string } }>;
};

const callClaude = async (
  userContent: string,
  signal: AbortSignal,
): Promise<string> => {
  const endpoint = process.env.EXPO_PUBLIC_DEEPSEEK_PROXY_URL
    ? `${process.env.EXPO_PUBLIC_DEEPSEEK_PROXY_URL}/v1/messages`
    : 'https://api.anthropic.com/v1/messages';
  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': APP_CONFIG.AI_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!response.ok) throw new Error(`Claude API error ${response.status}`);
  const data = (await response.json()) as ClaudeResponse;
  return data.content[0]?.text ?? '';
};

const callOpenAI = async (
  userContent: string,
  signal: AbortSignal,
): Promise<string> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${APP_CONFIG.AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 256,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
  const data = (await response.json()) as OpenAIResponse;
  return data.choices[0]?.message?.content ?? '';
};

const callDeepSeek = async (
  userContent: string,
  signal: AbortSignal,
): Promise<string> => {
  const proxyUrl = process.env.EXPO_PUBLIC_DEEPSEEK_PROXY_URL;
  const endpoint = proxyUrl
    ? `${proxyUrl}/v1/chat/completions`
    : 'https://api.deepseek.com/v1/chat/completions';
  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: {
      Authorization: proxyUrl ? 'Bearer proxy' : `Bearer ${APP_CONFIG.AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 256,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek API error ${response.status}`);
  const data = (await response.json()) as OpenAIResponse;
  return data.choices[0]?.message?.content ?? '';
};

export const getWrongAnswerExplanation = async (
  params: WrongAnswerExplanationParams,
): Promise<WrongAnswerExplanation> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const userContent = buildUserContent(params);
    let raw: string;
    if (APP_CONFIG.AI_PROVIDER === 'openai') {
      raw = await callOpenAI(userContent, controller.signal);
    } else if (APP_CONFIG.AI_PROVIDER === 'deepseek') {
      raw = await callDeepSeek(userContent, controller.signal);
    } else {
      raw = await callClaude(userContent, controller.signal);
    }
    return parseExplanation(raw);
  } catch (err) {
    if (__DEV__) console.error('[AI Coach] error:', err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

// ====================== Sort question explanation ======================

export type SortQuestionExplanationParams = {
  fullSentence: string;
  fullSentenceReading: string;
  fullSentenceZh: string;
  patternTerms: string[];
  baseExplanation: string;
};

export type SortQuestionExplanation = {
  lockEnding: string;
  identifyChunks: string;
  chainParticles: string;
  finalOrder: string;
  transferRule: string;
};

const SORT_SYSTEM_PROMPT =
  'You are a JLPT N2 sentence-ordering (並べ替え) coach for a Chinese student. ' +
  'Always respond in Chinese (Simplified). ' +
  'GOAL: not to "explain the answer" but to **demonstrate the SOLVING PATH** the student can replay on similar questions.\n' +
  'Mantra (口令): 先看句尾，后找助词；先拼小块，再排全句；遇到语法，整块处理。\n' +
  'For THIS specific question, walk through 4 concrete actions then give 1 transferable rule. ' +
  'Each field MUST cite the actual fragments by their Japanese text (use 「」 quotes), NOT abstract terms. ' +
  'Avoid generic definitions. Avoid translating Chinese to Japanese. Analyze grammar directly.\n' +
  'Return ONLY valid JSON with exactly these five fields, each ≤ 60 字 in Chinese:\n' +
  '{\n' +
  '  "lockEnding": "锁句尾：本题句尾是「○○」，要求接○○ → 末位只能是「碎片X」（写出真实的碎片日文）",\n' +
  '  "identifyChunks": "抓固定块：「碎片A」+「碎片B」组成固定搭配「○○」，必须紧挨；指出在本题中是哪两片",\n' +
  '  "chainParticles": "链助词：剩下的「碎片Y」用助词「○」与「碎片Z」绑定 → 本题用了什么具体助词关系",\n' +
  '  "finalOrder": "定全句：写出最终顺序「片1 → 片2 → 片3 → 片4」并通读完整日文",\n' +
  '  "transferRule": "带走的规律：遇到○○结尾的题，先○○再○○。一句话，可迁移到同类题"\n' +
  '}\n' +
  'No preamble. No markdown. Only the JSON object.';

const buildSortUserContent = (params: SortQuestionExplanationParams): string => {
  return [
    `Full sentence (Japanese): ${params.fullSentence}`,
    `Reading (kana): ${params.fullSentenceReading}`,
    `Chinese translation: ${params.fullSentenceZh}`,
    `Grammar pattern(s) tested: ${params.patternTerms.join(', ') || '(general N2 grammar)'}`,
    `Base explanation already shown to student: ${params.baseExplanation}`,
    'Goal: explain WHY the four fragments must be ordered this way and what trips students up.',
  ].join('\n');
};

const parseSortExplanation = (raw: string): SortQuestionExplanation => {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripped) as Record<string, unknown>;
  } catch {
    throw new Error(`AI returned non-JSON: ${stripped.slice(0, 100)}`);
  }
  const required = [
    'lockEnding',
    'identifyChunks',
    'chainParticles',
    'finalOrder',
    'transferRule',
  ] as const;
  for (const key of required) {
    if (typeof parsed[key] !== 'string') {
      throw new Error(`Invalid sort explanation shape: missing ${key}`);
    }
  }
  return {
    lockEnding: parsed.lockEnding as string,
    identifyChunks: parsed.identifyChunks as string,
    chainParticles: parsed.chainParticles as string,
    finalOrder: parsed.finalOrder as string,
    transferRule: parsed.transferRule as string,
  };
};

const callClaudeWithSystem = async (
  userContent: string,
  systemPrompt: string,
  signal: AbortSignal,
): Promise<string> => {
  const endpoint = process.env.EXPO_PUBLIC_DEEPSEEK_PROXY_URL
    ? `${process.env.EXPO_PUBLIC_DEEPSEEK_PROXY_URL}/v1/messages`
    : 'https://api.anthropic.com/v1/messages';
  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': APP_CONFIG.AI_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 320,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!response.ok) throw new Error(`Claude API error ${response.status}`);
  const data = (await response.json()) as ClaudeResponse;
  return data.content[0]?.text ?? '';
};

const callOpenAIWithSystem = async (
  userContent: string,
  systemPrompt: string,
  signal: AbortSignal,
): Promise<string> => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${APP_CONFIG.AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 320,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
  const data = (await response.json()) as OpenAIResponse;
  return data.choices[0]?.message?.content ?? '';
};

const callDeepSeekWithSystem = async (
  userContent: string,
  systemPrompt: string,
  signal: AbortSignal,
): Promise<string> => {
  const proxyUrl = process.env.EXPO_PUBLIC_DEEPSEEK_PROXY_URL;
  const endpoint = proxyUrl
    ? `${proxyUrl}/v1/chat/completions`
    : 'https://api.deepseek.com/v1/chat/completions';
  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: {
      Authorization: proxyUrl ? 'Bearer proxy' : `Bearer ${APP_CONFIG.AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 320,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek API error ${response.status}`);
  const data = (await response.json()) as OpenAIResponse;
  return data.choices[0]?.message?.content ?? '';
};

export const getSortQuestionExplanation = async (
  params: SortQuestionExplanationParams,
): Promise<SortQuestionExplanation> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const userContent = buildSortUserContent(params);
    let raw: string;
    if (APP_CONFIG.AI_PROVIDER === 'openai') {
      raw = await callOpenAIWithSystem(userContent, SORT_SYSTEM_PROMPT, controller.signal);
    } else if (APP_CONFIG.AI_PROVIDER === 'deepseek') {
      raw = await callDeepSeekWithSystem(userContent, SORT_SYSTEM_PROMPT, controller.signal);
    } else {
      raw = await callClaudeWithSystem(userContent, SORT_SYSTEM_PROMPT, controller.signal);
    }
    return parseSortExplanation(raw);
  } catch (err) {
    if (__DEV__) console.error('[AI Coach][sort] error:', err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
};
