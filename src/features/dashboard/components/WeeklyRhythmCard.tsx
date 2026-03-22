import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DashboardMetrics, RecentDay } from '../../../domain/models/progress';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';

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
  const remainingCount = Math.max(weeklyGoal - metrics.weeklySessions, 0);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleBlock}>
          <Text style={styles.sectionTitle}>本周节奏</Text>
          <Text style={styles.sectionCaption}>
            {remainingCount > 0
              ? `再完成 ${remainingCount} 轮就能碰到本周目标。`
              : '本周目标已经达成，接下来重点保持连续性。'}
          </Text>
        </View>
        <View style={styles.badgePill}>
          <Text style={styles.badgePillText}>
            {remainingCount > 0 ? `差 ${remainingCount} 轮` : '已达标'}
          </Text>
        </View>
      </View>

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

        <View style={styles.distSection}>
          <Text style={styles.distTitle}>本周能力板块分布</Text>
          <View style={styles.distGrid}>
            <DistRow
              label="文法"
              count={metrics.capabilityDistribution.grammar}
              total={metrics.weeklySessions}
              color={colors.hero}
            />
            <DistRow
              label="词汇"
              count={metrics.capabilityDistribution.vocab}
              total={metrics.weeklySessions}
              color={colors.yellow}
            />
            <DistRow
              label="读解"
              count={metrics.capabilityDistribution.reading}
              total={metrics.weeklySessions}
              color={colors.teal}
            />
            <DistRow
              label="听力"
              count={metrics.capabilityDistribution.listening}
              total={metrics.weeklySessions}
              color={colors.copper}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function DistRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const ratio = total > 0 ? count / total : 0;

  return (
    <View style={styles.distRow}>
      <Text style={styles.distLabel}>{label}</Text>
      <View style={styles.distTrack}>
        <View
          style={[
            styles.distFill,
            { width: `${ratio * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.distCount}>{count}</Text>
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
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionTitleBlock: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: colors.inkStrong,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  sectionCaption: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  badgePill: {
    borderRadius: radii.pill,
    backgroundColor: colors.backgroundCardMuted,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgePillText: {
    color: colors.copper,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  weekCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    padding: 18,
    gap: 18,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    ...shadows.card,
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
    backgroundColor: colors.slateSoft,
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
    paddingVertical: 14,
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
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.slateSoft,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  goalPillActive: {
    backgroundColor: colors.hero,
    borderColor: colors.hero,
  },
  goalText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkBody,
    fontFamily: fonts.body,
  },
  goalTextActive: {
    color: '#F8FAFC',
  },
  weekBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 8,
    borderRadius: radii.md,
    backgroundColor: colors.mist,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  weekBarColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  weekBar: {
    width: 26,
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
  distSection: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    paddingTop: 16,
  },
  distTitle: {
    color: colors.inkStrong,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  distGrid: {
    gap: 10,
  },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distLabel: {
    width: 32,
    fontSize: 13,
    color: colors.inkMuted,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  distTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.slateSoft,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  distFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  distCount: {
    width: 24,
    textAlign: 'right',
    fontSize: 13,
    color: colors.inkStrong,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
});
