import { APP_CONFIG } from '../config/constants';
import type { WrongAnswerExplanation } from '../domain/models/aiExplanation';
import type { PersonalizedTutorExplanation } from '../domain/models/personalizedTutor';
import {
  buildLocalRagExplanation,
  type RagExplanationRequest,
} from '../domain/services/ragExplanationService';

export type WrongAnswerExplanationParams = RagExplanationRequest;
export type { WrongAnswerExplanation };

export type PersonalizedTutorParams = RagExplanationRequest & {
  weaknessType: string;
  recentSimilarWrongCount: number;
  recentSimilarPointIds: string[];
};

type ClaudeResponse = {
  content: Array<{ type: string; text: string }>;
};

type OpenAIResponse = {
  choices: Array<{ message: { content: string } }>;
};

const WRONG_ANSWER_TEXT_FIELDS = [
  'mistakePattern',
  'whyCorrect',
  'whyUserWrong',
  'whyDistractorFooled',
  'watchNextTime',
] as const;

type WrongAnswerText = Pick<
  WrongAnswerExplanation,
  (typeof WRONG_ANSWER_TEXT_FIELDS)[number]
>;

const parseJsonObject = (raw: string): Record<string, unknown> => {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  return JSON.parse(stripped) as Record<string, unknown>;
};

export const mergeWrongAnswerAiText = (
  explanation: WrongAnswerExplanation,
  generated: Record<string, unknown>,
): WrongAnswerExplanation => {
  if (
    !WRONG_ANSWER_TEXT_FIELDS.every(
      (field) => typeof generated[field] === 'string' && generated[field].trim().length > 0,
    )
  ) {
    throw new Error('Invalid AI explanation response');
  }

  const text = Object.fromEntries(
    WRONG_ANSWER_TEXT_FIELDS.map((field) => [field, generated[field]]),
  ) as WrongAnswerText;
  return { ...explanation, ...text, generationMode: 'ai_service' };
};

const requestFastApiExplanation = async (
  params: WrongAnswerExplanationParams,
): Promise<WrongAnswerExplanation> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch(`${APP_CONFIG.AI_SERVICE_URL}/explain-wrong-answer`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: params.questionId,
        selectedChoice: params.selectedChoice,
        wrongCount: params.wrongCount,
      }),
    });
    if (!response.ok) throw new Error(`AI service error ${response.status}`);
    const explanation = (await response.json()) as WrongAnswerExplanation;
    if (!explanation.testedPoint || !Array.isArray(explanation.sources)) {
      throw new Error('Invalid AI service response');
    }
    return explanation;
  } finally {
    clearTimeout(timeout);
  }
};

const requestProxyExplanation = async (
  explanation: WrongAnswerExplanation,
  wrongCount: number,
): Promise<WrongAnswerExplanation> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  const prompt =
    '你是面向中国学习者的 JLPT N2 错题教练。只能依据下面 JSON 证据改写讲解，' +
    '不得改变答案、考点、选项事实或来源。只返回 mistakePattern、whyCorrect、' +
    'whyUserWrong、whyDistractorFooled、watchNextTime 五个字符串字段的 JSON，' +
    '每个字段控制在 60-120 个汉字。' +
    `学生累计答错 ${wrongCount} 次。证据：${JSON.stringify(explanation)}`;
  try {
    const response = await fetch(`${APP_CONFIG.DEEPSEEK_PROXY_URL}/v1/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: 'Bearer proxy',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.1,
        max_tokens: 900,
        messages: [
          { role: 'system', content: '严格基于证据回答；证据不足时不要编造。' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!response.ok) throw new Error(`DeepSeek proxy error ${response.status}`);
    const raw = (await response.json()) as OpenAIResponse;
    return mergeWrongAnswerAiText(
      explanation,
      parseJsonObject(raw.choices[0]?.message?.content ?? ''),
    );
  } finally {
    clearTimeout(timeout);
  }
};

export const getWrongAnswerExplanation = async (
  params: WrongAnswerExplanationParams,
): Promise<WrongAnswerExplanation> => {
  const localExplanation = buildLocalRagExplanation(params);
  if (!localExplanation) {
    throw new Error('KNOWLEDGE_NOT_FOUND');
  }

  if (APP_CONFIG.AI_SERVICE_URL) {
    try {
      const serviceExplanation = await requestFastApiExplanation(params);
      if (serviceExplanation.generationMode === 'ai_service') return serviceExplanation;
    } catch (err) {
      if (__DEV__) console.warn('[RAG Coach] FastAPI unavailable, trying proxy:', err);
    }
  }

  if (APP_CONFIG.DEEPSEEK_PROXY_URL) {
    try {
      return await requestProxyExplanation(localExplanation, params.wrongCount);
    } catch (err) {
      if (__DEV__) console.warn('[RAG Coach] proxy unavailable, using local knowledge:', err);
    }
  }

  return localExplanation;
};

const isReviewTiming = (value: unknown): value is 'now' | 'tomorrow' | 'three_days' =>
  value === 'now' || value === 'tomorrow' || value === 'three_days';

export const mergePersonalizedTutorResponse = (
  generated: Record<string, unknown>,
  localExplanation: WrongAnswerExplanation,
  params: PersonalizedTutorParams,
): PersonalizedTutorExplanation => {
  const steps = generated.reasoningSteps;
  const comparison = generated.confusionComparison as Record<string, unknown> | undefined;
  const reviewPlan = generated.reviewPlan;
  const transfer = generated.transferQuestion as Record<string, unknown> | undefined;
  const transferChoices = transfer?.choices;
  const transferAnswer = transfer?.answer;
  const selectedChoice = params.choices[params.selectedChoice];

  if (
    typeof generated.diagnosisSummary !== 'string' ||
    typeof generated.whyYouChoseIt !== 'string' ||
    !Array.isArray(steps) ||
    steps.length !== 3 ||
    !steps.every((step) => typeof step === 'string' && step.trim().length > 0) ||
    !comparison ||
    typeof comparison.decisiveDifference !== 'string' ||
    !Array.isArray(reviewPlan) ||
    reviewPlan.length < 1 ||
    reviewPlan.length > 3 ||
    !reviewPlan.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        isReviewTiming((item as Record<string, unknown>).timing) &&
        typeof (item as Record<string, unknown>).action === 'string',
    ) ||
    !transfer ||
    typeof transfer.prompt !== 'string' ||
    !Array.isArray(transferChoices) ||
    transferChoices.length < 2 ||
    transferChoices.length > 4 ||
    !transferChoices.every((choice) => typeof choice === 'string' && choice.trim().length > 0) ||
    typeof transferAnswer !== 'number' ||
    !Number.isInteger(transferAnswer) ||
    transferAnswer < 0 ||
    transferAnswer >= transferChoices.length ||
    typeof transfer.explanation !== 'string' ||
    !selectedChoice
  ) {
    throw new Error('Invalid personalized tutor response');
  }

  return {
    diagnosisSummary: generated.diagnosisSummary,
    whyYouChoseIt: generated.whyYouChoseIt,
    reasoningSteps: steps as [string, string, string],
    confusionComparison: {
      correctPoint: localExplanation.testedPoint,
      confusedPoint: selectedChoice,
      decisiveDifference: comparison.decisiveDifference,
    },
    reviewPlan: reviewPlan as PersonalizedTutorExplanation['reviewPlan'],
    personalizationEvidence: {
      selectedChoice,
      wrongCount: params.wrongCount,
      weaknessType: params.weaknessType,
      recentSimilarWrongCount: params.recentSimilarWrongCount,
    },
    transferQuestion: {
      prompt: transfer.prompt,
      choices: transferChoices as string[],
      answer: transferAnswer,
      testedPoint: localExplanation.testedPoint,
      explanation: transfer.explanation,
    },
    generationMode: 'ai_tutor',
  };
};

const requestFastApiTutor = async (
  params: PersonalizedTutorParams,
): Promise<Record<string, unknown>> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch(`${APP_CONFIG.AI_SERVICE_URL}/tutor/wrong-answer`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: params.questionId,
        selectedChoice: params.selectedChoice,
        wrongCount: params.wrongCount,
        weaknessType: params.weaknessType,
        recentSimilarWrongCount: params.recentSimilarWrongCount,
        recentSimilarPointIds: params.recentSimilarPointIds.slice(0, 3),
      }),
    });
    if (!response.ok) throw new Error(`Personalized tutor service error ${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
};

const requestProxyTutor = async (
  params: PersonalizedTutorParams,
  localExplanation: WrongAnswerExplanation,
): Promise<Record<string, unknown>> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  const evidence = {
    groundedExplanation: localExplanation,
    learningContext: {
      selectedChoice: params.choices[params.selectedChoice],
      wrongCount: params.wrongCount,
      weaknessType: params.weaknessType,
      recentSimilarWrongCount: params.recentSimilarWrongCount,
      recentSimilarPointIds: params.recentSimilarPointIds.slice(0, 3),
    },
  };
  const prompt =
    '你是 JLPT N2 个性化错题教练。事实只能来自 evidence。不要重复知识库定义，重点诊断学生为何误选。' +
    '只返回 JSON：diagnosisSummary, whyYouChoseIt, reasoningSteps(正好3项), ' +
    'confusionComparison{decisiveDifference}, reviewPlan(1-3项，timing 为 now/tomorrow/three_days), ' +
    'transferQuestion{prompt,choices(2-4项),answer(0开始),explanation}。迁移题必须考查同一考点。\n' +
    JSON.stringify(evidence);
  try {
    const response = await fetch(`${APP_CONFIG.DEEPSEEK_PROXY_URL}/v1/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: 'Bearer proxy', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.2,
        max_tokens: 1400,
        messages: [
          { role: 'system', content: '基于证据个性化教学，只输出合法 JSON。' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Personalized tutor proxy error ${response.status}`);
    const raw = (await response.json()) as OpenAIResponse;
    return parseJsonObject(raw.choices[0]?.message?.content ?? '');
  } finally {
    clearTimeout(timeout);
  }
};

export const getPersonalizedTutorExplanation = async (
  params: PersonalizedTutorParams,
): Promise<PersonalizedTutorExplanation> => {
  const localExplanation = buildLocalRagExplanation(params);
  if (!localExplanation) throw new Error('KNOWLEDGE_NOT_FOUND');

  if (APP_CONFIG.AI_SERVICE_URL) {
    try {
      const generated = await requestFastApiTutor(params);
      return mergePersonalizedTutorResponse(generated, localExplanation, params);
    } catch (err) {
      if (__DEV__) console.warn('[AI Tutor] FastAPI unavailable, trying proxy:', err);
    }
  }

  if (APP_CONFIG.DEEPSEEK_PROXY_URL) {
    const generated = await requestProxyTutor(params, localExplanation);
    return mergePersonalizedTutorResponse(generated, localExplanation, params);
  }

  throw new Error('AI_TUTOR_UNAVAILABLE');
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
  const proxyUrl = APP_CONFIG.DEEPSEEK_PROXY_URL;
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
