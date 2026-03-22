import type { StudyModeId } from '../../domain/models/training';
import type { StudyPack, StudyPackItem, OfficialVocabMemoryItem } from '../../domain/models/trainingContent';
import { EXTENDED_VOCAB_LIBRARY } from './extendedVocabLibrary';
import grammarItemsData from './grammar_study_items.json';

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

const getPagedSlice = <T>(
  items: T[],
  itemsPerPage: number,
  sessionCount: number,
): {
  stage: number;
  totalStages: number;
  start: number;
  end: number;
  items: T[];
} => {
  const safeItemsPerPage = Math.max(itemsPerPage, 1);
  const totalStages = Math.max(Math.ceil(items.length / safeItemsPerPage), 1);
  const stage = ((sessionCount % totalStages) + totalStages) % totalStages;
  const start = stage * safeItemsPerPage;
  const end = Math.min(start + safeItemsPerPage, items.length);

  return {
    stage,
    totalStages,
    start,
    end,
    items: items.slice(start, end),
  };
};

const GRAMMAR_ITEMS_PER_PACK = 3;
const VOCAB_ITEMS_PER_PACK = 70;

const GRAMMAR_ITEMS: StudyPackItem[] = grammarItemsData as StudyPackItem[];

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
    const stageData = getPagedSlice(
      GRAMMAR_ITEMS,
      GRAMMAR_ITEMS_PER_PACK,
      sessionCount,
    );

    return {
      modeId: 'grammar_study',
      theme: `N2 文法核心突破 Stage ${stageData.stage + 1}/${stageData.totalStages}：本轮集中记住 ${stageData.items.length} 个高频句型。`,
      source: `JLPT N2 核心文法精选库 (第 ${stageData.start + 1}-${stageData.end} 项)`,
      items: stageData.items,
    };
  }

  if (modeId === 'vocab_study') {
    const stageData = getPagedSlice(
      EXTENDED_VOCAB_LIBRARY,
      VOCAB_ITEMS_PER_PACK,
      sessionCount,
    );
    const stageItems = stageData.items.map(mapVocabToStudyItem);

    return {
      modeId: 'vocab_study',
      theme: `核心阶梯词汇 Stage ${stageData.stage + 1}/${stageData.totalStages}：今日通过 ${stageItems.length} 个词强化基础。`,
      source: `N2 核心词库 (第 ${stageData.start + 1}-${stageData.end} 条)`,
      items: stageItems,
    };
  }

  return undefined;
};
