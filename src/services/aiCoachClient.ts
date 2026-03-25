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
  const parsed = JSON.parse(raw) as Record<string, unknown>;
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
  const response = await fetch('https://api.anthropic.com/v1/messages', {
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

const callDeepSeek = async (
  userContent: string,
  signal: AbortSignal,
): Promise<string> => {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${APP_CONFIG.AI_API_KEY}`,
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
    const raw =
      APP_CONFIG.AI_PROVIDER === 'deepseek'
        ? await callDeepSeek(userContent, controller.signal)
        : await callClaude(userContent, controller.signal);
    return parseExplanation(raw);
  } finally {
    clearTimeout(timeout);
  }
};
