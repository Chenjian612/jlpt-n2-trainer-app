import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  isReviewModeId,
  isStudyModeId,
  type TrainingMode,
} from '../../../domain/models/training';
import { colors, fonts, radii } from '../../../theme/tokens';

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
  const studyMode = isStudyModeId(mode.id);
  const statusText = reviewMode
    ? backlogCount > 0
      ? `待回收 ${backlogCount} 题${completed ? ` · 今日 ${sessionCount} 轮` : ''}`
      : completed
        ? `当前没有待回收错题 · 今日 ${sessionCount} 轮`
        : '当前没有待回收错题'
    : studyMode
      ? completed
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
      ? completed
        ? '再来一轮'
        : '开始学习'
      : completed
        ? '再做一轮'
        : '开始训练';

  return (
    <View style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: mode.accent }]} />

      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{mode.title}</Text>
            <Text style={styles.subtitle}>{mode.subtitle}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: mode.surface }]}>
            <Text style={[styles.chipText, { color: mode.accent }]}>
              {mode.shortTitle}
            </Text>
          </View>
        </View>

        <Text style={styles.description}>{mode.description}</Text>
        <Text style={styles.meta}>
          {mode.durationLabel} · {mode.focus}
        </Text>
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
    flexDirection: 'row',
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  stripe: {
    width: 8,
  },
  body: {
    flex: 1,
    padding: 18,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.inkStrong,
    fontSize: 18,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  description: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  meta: {
    color: '#475569',
    fontSize: 13,
    fontFamily: fonts.body,
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
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
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
    color: '#166534',
  },
});
