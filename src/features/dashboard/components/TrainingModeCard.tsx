import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TrainingMode } from '../../../domain/models/training';
import { colors, fonts, radii } from '../../../theme/tokens';

type TrainingModeCardProps = {
  mode: TrainingMode;
  completed: boolean;
  onOpenMode: (mode: TrainingMode) => void;
  onToggleMode: (modeId: TrainingMode['id']) => void;
};

export function TrainingModeCard({
  mode,
  completed,
  onOpenMode,
  onToggleMode,
}: TrainingModeCardProps) {
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

        <View style={styles.actions}>
          <Pressable
            onPress={() => onOpenMode(mode)}
            style={[styles.secondaryButton, { borderColor: mode.accent }]}
          >
            <Text style={[styles.secondaryText, { color: mode.accent }]}>
              进入详情
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onToggleMode(mode.id)}
            style={[
              styles.primaryButton,
              completed
                ? styles.completedButton
                : { backgroundColor: mode.accent },
            ]}
          >
            <Text
              style={[
                styles.primaryText,
                completed && styles.completedButtonText,
              ]}
            >
              {completed ? '已完成，点按撤销' : '标记为今日已练'}
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
  completedButton: {
    backgroundColor: colors.tealSoft,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  completedButtonText: {
    color: '#166534',
  },
});
