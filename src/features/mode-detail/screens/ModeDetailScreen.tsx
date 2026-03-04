import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProgressStore } from '../../../app/providers/ProgressProvider';
import { AppBackground } from '../../../components/common/AppBackground';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import type { TrainingModeId } from '../../../domain/models/training';
import { colors, fonts, radii } from '../../../theme/tokens';

type ModeDetailScreenProps = {
  modeId: TrainingModeId;
  onBack: () => void;
};

export function ModeDetailScreen({
  modeId,
  onBack,
}: ModeDetailScreenProps) {
  const { state, todayKey, toggleMode } = useProgressStore();
  const mode = getTrainingModeById(modeId);

  if (!mode) {
    return (
      <AppBackground>
        <View style={styles.missingState}>
          <Text style={styles.missingTitle}>模式不存在</Text>
          <Pressable onPress={onBack} style={styles.backGhost}>
            <Text style={styles.backGhostText}>返回首页</Text>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  const completed = (state.completedByDay[todayKey] ?? []).includes(mode.id);

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backGhost}>
            <Text style={styles.backGhostText}>返回</Text>
          </Pressable>
          <Text style={styles.headerTag}>{mode.subtitle}</Text>
        </View>

        <View style={[styles.heroCard, { backgroundColor: mode.accent }]}>
          <View style={styles.heroTop}>
            <View style={[styles.modePill, { backgroundColor: mode.surface }]}>
              <Text style={[styles.modePillText, { color: mode.accent }]}>
                {mode.shortTitle}
              </Text>
            </View>
            <Text style={styles.heroSource}>{mode.sourceLabel}</Text>
          </View>

          <Text style={styles.heroTitle}>{mode.title}</Text>
          <Text style={styles.heroBody}>{mode.detailIntro}</Text>

          <View style={styles.heroMetaGrid}>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{mode.durationLabel}</Text>
              <Text style={styles.heroMetaLabel}>推荐时长</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{completed ? '已完成' : '待开始'}</Text>
              <Text style={styles.heroMetaLabel}>今日状态</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>今日做法</Text>
          {mode.sessionFlow.map((step, index) => (
            <View key={step} style={styles.listRow}>
              <View style={[styles.indexDot, { backgroundColor: mode.surface }]}>
                <Text style={[styles.indexDotText, { color: mode.accent }]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={styles.listText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>检查清单</Text>
          {mode.checklist.map((item) => (
            <View key={item} style={styles.checkRow}>
              <View style={[styles.checkDot, { backgroundColor: mode.accent }]} />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>完成标准</Text>
          <Text style={styles.targetText}>{mode.targetOutput}</Text>
          <Text style={styles.reviewTip}>复盘建议：{mode.reviewTip}</Text>
        </View>

        <View style={styles.footerActions}>
          <Pressable
            onPress={() => toggleMode(mode.id)}
            style={[
              styles.primaryButton,
              completed ? styles.primaryButtonDone : { backgroundColor: mode.accent },
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                completed && styles.primaryButtonTextDone,
              ]}
            >
              {completed ? '今天已完成，点按撤销' : '完成训练后点这里打卡'}
            </Text>
          </Pressable>

          <Pressable onPress={onBack} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>回到首页继续安排</Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 18,
  },
  missingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  missingTitle: {
    color: colors.inkStrong,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backGhost: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.slateSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backGhostText: {
    color: colors.inkBody,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  headerTag: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  heroCard: {
    borderRadius: radii.xl,
    padding: 22,
    gap: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modePill: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  heroSource: {
    flex: 1,
    textAlign: 'right',
    color: '#ECFEFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  heroBody: {
    color: '#F8FAFC',
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fonts.body,
  },
  heroMetaGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  heroMetaCard: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  heroMetaValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  heroMetaLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  sectionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    color: colors.inkStrong,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  listRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  indexDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexDotText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  listText: {
    flex: 1,
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkText: {
    flex: 1,
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  targetText: {
    color: colors.inkStrong,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  reviewTip: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  footerActions: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: radii.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDone: {
    backgroundColor: colors.tealSoft,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  primaryButtonTextDone: {
    color: '#166534',
  },
  secondaryButton: {
    borderRadius: radii.sm,
    backgroundColor: colors.slateSoft,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.inkBody,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
});
