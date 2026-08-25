import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DashboardWeaknessSnapshot, WeaknessTrend } from '../../../domain/models/progress';
import type { TrainingMode } from '../../../domain/models/training';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';

const TREND_CONFIG: Record<WeaknessTrend, { label: string; color: string }> = {
  improving: { label: '↓ 好转', color: colors.teal },
  stable:    { label: '→ 持平', color: colors.inkMuted },
  worsening: { label: '↑ 恶化', color: colors.copper },
};

const MODULE_STATUS_LABEL = {
  clear: '清晰',
  watch: '留意',
  priority: '优先补',
} as const;

type WeaknessCoachCardProps = {
  snapshot: DashboardWeaknessSnapshot;
  recommendedMode: TrainingMode | null;
  onOpenMode: (mode: TrainingMode) => void;
  onStartMode: (mode: TrainingMode) => void;
};

export function WeaknessCoachCard({
  snapshot,
  recommendedMode,
  onOpenMode,
  onStartMode,
}: WeaknessCoachCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleBlock}>
          <Text style={styles.sectionTitle}>薄弱点摘要</Text>
          <Text style={styles.sectionCaption}>
            先按错误类型看，再决定今天到底该回收什么，不把所有错题混成一团。
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>本地教练判断</Text>
          <Text style={styles.summaryTitle}>{snapshot.headline}</Text>
          <Text style={styles.summaryBody}>{snapshot.body}</Text>
        </View>

        <View style={styles.moduleSummary}>
          <View style={styles.moduleSummaryHeader}>
            <View style={styles.moduleSummaryCopy}>
              <Text style={styles.moduleSummaryTitle}>四项能力分布</Text>
              <Text style={styles.moduleSummaryCaption}>
                {snapshot.crossModuleSummary.activeModuleCount} 个模块 ·{' '}
                {snapshot.crossModuleSummary.activeItemCount} 项未稳 · 累计暴露{' '}
                {snapshot.crossModuleSummary.exposureCount} 次
              </Text>
            </View>
            {snapshot.crossModuleSummary.transferVerification.attempts > 0 ? (
              <Text style={styles.transferBadge}>
                迁移正确率{' '}
                {Math.round(
                  (snapshot.crossModuleSummary.transferVerification.accuracy ?? 0) * 100,
                )}
                %
              </Text>
            ) : null}
          </View>
          <View style={styles.moduleList}>
            {snapshot.crossModuleSummary.modules.map((module) => (
              <View key={module.id} style={styles.moduleItem}>
                <Text style={styles.moduleLabel}>{module.label}</Text>
                <Text style={styles.moduleCount}>{module.activeItems} 项</Text>
                <Text
                  style={[
                    styles.moduleStatus,
                    module.status === 'priority' ? styles.moduleStatusPriority : null,
                  ]}
                >
                  {MODULE_STATUS_LABEL[module.status]}
                </Text>
              </View>
            ))}
          </View>
          {snapshot.crossModuleSummary.transferVerification.retryQuestionCount > 0 ? (
            <Text style={styles.transferHint}>
              有 {snapshot.crossModuleSummary.transferVerification.retryQuestionCount}{' '}
              个考点最近一次迁移验证未通过，仍需保留在回收计划中。
            </Text>
          ) : null}
        </View>

        {snapshot.focusItems.length > 0 ? (
          <View style={styles.focusList}>
            {snapshot.focusItems.map((item) => (
              <View key={item.id} style={styles.focusRow}>
                <View style={styles.focusHeader}>
                  <View style={styles.focusLabelRow}>
                    <Text style={styles.focusLabel}>{item.label}</Text>
                    {item.trend ? (
                      <Text style={[styles.trendBadge, { color: TREND_CONFIG[item.trend].color }]}>
                        {TREND_CONFIG[item.trend].label}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.focusMetaRow}>
                    <View style={styles.focusBadge}>
                      <Text style={styles.focusBadgeText}>{item.statusLabel}</Text>
                    </View>
                    <Text style={styles.focusCount}>{item.questionCount} 项未稳</Text>
                  </View>
                </View>
                <Text style={styles.focusBody}>{item.body}</Text>
                <Text style={styles.focusCoach}>攻克方式：{item.coachPoint}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>当前还没有需要集中回收的高频错误。</Text>
          </View>
        )}

        <View style={styles.planSection}>
          <Text style={styles.planTitle}>今天怎么攻克</Text>
          <View style={styles.planList}>
            {snapshot.planSteps.map((step, index) => (
              <View key={step.title} style={styles.planRow}>
                <View style={styles.planIndex}>
                  <Text style={styles.planIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.planCopy}>
                  <Text style={styles.planStepTitle}>{step.title}</Text>
                  <Text style={styles.planStepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {recommendedMode ? (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => onOpenMode(recommendedMode)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>查看详情</Text>
            </Pressable>
            <Pressable
              onPress={() => onStartMode(recommendedMode)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>快速启动 {recommendedMode.title}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionHeader: {
    gap: 10,
  },
  sectionTitleBlock: {
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
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    ...shadows.card,
  },
  summaryCard: {
    borderRadius: radii.md,
    backgroundColor: colors.tealSoft,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: 16,
    gap: 6,
  },
  summaryEyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  summaryTitle: {
    color: colors.inkStrong,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  summaryBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  moduleSummary: {
    borderRadius: radii.md,
    backgroundColor: colors.slateSoft,
    padding: 14,
    gap: 12,
  },
  moduleSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  moduleSummaryCopy: {
    flex: 1,
  },
  moduleSummaryTitle: {
    color: colors.inkStrong,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  moduleSummaryCaption: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  transferBadge: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  moduleList: {
    flexDirection: 'row',
    gap: 8,
  },
  moduleItem: {
    flex: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.backgroundCard,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
  },
  moduleLabel: {
    color: colors.inkStrong,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  moduleCount: {
    color: colors.inkMuted,
    fontSize: 12,
    fontFamily: fonts.body,
  },
  moduleStatus: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  moduleStatusPriority: {
    color: colors.copper,
  },
  transferHint: {
    color: colors.inkBody,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  focusList: {
    gap: 12,
  },
  focusRow: {
    borderRadius: radii.md,
    backgroundColor: colors.mist,
    padding: 14,
    gap: 8,
  },
  focusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  focusMetaRow: {
    alignItems: 'flex-end',
    gap: 6,
  },
  focusLabelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  focusLabel: {
    color: colors.inkStrong,
    fontSize: 17,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  trendBadge: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  focusBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  focusBadgeText: {
    color: colors.copper,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  focusCount: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  focusBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  focusCoach: {
    color: colors.teal,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  emptyState: {
    borderRadius: radii.md,
    backgroundColor: colors.mist,
    padding: 14,
  },
  emptyStateText: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  planSection: {
    gap: 10,
  },
  planTitle: {
    color: colors.inkStrong,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  planList: {
    gap: 10,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  planIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.warmCard,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  planIndexText: {
    color: colors.copper,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  planCopy: {
    flex: 1,
    gap: 3,
  },
  planStepTitle: {
    color: colors.inkStrong,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  planStepBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1.4,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.backgroundCard,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.slateSoft,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.inkBody,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
});
