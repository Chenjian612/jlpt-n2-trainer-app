import { StyleSheet, Text, View } from 'react-native';

import type { DashboardInsight, DashboardMetrics } from '../../../domain/models/progress';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';

type HeroCardProps = {
  metrics: DashboardMetrics;
  dailyProgress: number;
  dailyTarget: number;
  insight: DashboardInsight;
};

export function HeroCard({
  metrics,
  dailyProgress,
  dailyTarget,
  insight,
}: HeroCardProps) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroHeader}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>JLPT N2 TRAINER</Text>
          <Text style={styles.heroTitle}>{insight.headline}</Text>
        </View>
        <View style={styles.streakBadge}>
          <Text style={styles.streakValue}>{metrics.currentStreak}</Text>
          <Text style={styles.streakLabel}>连续天数</Text>
        </View>
      </View>

      <Text style={styles.heroBody}>{insight.body}</Text>

      <View style={styles.progressBlock}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>今日进度</Text>
          <Text style={styles.progressValue}>
            {metrics.todayCompletedCount}/{dailyTarget}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${dailyProgress * 100}%` }]} />
        </View>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricNumber}>{metrics.weeklySessions}</Text>
          <Text style={styles.metricLabel}>本周训练</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricNumber}>{metrics.bestStreak}</Text>
          <Text style={styles.metricLabel}>最佳连续</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricNumber}>{metrics.totalSessions}</Text>
          <Text style={styles.metricLabel}>累计轮次</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.hero,
    borderRadius: radii.xl,
    padding: 22,
    gap: 18,
    ...shadows.card,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.heroLine,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginBottom: 8,
    fontFamily: fonts.body,
  },
  heroTitle: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    fontFamily: fonts.title,
  },
  streakBadge: {
    backgroundColor: 'rgba(248, 250, 252, 0.12)',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 84,
  },
  streakValue: {
    color: colors.heroHighlight,
    fontSize: 22,
    fontWeight: '800',
  },
  streakLabel: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  heroBody: {
    color: colors.heroSoft,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  progressBlock: {
    gap: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  progressValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  progressTrack: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.yellow,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(248, 250, 252, 0.1)',
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  metricNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  metricLabel: {
    color: '#D1FAE5',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.body,
  },
});

