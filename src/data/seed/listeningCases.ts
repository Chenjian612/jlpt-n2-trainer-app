import type { ListeningModeId } from '../../domain/models/training';
import type { ListeningCase } from '../../domain/models/trainingContent';
import listeningData from './listening_cases.json';

/**
 * React Native 要求 require() 必须是静态字符串字面量，不能动态拼接。
 * 因此音频资源以静态映射表的形式保留在 TS 文件中，
 * JSON 里用 audioKey 字段存储键名，加载时在此处 resolve。
 */
const AUDIO_ASSETS: Record<string, ReturnType<typeof require>> = {
  N2M1Q2: require('../../../assets/audio/official/N2M1Q2.mp3'),
  N2M2Q2: require('../../../assets/audio/official/N2M2Q2.mp3'),
  N2M3Q1: require('../../../assets/audio/official/N2M3Q1.mp3'),
  N2M4Q1: require('../../../assets/audio/official/N2M4Q1.mp3'),
  N2M5Q1: require('../../../assets/audio/official/N2M5Q1.mp3'),
};

type ListeningCaseRaw = Omit<ListeningCase, 'audioAsset'> & { audioKey: string };

const LISTENING_CASES: ListeningCase[] = (
  listeningData as ListeningCaseRaw[]
).map((item) => ({
  ...item,
  audioAsset: AUDIO_ASSETS[item.audioKey] ?? AUDIO_ASSETS['N2M1Q2'],
}));

export const getListeningCasesByMode = (
  modeId: ListeningModeId,
): ListeningCase[] =>
  LISTENING_CASES.filter((item) => item.modeId === modeId);
