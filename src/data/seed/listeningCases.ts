import type { ListeningModeId } from '../../domain/models/training';
import type { ListeningCase } from '../../domain/models/trainingContent';
import { LISTENING_DIALOGUE_TRANSLATIONS_ZH } from './listeningCaseLocalization';
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
  'planning-meeting-001': require('../../../assets/audio/generated/planning-meeting-001.mp3'),
  'customer-service-001': require('../../../assets/audio/generated/customer-service-001.mp3'),
  'airport-announcement-001': require('../../../assets/audio/generated/airport-announcement-001.mp3'),
  'office-reassignment-001': require('../../../assets/audio/generated/office-reassignment-001.mp3'),
  'campus-schedule-001': require('../../../assets/audio/generated/campus-schedule-001.mp3'),
  'family-dinner-001': require('../../../assets/audio/generated/family-dinner-001.mp3'),
  'restaurant-change-001': require('../../../assets/audio/generated/restaurant-change-001.mp3'),
  'public-broadcast-001': require('../../../assets/audio/generated/public-broadcast-001.mp3'),
  'clinic-reservation-001': require('../../../assets/audio/generated/clinic-reservation-001.mp3'),
  'warehouse-shift-001': require('../../../assets/audio/generated/warehouse-shift-001.mp3'),
  'instant-reply-001': require('../../../assets/audio/generated/instant-reply-001.mp3'),
  'instant-reply-002': require('../../../assets/audio/generated/instant-reply-002.mp3'),
  'instant-reply-003': require('../../../assets/audio/generated/instant-reply-003.mp3'),
  'instant-reply-004': require('../../../assets/audio/generated/instant-reply-004.mp3'),
  'instant-reply-005': require('../../../assets/audio/generated/instant-reply-005.mp3'),
  'synthesis-001': require('../../../assets/audio/generated/synthesis-001.mp3'),
  'synthesis-002': require('../../../assets/audio/generated/synthesis-002.mp3'),
  'synthesis-003': require('../../../assets/audio/generated/synthesis-003.mp3'),
};

type ListeningCaseRaw = Omit<ListeningCase, 'audioAsset' | 'audioKind' | 'dialogue'> & {
  audioKey: string;
  dialogue: Array<
    Omit<ListeningCase['dialogue'][number], 'translation'> & {
      translation?: string;
    }
  >;
};

const LISTENING_CASES: ListeningCase[] = (
  listeningData as ListeningCaseRaw[]
).map((item) => {
  const audioAsset = AUDIO_ASSETS[item.audioKey];
  const translations = item.dialogue.map(
    (line, index) => line.translation ?? LISTENING_DIALOGUE_TRANSLATIONS_ZH[item.id]?.[index],
  );

  if (!audioAsset) {
    throw new Error(`Missing listening audio asset for ${item.id}: ${item.audioKey}`);
  }

  if (translations.some((translation) => !translation)) {
    throw new Error(`Listening transcript translation mismatch for ${item.id}`);
  }

  return {
    ...item,
    audioAsset,
    audioKind: item.source.includes('JLPT N2 官方') ? 'official' : 'synthetic',
    dialogue: item.dialogue.map((line, index) => ({
      ...line,
      translation: translations[index]!,
    })),
  };
});

export const getListeningCasesByMode = (
  modeId: ListeningModeId,
): ListeningCase[] =>
  LISTENING_CASES.filter((item) => item.modeId === modeId);
