import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DashboardInsight } from '../../../domain/models/progress';
import type { TrainingMode } from '../../../domain/models/training';
import { colors, fonts, radii } from '../../../theme/tokens';

type TodayPlanCardProps = {
  todayPlan: TrainingMode[];
  recommendedMode: TrainingMode | null;
  insight: DashboardInsight;
  onOpenMode: (mode: TrainingMode) => void;
  onClearToday: () => void;
};

export function TodayPlanCard({
  todayPlan,
  recommendedMode,
  insight,
  onOpenMode,
  onClearToday,
}: TodayPlanCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>今日计划</Text>
        <Pressable onPress={onClearToday} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>清空今日</Text>
        </Pressable>
      </View>

      <View style={styles.planCard}>
        {recommendedMode ? (
          <Pressable
            onPress={() => onOpenMode(recommendedMode)}
            style={styles.recommendCard}
          >
            <View style={styles.recommendHeader}>
              <Text style={styles.recommendEyebrow}>当前优先推荐</Text>
              <Text style={styles.recommendMode}>{recommendedMode.title}</Text>
            </View>
            <Text style={styles.recommendBody}>{insight.body}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.planLead}>
          {todayPlan.length === 0
            ? '今天的推荐已经完成。现在最适合转去错题回收，或者补一轮听力、读解来扩大收益。'
            : '先按推荐顺序推进，优先完成最短、最稳、最容易拿到反馈的几轮训练。'}
        </Text>

        {todayPlan.length === 0 ? (
          <View style={styles.allDonePill}>
            <Text style={styles.allDoneText}>今日推荐已完成</Text>
          </View>
        ) : (
          todayPlan.map((mode, index) => (
            <Pressable
              key={mode.id}
              onPress={() => onOpenMode(mode)}
              style={styles.planRow}
            >
              <View style={[styles.planIndex, { backgroundColor: mode.surface }]}>
                <Text style={[styles.planIndexText, { color: mode.accent }]}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.planCopy}>
                <Text style={styles.planTitle}>{mode.title}</Text>
                <Text style={styles.planMeta}>
                  {mode.durationLabel} · {mode.focus}
                </Text>
              </View>
              <Text style={styles.planAction}>查看</Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.inkStrong,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  ghostButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.slateSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ghostButtonText: {
    color: colors.inkBody,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  planCard: {
    backgroundColor: colors.warmCard,
    borderRadius: radii.lg,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  recommendCard: {
    borderRadius: radii.md,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: 14,
    gap: 8,
  },
  recommendHeader: {
    gap: 4,
  },
  recommendEyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  recommendMode: {
    color: colors.inkStrong,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  recommendBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  planLead: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planIndex: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planIndexText: {
    fontSize: 15,
    fontWeight: '800',
  },
  planCopy: {
    flex: 1,
    gap: 3,
  },
  planTitle: {
    color: colors.inkStrong,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.title,
  },
  planMeta: {
    color: colors.inkMuted,
    fontSize: 13,
    fontFamily: fonts.body,
  },
  planAction: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  allDonePill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  allDoneText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
});
