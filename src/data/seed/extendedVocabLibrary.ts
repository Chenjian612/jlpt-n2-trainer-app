import type { OfficialVocabMemoryItem } from '../../domain/models/trainingContent';
import n2VocabData from './n2_vocab_base.json';

/**
 * 扩展词汇库 (JLPT N2 核心阶梯词汇)
 * 来源：基于 Chenjian612/jlpt-n2-my-trainer-resources 映射的官方 N2V/N2G 样题与真题库
 * 总量：扩展至 500 个核心词汇。
 * 
 * 重构说明：现在直接从 n2_vocab_base.json 导入数据，作为 Single Source of Truth。
 */

export const EXTENDED_VOCAB_LIBRARY: OfficialVocabMemoryItem[] = n2VocabData as OfficialVocabMemoryItem[];
