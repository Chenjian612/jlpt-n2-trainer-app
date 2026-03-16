import type { StudyModeId } from '../../domain/models/training';
import type { StudyPack, StudyPackItem, OfficialVocabMemoryItem } from '../../domain/models/trainingContent';
import { EXTENDED_VOCAB_LIBRARY } from './extendedVocabLibrary';

/**
 * 辅助函数：将官方词汇条目转换为学习包条目
 */
const mapVocabToStudyItem = (item: OfficialVocabMemoryItem): StudyPackItem => ({
  id: item.id,
  modeId: 'vocab_study',
  term: item.term,
  reading: item.reading,
  coreMeaning: item.coreMeaning,
  keyUsage: item.keyUsage,
  confusingPair: '重点关注词汇的 N2 核心用法与搭配。',
  example: item.example,
  memoryHook: item.memoryHook,
  reviewPrompt: `在脑中快速回忆「${item.term}」的核心意思和常见搭配。`,
});

const GRAMMAR_ITEMS: StudyPackItem[] = [
  {
    id: 'grammar-study-1',
    modeId: 'grammar_study',
    term: 'にしたがって',
    coreMeaning: '随着前项变化，后项也跟着发生变化。',
    keyUsage: '前接名词或动词辞书形。强调规律性、同步性。',
    confusingPair: '与「につれて」相比，更常用于自然规律或趋势。',
    example: '試験の日が近づくにしたがって、緊張が强くなってきた。',
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
    example: 'この会議では、発表资料を前日までに共有することになっている。',
    memoryHook: '已经被定死了，我只能遵守。',
    reviewPrompt: '主语通常是谁？',
  }
  // ... 更多文法项可以继续在此添加
];

/**
 * 获取学习包
 * @param modeId 模式 ID
 * @param sessionCount 今日已完成轮次 (用于词汇包的阶段切换)
 */
export const getStudyPackByMode = (
  modeId: StudyModeId,
  sessionCount: number = 0,
): StudyPack | undefined => {
  if (modeId === 'grammar_study') {
    return {
      modeId: 'grammar_study',
      theme: 'N2 文法核心突破：掌握高频句型及其细微辨析。',
      source: 'JLPT N2 核心文法精选库',
      items: GRAMMAR_ITEMS,
    };
  }

  if (modeId === 'vocab_study') {
    // 动态分片逻辑：每 70 个词为一个阶段
    const totalItems = EXTENDED_VOCAB_LIBRARY.length;
    const itemsPerPage = 70;
    const stage = sessionCount % Math.ceil(totalItems / itemsPerPage);
    const start = stage * itemsPerPage;
    const end = Math.min(start + itemsPerPage, totalItems);
    
    const stageItems = EXTENDED_VOCAB_LIBRARY.slice(start, end).map(mapVocabToStudyItem);

    return {
      modeId: 'vocab_study',
      theme: `核心阶梯词汇 Stage ${stage + 1}：今日通过 ${stageItems.length} 个词强化基础。`,
      source: `N2 核心词库 (第 ${start + 1}-${end} 条)`,
      items: stageItems,
    };
  }

  return undefined;
};
