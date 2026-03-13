import type {
  DrillModeId,
  ListeningModeId,
  ReadingModeId,
  ReviewModeId,
  TrainingModeId,
} from '../models/training';
import type {
  ListeningWeaknessErrorType,
  ReadingWeaknessErrorType,
  WeaknessErrorType,
  WrongAnswerErrorType,
} from '../models/trainingContent';

export type WeaknessErrorMeta = {
  label: string;
  sourceModeId: TrainingModeId;
  recommendedModeId: TrainingModeId;
  summary: string;
  coachPoint: string;
  followUp: string;
};

export type WrongAnswerErrorMeta = WeaknessErrorMeta & {
  sourceModeId: DrillModeId;
  recommendedModeId: ReviewModeId;
  reviewModeId: ReviewModeId;
};

const collectErrorTypesFromTags = <T extends string>(
  tags: string[],
  tagMap: Partial<Record<string, T>>,
): T[] => {
  const matched = tags.flatMap((tag) =>
    Object.entries(tagMap)
      .filter(([needle]) => tag.includes(needle))
      .map(([, errorType]) => errorType)
      .filter((errorType): errorType is T => errorType !== undefined),
  );

  return Array.from(new Set(matched));
};

const DRILL_TAG_TO_ERROR_TYPE: Partial<Record<string, WrongAnswerErrorType>> = {
  限制: 'grammar_constraint',
  判断: 'grammar_judgement',
  结论: 'grammar_conclusion',
  并列: 'grammar_parallel',
  让步: 'grammar_concession',
  搭配: 'vocab_collocation',
  固定搭配: 'vocab_collocation',
  语境: 'vocab_context',
  语义: 'vocab_nuance',
};

const READING_TAG_TO_ERROR_TYPE: Partial<Record<string, ReadingWeaknessErrorType>> = {
  主旨: 'reading_main_idea',
  主旨题: 'reading_main_idea',
  作者意图: 'reading_main_idea',
  总结段: 'reading_main_idea',
  首段判断: 'reading_main_idea',
  细节题: 'reading_evidence',
  结果题: 'reading_evidence',
  转折判断: 'reading_distractor',
  方案对比: 'reading_distractor',
  并列信息: 'reading_distractor',
  行为变化: 'reading_distractor',
  信息过载: 'reading_distractor',
};

const LISTENING_TAG_TO_ERROR_TYPE: Partial<Record<string, ListeningWeaknessErrorType>> = {
  物品判断: 'listening_detail_tracking',
  信息加减: 'listening_detail_tracking',
  对象对应: 'listening_detail_tracking',
  时间判断: 'listening_detail_tracking',
  最终保留: 'listening_final_decision',
  最终决定: 'listening_final_decision',
  预约变更: 'listening_final_decision',
  流程变更: 'listening_final_decision',
  目的说明: 'listening_turning_point',
  主次区分: 'listening_turning_point',
  行动判断: 'listening_main_point',
  长文独白: 'listening_main_point',
  主旨判断: 'listening_main_point',
  重点句: 'listening_main_point',
};

const DEFAULT_WRONG_ANSWER_ERROR_TYPE_BY_MODE: Record<DrillModeId, WrongAnswerErrorType> = {
  grammar_drill: 'grammar_judgement',
  vocab_drill: 'vocab_context',
};

const DEFAULT_READING_ERROR_TYPE: ReadingWeaknessErrorType = 'reading_evidence';
const DEFAULT_LISTENING_ERROR_TYPE: ListeningWeaknessErrorType =
  'listening_detail_tracking';

export const WRONG_ANSWER_ERROR_META: Record<
  WrongAnswerErrorType,
  WrongAnswerErrorMeta
> = {
  grammar_constraint: {
    label: '文法限制判断',
    sourceModeId: 'grammar_drill',
    recommendedModeId: 'review_wrong',
    reviewModeId: 'review_wrong',
    summary: '这类错误通常出在没有先抓住“不能做/做不了/受现实限制”这层条件。',
    coachPoint: '先划出句子里的现实限制，再判断后项是在说“不能做”还是“只能这样做”。',
    followUp: '回收后立刻补 1 轮文法闯关，确认限制类句型已经压实。',
  },
  grammar_judgement: {
    label: '文法判断取舍',
    sourceModeId: 'grammar_drill',
    recommendedModeId: 'review_wrong',
    reviewModeId: 'review_wrong',
    summary: '几个句型都眼熟，但没有先把句子的核心判断翻成自己的话。',
    coachPoint: '先把整句改写成中文判断句，再回头看哪个句型最贴近这层意思。',
    followUp: '回收完先补 1 轮文法闯关，不要换模式，直接验证是否稳住。',
  },
  grammar_conclusion: {
    label: '文法结论归纳',
    sourceModeId: 'grammar_drill',
    recommendedModeId: 'review_wrong',
    reviewModeId: 'review_wrong',
    summary: '容易把事实陈述和说话人的推导、说明、结论混在一起。',
    coachPoint: '看到“所以、原来、难怪、也就是说”这类语气时，先判断是不是在做结论归纳。',
    followUp: '回收后补 1 轮文法闯关，专盯“解释/归纳/得出结论”这类题。',
  },
  grammar_parallel: {
    label: '文法并列关系',
    sourceModeId: 'grammar_drill',
    recommendedModeId: 'review_wrong',
    reviewModeId: 'review_wrong',
    summary: '前后项关系没有先分清是同时并进、附带发生，还是因果推进。',
    coachPoint: '先问自己前后两件事是不是同步发生；只有关系先判准，句型才不会漂。',
    followUp: '回收后再补 1 轮文法闯关，专门验证并列和同步关系。',
  },
  grammar_concession: {
    label: '文法让步关系',
    sourceModeId: 'grammar_drill',
    recommendedModeId: 'review_wrong',
    reviewModeId: 'review_wrong',
    summary: '“即使……也……”这层逆向关系没有先建立，容易被表面语气带偏。',
    coachPoint: '先把句子翻成“就算……也……”的结构，再看后项是否仍然成立。',
    followUp: '回收后补 1 轮文法闯关，确认让步和转折不再混淆。',
  },
  vocab_collocation: {
    label: '词汇搭配判断',
    sourceModeId: 'vocab_drill',
    recommendedModeId: 'vocab_review_wrong',
    reviewModeId: 'vocab_review_wrong',
    summary: '词义大致知道，但和对象、动作、场景的搭配关系没有锁住。',
    coachPoint: '别只看中文意思，先问自己这个词通常和什么对象、动作或场景一起出现。',
    followUp: '回收后立刻补 1 轮词汇刷题，专盯搭配关系。',
  },
  vocab_context: {
    label: '词汇语境判断',
    sourceModeId: 'vocab_drill',
    recommendedModeId: 'vocab_review_wrong',
    reviewModeId: 'vocab_review_wrong',
    summary: '几个词意思相近，但没有先把句子放回具体场景，所以容易凭感觉选。',
    coachPoint: '先判断句子是在说预算、动作、状态还是评价，再排掉不合场景的词。',
    followUp: '回收后再补 1 轮词汇刷题，用新题确认场景判断有没有更稳。',
  },
  vocab_nuance: {
    label: '词义细差辨析',
    sourceModeId: 'vocab_drill',
    recommendedModeId: 'vocab_review_wrong',
    reviewModeId: 'vocab_review_wrong',
    summary: '知道大意，但在语气、适用对象和细微差别上还不够稳。',
    coachPoint: '把几个选项都换进原句读一遍，重点听语感、对象和语气是不是自然。',
    followUp: '回收后补 1 轮词汇刷题，继续压词义细差。',
  },
};

export const WEAKNESS_ERROR_META: Record<WeaknessErrorType, WeaknessErrorMeta> = {
  ...WRONG_ANSWER_ERROR_META,
  reading_evidence: {
    label: '读解证据定位',
    sourceModeId: 'reading_drill',
    recommendedModeId: 'reading_drill',
    summary: '读解错误主要暴露在没有先把答案锚回原文证据句，容易凭印象作答。',
    coachPoint: '先回原文找能直接支撑答案的一句，再看选项里谁最贴近这句的意思。',
    followUp: '补 1 轮读解实战，只盯证据句和选项改写，不急着提速。',
  },
  reading_main_idea: {
    label: '读解主旨判断',
    sourceModeId: 'reading_drill',
    recommendedModeId: 'reading_drill',
    summary: '容易在细节里停留太久，没有先抓文章真正想推进的判断。',
    coachPoint: '先分清“首段问题、过程变化、作者总结”三层，再决定主旨落在哪一层。',
    followUp: '补 1 轮读解实战，优先练首段判断和总结段的回收。',
  },
  reading_distractor: {
    label: '读解干扰项排除',
    sourceModeId: 'reading_drill',
    recommendedModeId: 'reading_drill',
    summary: '选项里有看似贴近原文的说法，但没有先排掉偷换范围或只说到一半的干扰项。',
    coachPoint: '每次至少说出两个错误选项为什么不对，再确认正确项到底赢在哪里。',
    followUp: '补 1 轮读解实战，专看“不是 A，而是 B”以及并列结果题。',
  },
  listening_turning_point: {
    label: '听力转折漏听',
    sourceModeId: 'listening_analyze',
    recommendedModeId: 'listening_analyze',
    summary: '听到了前面的铺垫，却漏掉了后面真正改写结论的转折或说明句。',
    coachPoint: '一听到“不是……而是……”“不过”“后来决定”这类信号，就立刻更新判断。',
    followUp: '补 1 轮听力要点拆解，先复述转折前后各自代表什么。',
  },
  listening_detail_tracking: {
    label: '听力信息追踪',
    sourceModeId: 'listening_analyze',
    recommendedModeId: 'listening_analyze',
    summary: '多对象、多时间、多物品题里，信息加减和对应关系没有及时记住。',
    coachPoint: '把对象拆成一行一行记，边听边标“保留 / 新增 / 删除 / 被否”。',
    followUp: '补 1 轮听力要点拆解，只练对象对应、时间调整和物品加减。',
  },
  listening_final_decision: {
    label: '听力最终结论',
    sourceModeId: 'listening_analyze',
    recommendedModeId: 'listening_analyze',
    summary: '停留在中途可行方案，没有抓住最后真正拍板的安排。',
    coachPoint: '题目问“最后怎样”时，只认最后仍然有效的那一句，不把旧方案带进去。',
    followUp: '补 1 轮听力要点拆解，专盯预约变更和最终保留题。',
  },
  listening_main_point: {
    label: '听力主任务判断',
    sourceModeId: 'listening_analyze',
    recommendedModeId: 'listening_analyze',
    summary: '抓到了对话里的细节动作，但没有先确认题干真正问的是主任务、主旨还是附带动作。',
    coachPoint: '先把题干翻成中文目标句，再区分“主任务”和“顺手提到的后续动作”。',
    followUp: '补 1 轮听力要点拆解，专听目的说明和长段独白的主题句。',
  },
};

export const isWrongAnswerErrorType = (
  value: unknown,
): value is WrongAnswerErrorType =>
  typeof value === 'string' && value in WRONG_ANSWER_ERROR_META;

export const isWeaknessErrorType = (value: unknown): value is WeaknessErrorType =>
  typeof value === 'string' && value in WEAKNESS_ERROR_META;

export const inferWrongAnswerErrorTypes = (
  modeId: DrillModeId,
  tags: string[],
): WrongAnswerErrorType[] => {
  const matched = collectErrorTypesFromTags(tags, DRILL_TAG_TO_ERROR_TYPE);

  if (matched.length > 0) {
    return matched;
  }

  return [DEFAULT_WRONG_ANSWER_ERROR_TYPE_BY_MODE[modeId]];
};

export const inferReadingWeaknessErrorTypes = (
  tags: string[],
): ReadingWeaknessErrorType[] => {
  const matched = collectErrorTypesFromTags(tags, READING_TAG_TO_ERROR_TYPE);
  return matched.length > 0 ? matched : [DEFAULT_READING_ERROR_TYPE];
};

export const inferListeningWeaknessErrorTypes = (
  tags: string[],
): ListeningWeaknessErrorType[] => {
  const matched = collectErrorTypesFromTags(tags, LISTENING_TAG_TO_ERROR_TYPE);
  return matched.length > 0 ? matched : [DEFAULT_LISTENING_ERROR_TYPE];
};

export const inferModeWeaknessErrorTypes = (
  modeId: ReadingModeId | ListeningModeId,
  tags: string[],
): WeaknessErrorType[] =>
  modeId === 'reading_drill'
    ? inferReadingWeaknessErrorTypes(tags)
    : inferListeningWeaknessErrorTypes(tags);
