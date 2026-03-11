import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DashboardMetrics, RecentDay } from '../../../domain/models/progress';
import { colors, fonts, radii } from '../../../theme/tokens';

type WeeklyRhythmCardProps = {
  metrics: DashboardMetrics;
  weeklyGoal: number;
  weeklyProgress: number;
  recentWeek: RecentDay[];
  todayKey: string;
  goalOptions: readonly number[];
  onGoalChange: (goal: number) => void;
};

export function WeeklyRhythmCard({
  metrics,
  weeklyGoal,
  weeklyProgress,
  recentWeek,
  todayKey,
  goalOptions,
  onGoalChange,
}: WeeklyRhythmCardProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>本周节奏</Text>

      <View style={styles.weekCard}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>周目标</Text>
          <Text style={styles.progressValue}>
            {metrics.weeklySessions}/{weeklyGoal}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${weeklyProgress * 100}%` }]} />
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryLabel}>当前连续</Text>
            <Text style={styles.summaryValue}>{metrics.currentStreak} 天</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryLabel}>最佳连续</Text>
            <Text style={styles.summaryValue}>{metrics.bestStreak} 天</Text>
          </View>
        </View>

        <View style={styles.goalSelector}>
          {goalOptions.map((goal) => {
            const selected = goal === weeklyGoal;

            return (
              <Pressable
                key={goal}
                onPress={() => onGoalChange(goal)}
                style={[styles.goalPill, selected && styles.goalPillActive]}
              >
                <Text style={[styles.goalText, selected && styles.goalTextActive]}>
                  {goal} 轮
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.weekBars}>
          {recentWeek.map((item) => {
            const isToday = item.dayKey === todayKey;
            const barHeight = 18 + Math.min(item.count, 4) * 18;

            return (
              <View key={item.dayKey} style={styles.weekBarColumn}>
                <View
                  style={[
                    styles.weekBar,
                    {
                      height: barHeight,
                      backgroundColor: item.count > 0 ? colors.teal : colors.barIdle,
                      opacity: isToday ? 1 : 0.82,
                    },
                  ]}
                />
                <Text style={[styles.weekBarLabel, isToday && styles.weekBarLabelToday]}>
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: colors.inkStrong,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  weekCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    padding: 18,
    gap: 16,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.inkBody,
    fontFamily: fonts.body,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.inkStrong,
    fontFamily: fonts.body,
  },
  progressTrack: {
    height: 12,
    backgroundColor: '#DDEAE7',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.teal,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryPill: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.warmCard,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.inkMuted,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  summaryValue: {
    fontSize: 15,
    color: colors.inkStrong,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  goalSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  goalPill: {
    flex: 1,
    borderRadius: radii.pill,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.slateSoft,
  },
  goalPillActive: {
    backgroundColor: colors.hero,
  },
  goalText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    fontFamily: fonts.body,
  },
  goalTextActive: {
    color: '#F8FAFC',
  },
  weekBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  weekBarColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  weekBar: {
    width: 22,
    borderRadius: radii.pill,
  },
  weekBarLabel: {
    fontSize: 12,
    color: colors.inkMuted,
    fontWeight: '600',
    fontFamily: fonts.body,
  },
  weekBarLabelToday: {
    color: colors.inkStrong,
    fontWeight: '800',
  },
});
