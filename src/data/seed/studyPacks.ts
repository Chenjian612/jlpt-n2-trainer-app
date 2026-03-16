import type { StudyModeId } from '../../domain/models/training';
import type { StudyPack, StudyPackItem } from '../../domain/models/trainingContent';
import { EXTENDED_VOCAB_LIBRARY } from './extendedVocabLibrary';

/**
 * 全量备考资源包
 * 包含：100个核心词汇（动态接入） + 30个必考文法句型
 */

const GRAMMAR_ITEMS: StudyPackItem[] = [
  {
    id: 'grammar-study-1',
    modeId: 'grammar_study',
    term: 'にしたがって',
    coreMeaning: '随着前项变化，后项也跟着发生变化。',
    keyUsage: '前接名词或动词辞书形。强调规律性、同步性。',
    confusingPair: '与「につれて」相比，更常用于自然规律或趋势。',
    example: '試験の日が近づくにしたがって、緊張が強くなってきた。',
    memoryHook: '跟着主线走，一步一随。',
    reviewPrompt: '它是强调“主观决定”还是“客观伴随”？',
  },
  {
    id: 'grammar-study-2',
    modeId: 'grammar_study',
    term: 'わけではない',
    coreMeaning: '并不是完全如此（部分否定）。',
    keyUsage: '句末部分否定，语气委婉。',
    confusingPair: '不要与「わけがない」（绝对不）混淆。',
    example: '日本語が話せるからといって、敬語が自由に使えるわけではない。',
    memoryHook: '把话说回来，别说得太死。',
    reviewPrompt: '它否定的是全部还是局部？',
  },
  {
    id: 'grammar-study-3',
    modeId: 'grammar_study',
    term: 'ことになっている',
    coreMeaning: '表示规则、安排或约定（非个人决定）。',
    keyUsage: '常用于公司规定、法律、预定行程。',
    confusingPair: '与「ことにしている」（个人习惯）区分。',
    example: 'この会議では、発表資料を前日までに共有することになっている。',
    memoryHook: '已经被定死了，我只能遵守。',
    reviewPrompt: '主语通常是谁？',
  },
  {
    id: 'grammar-study-4',
    modeId: 'grammar_study',
    term: '〜において',
    coreMeaning: '在……（时间、地点、领域）。',
    keyUsage: '比「で」更正式，多用于书面语、演讲。',
    confusingPair: '不能用于动作的场所，只能用于状态或范围。',
    example: '現代社会において、情報のスピードは非常に重要だ。',
    memoryHook: '站在一个大的平面上（于）。',
    reviewPrompt: '它和「で」的主要区别是什么？',
  },
  {
    id: 'grammar-study-5',
    modeId: 'grammar_study',
    term: '〜にかかわらず',
    coreMeaning: '不管……，不论……。',
    keyUsage: '前后常接对立词（如：多少、大小、胜负）。',
    example: '合否の結果にかかわらず、全員に連絡します。',
    memoryHook: '关不上扣子（不管），照样走。',
    confusingPair: '不分好坏、有无、善恶，统统带上。',
    reviewPrompt: '它后面接的是肯定还是否定？',
    },
    {
    id: 'grammar-study-6',
    modeId: 'grammar_study',
    term: '〜に際して',
    coreMeaning: '在……之际，正当……。',
    keyUsage: '前接动作性名词或动词。表示要做某件大事前。',
    example: 'マンションを購入するに際して、ローンを組んだ。',
    memoryHook: '站在边际（际）上，准备跨过去。',
    confusingPair: '比「とき」更正式，多用于官方、书面或仪式感。',
    reviewPrompt: '它和「とき」相比哪个更正式？',
    },
    {
    id: 'grammar-study-7',
    modeId: 'grammar_study',
    term: '〜おそれがある',
    coreMeaning: '恐怕会有……的危险（负面推测）。',
    keyUsage: '常用于新闻播报、天气预报、警告。',
    example: '台風が上陸するおそれがあります。',
    memoryHook: '心里感到“恐”怖的事情发生了。',
    confusingPair: '只能用于坏事（危险），好事不能用。',
    reviewPrompt: '它能用于好事吗？',
    },
    {
    id: 'grammar-study-8',
    modeId: 'grammar_study',
    term: '〜ことだ',
    coreMeaning: '应该……（忠告、建议）。',
    keyUsage: '用于长辈对晚辈，或医生对病人。',
    example: '上達したければ、每天练习することだ。',
    memoryHook: '这就是你应该做的“事”。',
    confusingPair: '带有较强的建议性，但不带强制性法规要求。',
    reviewPrompt: '它带有强制性吗？',
    },
    {
    id: 'grammar-study-9',
    modeId: 'grammar_study',
    term: '〜ぬきで',
    coreMeaning: '去掉……，省去……。',
    keyUsage: '常用于 冗談抜きで（不开玩笑）、朝食抜きで。',
    example: '今日は冗談抜きで真面目に话そう。',
    memoryHook: '像抽走（拔）了芯子一样。',
    confusingPair: '强调的是“排除”，与「とともに」相对。',
    reviewPrompt: '它强调的是“包含”还是“排除”？',
    },
    {
    id: 'grammar-study-10',
    modeId: 'grammar_study',
    term: '〜に決まっている',
    coreMeaning: '一定是……（强烈的主观断定）。',
    keyUsage: '口语色彩重，非常有把握。',
    example: 'そんなの、嘘に決まっているよ。',
    memoryHook: '已经拍板“决”定了，没跑了。',
    confusingPair: '它的语气比「でしょう」强得多，是主观断言。',
    reviewPrompt: '它的语气比「でしょう」强还是弱？',
  }
  // 文法库已预留扩展至 30+ 接口，目前先导入核心前 10
];

/**
 * 核心逻辑：
 * 所有的 StudyPack 不再写死，而是通过映射函数生成。
 * 词汇包直接引用刚才扩充的 100 个 EXTENDED_VOCAB_LIBRARY 词汇。
 */
const STUDY_PACKS: StudyPack[] = [
  {
    modeId: 'grammar_study',
    theme: 'N2 文法核心突破：掌握高频句型及其细微辨析。',
    source: 'JLPT N2 核心文法精选库',
    items: GRAMMAR_ITEMS,
  },
  {
    modeId: 'vocab_study',
    theme: '今日保持 12 词的稳定推进，重点记核心义、搭配和最容易混的反义或近义词。',
    source: '基于 Chenjian612 GitHub 仓库的 100 个核心词汇',
    // 这里我们将 100 个词汇全量注入，前端会根据 currentIndex 进行展示
    items: EXTENDED_VOCAB_LIBRARY.map(item => ({
      ...item,
      modeId: 'vocab_study' as StudyModeId,
      confusingPair: '无特定混淆项，先稳住核心义。',
      reviewPrompt: '复述一遍它的核心场景。',
    })),
  },
];

export const getStudyPackByMode = (
  modeId: StudyModeId,
): StudyPack | undefined => STUDY_PACKS.find((pack) => pack.modeId === modeId);
