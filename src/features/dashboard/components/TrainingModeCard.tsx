import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  isReviewModeId,
  type TrainingMode,
} from '../../../domain/models/training';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';

type TrainingModeCardProps = {
  mode: TrainingMode;
  completed: boolean;
  sessionCount: number;
  backlogCount?: number;
  onOpenMode: (mode: TrainingMode) => void;
  onStartMode: (mode: TrainingMode) => void;
};

export function TrainingModeCard({
  mode,
  completed,
  sessionCount,
  backlogCount = 0,
  onOpenMode,
  onStartMode,
}: TrainingModeCardProps) {
  const reviewMode = isReviewModeId(mode.id);
  const studyMode = mode.sessionKind === 'study' && !reviewMode;
  const officialVocabMode = mode.id === 'official_vocab_memory';
  const categoryLabel = reviewMode
    ? '回收模式'
    : studyMode
      ? '积累模式'
      : '冲分模式';
  const statusText = reviewMode
    ? backlogCount > 0
      ? `待回收 ${backlogCount} 题${completed ? ` · 今日 ${sessionCount} 轮` : ''}`
      : completed
        ? `当前没有待回收错题 · 今日 ${sessionCount} 轮`
        : '当前没有待回收错题'
    : studyMode
      ? officialVocabMode
        ? completed
          ? `今日已背 ${sessionCount} 轮`
          : '按题型切换官方词卡包'
        : completed
          ? `今日已学习 ${sessionCount} 轮`
          : '适合做一轮稳态记忆'
      : completed
        ? `今日已完成 ${sessionCount} 轮`
        : '今天还没开始这一模式';
  const primaryLabel = reviewMode
    ? backlogCount > 0
      ? '开始回收'
      : '查看模式'
    : studyMode
      ? officialVocabMode
        ? completed
          ? '再开一包'
          : '进入词卡库'
        : completed
          ? '再来一轮'
          : '开始学习'
      : completed
        ? '再做一轮'
        : '开始训练';

  return (
    <View style={styles.card}>
      <View style={[styles.glow, { backgroundColor: mode.surface }]} />

      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <View style={styles.badgeRow}>
              <View style={[styles.chip, { backgroundColor: mode.surface }]}>
                <Text style={[styles.chipText, { color: mode.accent }]}>
                  {mode.shortTitle}
                </Text>
              </View>
              <Text style={styles.categoryLabel}>{categoryLabel}</Text>
            </View>
            <Text style={styles.title}>{mode.title}</Text>
            <Text style={styles.subtitle}>{mode.subtitle}</Text>
          </View>
        </View>

        <Text style={styles.description}>{mode.description}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{mode.durationLabel}</Text>
          <Text style={styles.metaDivider}>·</Text>
          <Text style={styles.meta}>{mode.focus}</Text>
        </View>
        <View style={styles.statusWrap}>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: completed ? mode.surface : colors.slateSoft },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: completed ? mode.accent : colors.inkMuted },
              ]}
            >
              {statusText}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => onOpenMode(mode)}
            style={[styles.secondaryButton, { borderColor: mode.accent }]}
          >
            <Text style={[styles.secondaryText, { color: mode.accent }]}>查看详情</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              reviewMode && backlogCount === 0 ? onOpenMode(mode) : onStartMode(mode)
            }
            style={[
              styles.primaryButton,
              completed ? styles.repeatButton : { backgroundColor: mode.accent },
            ]}
          >
            <Text
              style={[
                styles.primaryText,
                completed && styles.repeatButtonText,
              ]}
            >
              {primaryLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.lineSoft,
    ...shadows.card,
  },
  glow: {
    position: 'absolute',
    top: -26,
    right: -12,
    width: 130,
    height: 130,
    borderRadius: 65,
    opacity: 0.5,
  },
  body: {
    padding: 18,
    gap: 12,
  },
  header: {
    gap: 10,
  },
  titleBlock: {
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: colors.inkStrong,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  subtitle: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.body,
  },
  chip: {
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  categoryLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  description: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  meta: {
    color: colors.inkMuted,
    fontSize: 13,
    fontFamily: fonts.body,
  },
  metaDivider: {
    color: colors.inkSoft,
    fontSize: 13,
    fontFamily: fonts.body,
  },
  statusWrap: {
    flexDirection: 'row',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 2,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  primaryButton: {
    flex: 1.35,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  repeatButton: {
    backgroundColor: colors.tealSoft,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  repeatButtonText: {
    color: colors.teal,
  },
});
