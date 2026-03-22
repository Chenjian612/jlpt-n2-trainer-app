import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DashboardInsight, DashboardMetrics } from '../../../domain/models/progress';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';

type HeroCardProps = {
  metrics: DashboardMetrics;
  dailyProgress: number;
  dailyTarget: number;
  insight: DashboardInsight;
  recommendedModeTitle: string | null;
};

export function HeroCard({
  metrics,
  dailyProgress,
  dailyTarget,
  insight,
  recommendedModeTitle,
}: HeroCardProps) {
  const remainingCount = Math.max(dailyTarget - metrics.todayCompletedCount, 0);
  
  const battleMeta = useMemo(() => {
    switch (insight.battleState) {
      case 'first_battle':
        return {
          tag: '今日首战',
          title: recommendedModeTitle ?? '开启首轮训练',
          body: '先把第一轮做起来，节奏一旦启动，后面的推进成本会明显下降。',
          accent: colors.heroHighlight,
        };
      case 'recovering':
        return {
          tag: '回收战',
          title: recommendedModeTitle ?? '清空积压弱项',
          body: '优先处理标记为不稳或错误的项，比直接推新题对考分更有保障。',
          accent: colors.yellow,
        };
      case 'sprint':
        return {
          tag: '达标冲刺',
          title: recommendedModeTitle ?? '冲刺今日目标',
          body: `再完成 ${remainingCount} 轮就能达标，顺着手感继续拿下今天的推荐。`,
          accent: colors.teal,
        };
      case 'goal_reached':
        return {
          tag: '超额加成',
          title: '今日目标已达成',
          body: '今日份的节奏已经拿捏，现在适合针对性补强，或者直接收尾休息。',
          accent: colors.teal,
        };
      default:
        return {
          tag: '今日任务',
          title: recommendedModeTitle ?? '继续训练',
          body: insight.body,
          accent: colors.heroHighlight,
        };
    }
  }, [insight.battleState, insight.body, recommendedModeTitle, remainingCount]);

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroGlowPrimary} />
      <View style={styles.heroGlowSecondary} />

      <View style={styles.heroHeader}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>JLPT N2 TRAINER</Text>
          <Text testID="dashboard-hero-headline" style={styles.heroTitle}>{insight.headline}</Text>
        </View>
        <View style={styles.streakBadge}>
          <Text style={styles.streakValue}>{metrics.currentStreak}</Text>
          <Text style={styles.streakLabel}>连续天数</Text>
        </View>
      </View>

      <Text testID="dashboard-hero-body" style={styles.heroBody}>{insight.body}</Text>

      <View style={styles.focusCard}>
        <View style={styles.focusTop}>
          <View style={[styles.battleTag, { backgroundColor: battleMeta.accent }]}>
            <Text style={styles.battleTagText}>{battleMeta.tag}</Text>
          </View>
          <Text style={styles.focusEyebrow}>今日主线</Text>
        </View>
        <Text style={styles.focusTitle}>{battleMeta.title}</Text>
        <Text style={styles.focusBody}>{battleMeta.body}</Text>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>今日进度</Text>
          <Text style={styles.progressValue}>
            {metrics.todayCompletedCount}/{dailyTarget}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${dailyProgress * 100}%`,
                backgroundColor: battleMeta.accent,
              },
            ]}
          />
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
    padding: 24,
    gap: 20,
    overflow: 'hidden',
    ...shadows.card,
  },
  heroGlowPrimary: {
    position: 'absolute',
    top: -84,
    right: -36,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(232, 182, 94, 0.24)',
  },
  heroGlowSecondary: {
    position: 'absolute',
    bottom: -90,
    left: -24,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(159, 216, 200, 0.18)',
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
    letterSpacing: 1.8,
    marginBottom: 8,
    fontFamily: fonts.body,
  },
  heroTitle: {
    color: '#F6F1E7',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    fontFamily: fonts.title,
  },
  streakBadge: {
    backgroundColor: 'rgba(246, 241, 231, 0.1)',
    borderRadius: radii.md,
    paddingHorizontal: 15,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 92,
    borderWidth: 1,
    borderColor: 'rgba(246, 241, 231, 0.14)',
  },
  streakValue: {
    color: colors.heroHighlight,
    fontSize: 24,
    fontWeight: '800',
  },
  streakLabel: {
    color: '#D5E8E1',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  heroBody: {
    color: colors.heroSoft,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fonts.body,
  },
  focusCard: {
    borderRadius: radii.md,
    backgroundColor: 'rgba(246, 241, 231, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(246, 241, 231, 0.14)',
    padding: 16,
    gap: 6,
  },
  focusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  battleTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  battleTagText: {
    color: colors.inkStrong,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  focusEyebrow: {
    color: colors.heroLine,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  focusTitle: {
    color: '#F6F1E7',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  focusBody: {
    color: colors.heroSoft,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  progressBlock: {
    gap: 10,
    paddingTop: 4,
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
    height: 14,
    backgroundColor: 'rgba(246, 241, 231, 0.15)',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(246, 241, 231, 0.08)',
    paddingVertical: 17,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(246, 241, 231, 0.1)',
  },
  metricNumber: {
    color: '#F6F1E7',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  metricLabel: {
    color: '#D5E8E1',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.body,
  },
});
