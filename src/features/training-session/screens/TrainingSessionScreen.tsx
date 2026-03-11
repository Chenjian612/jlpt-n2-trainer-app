import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useProgressStore } from '../../../app/providers/ProgressProvider';
import { AppBackground } from '../../../components/common/AppBackground';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import type { TrainingModeId, TrainingSessionKind } from '../../../domain/models/training';
import { getModeSessionCountForDay } from '../../../domain/services/progressService';
import { colors, fonts, radii } from '../../../theme/tokens';

type TrainingSessionScreenProps = {
  modeId: TrainingModeId;
  onExit: () => void;
  onBackToDetail: () => void;
  onBackToDashboard: () => void;
};

type SessionStage =
  | {
      kind: 'intro';
      title: string;
      body: string;
      actionLabel: string;
    }
  | {
      kind: 'flow';
      title: string;
      body: string;
      actionLabel: string;
      badge: string;
    }
  | {
      kind: 'checklist';
      title: string;
      body: string;
      actionLabel: string;
    }
  | {
      kind: 'review';
      title: string;
      body: string;
      actionLabel: string;
    };

const SESSION_COPY: Record<
  TrainingSessionKind,
  {
    introTitle: string;
    introBody: string;
    checklistTitle: string;
    checklistBody: string;
    reviewTitle: string;
    reviewBody: string;
  }
> = {
  drill: {
    introTitle: '进入做题节奏',
    introBody:
      '这一轮按真实训练步骤推进。你只要走完整轮，系统会自动记 1 轮；中途退出不计入。',
    checklistTitle: '过一遍排错清单',
    checklistBody:
      '在进入复盘前，确认你已经把这一轮最关键的判断点逐项过了一遍。',
    reviewTitle: '收口这一轮训练',
    reviewBody:
      '现在用一句最短的总结把今天最重要的判断依据说清楚，完成后会自动写入训练记录。',
  },
  study: {
    introTitle: '进入记忆压缩',
    introBody:
      '这一轮的重点不是题量，而是回忆和压缩。走完整轮后自动记录，不需要额外打卡。',
    checklistTitle: '确认记忆锚点',
    checklistBody:
      '把今天真正需要带走的核心语义、对比点和短例句都过一遍，再进入收尾。',
    reviewTitle: '完成回忆确认',
    reviewBody:
      '最后确认自己已经能口头回忆今天最核心的内容。完成这一步后，本轮会自动计入进度。',
  },
  review: {
    introTitle: '进入错题回收',
    introBody:
      '这一轮的目标是把重复错误收口。按顺序走完后自动记录，避免再做成纯勾选。',
    checklistTitle: '确认弱点聚焦',
    checklistBody:
      '在结束前，先确认你今天回收的是同一类错误，而不是分散地看了一圈。',
    reviewTitle: '留下复盘提醒',
    reviewBody:
      '把“下次再遇到这种题先检查什么”说清楚。完成这一步后，本轮会自动写入训练记录。',
  },
};

export function TrainingSessionScreen({
  modeId,
  onExit,
  onBackToDetail,
  onBackToDashboard,
}: TrainingSessionScreenProps) {
  const { state, todayKey, recordSession } = useProgressStore();
  const mode = getTrainingModeById(modeId);

  if (!mode) {
    return (
      <AppBackground>
        <View style={styles.missingState}>
          <Text style={styles.missingTitle}>训练模式不存在</Text>
          <Pressable onPress={onBackToDashboard} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>返回首页</Text>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  const copy = SESSION_COPY[mode.sessionKind];
  const initialSessionCount = getModeSessionCountForDay(state, todayKey, mode.id);
  const [stageIndex, setStageIndex] = useState(0);
  const [checklistState, setChecklistState] = useState(
    mode.checklist.map(() => false),
  );
  const [recordedSessionCount, setRecordedSessionCount] = useState<number | null>(
    null,
  );
  const hasRecordedRef = useRef(false);

  const stages = useMemo<SessionStage[]>(
    () => [
      {
        kind: 'intro',
        title: copy.introTitle,
        body: copy.introBody,
        actionLabel: '开始这一轮',
      },
      ...mode.sessionFlow.map((step, index) => ({
        kind: 'flow' as const,
        title: `步骤 ${index + 1}`,
        body: step,
        actionLabel:
          index === mode.sessionFlow.length - 1 ? '进入检查清单' : '继续下一步',
        badge: `${index + 1}/${mode.sessionFlow.length}`,
      })),
      {
        kind: 'checklist' as const,
        title: copy.checklistTitle,
        body: copy.checklistBody,
        actionLabel: '进入复盘总结',
      },
      {
        kind: 'review' as const,
        title: copy.reviewTitle,
        body: copy.reviewBody,
        actionLabel: '完成本轮并自动记录',
      },
    ],
    [copy, mode.sessionFlow],
  );
  const stage = stages[stageIndex];
  const checklistReady = checklistState.every(Boolean);
  const hasRecorded = recordedSessionCount !== null;
  const progressValue = (stageIndex + 1) / stages.length;

  const toggleChecklistItem = (index: number) => {
    setChecklistState((current) =>
      current.map((checked, currentIndex) =>
        currentIndex === index ? !checked : checked,
      ),
    );
  };

  const handleNext = () => {
    if (hasRecordedRef.current) {
      return;
    }

    if (stage.kind === 'checklist' && !checklistReady) {
      return;
    }

    if (stage.kind === 'review') {
      const nextCount = initialSessionCount + 1;
      hasRecordedRef.current = true;
      setRecordedSessionCount(nextCount);
      recordSession(mode.id, mode.sessionKind);
      return;
    }

    setStageIndex((current) => Math.min(current + 1, stages.length - 1));
  };

  const handlePrevious = () => {
    setStageIndex((current) => Math.max(current - 1, 0));
  };

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={onExit} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>退出训练</Text>
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
          <Text style={styles.heroBody}>{mode.description}</Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{mode.durationLabel}</Text>
              <Text style={styles.heroMetaLabel}>推荐时长</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>
                {recordedSessionCount ?? initialSessionCount}
              </Text>
              <Text style={styles.heroMetaLabel}>今日已记录轮次</Text>
            </View>
          </View>
        </View>

        {hasRecorded ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>本轮训练完成</Text>
            <Text style={styles.sectionBody}>
              本轮结果已经写入今日进度。{mode.title} 今天累计完成 {recordedSessionCount} 轮，系统是在整轮结束后自动记入的。
            </Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>下一步建议</Text>
              <Text style={styles.summaryBody}>{mode.targetOutput}</Text>
              <Text style={styles.summaryFootnote}>复盘建议：{mode.reviewTip}</Text>
            </View>

            <Pressable
              onPress={onBackToDashboard}
              style={[styles.primaryButton, { backgroundColor: mode.accent }]}
            >
              <Text style={styles.primaryButtonText}>继续今天的安排</Text>
            </Pressable>

            <Pressable onPress={onBackToDetail} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>回到模式页</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.progressCard}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>当前进度</Text>
                <Text style={styles.progressValue}>
                  {stageIndex + 1}/{stages.length}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressValue * 100}%`,
                      backgroundColor: mode.accent,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressHint}>
                {initialSessionCount > 0
                  ? `今天这个模式已经记录过 ${initialSessionCount} 轮，再练完会继续累计。`
                  : '中途退出不会写入记录，只有走完整轮才会自动记入。'}
              </Text>
            </View>

            <View style={styles.sectionCard}>
              {stage.kind === 'flow' ? (
                <View style={[styles.badge, { backgroundColor: mode.surface }]}>
                  <Text style={[styles.badgeText, { color: mode.accent }]}>
                    {stage.badge}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>{stage.title}</Text>
              <Text style={styles.sectionBody}>{stage.body}</Text>

              {stage.kind === 'checklist' ? (
                <View style={styles.checklistBlock}>
                  {mode.checklist.map((item, index) => {
                    const checked = checklistState[index];

                    return (
                      <Pressable
                        key={item}
                        onPress={() => toggleChecklistItem(index)}
                        style={[
                          styles.checklistItem,
                          checked && { borderColor: mode.accent, backgroundColor: mode.surface },
                        ]}
                      >
                        <View
                          style={[
                            styles.checkBullet,
                            checked && { backgroundColor: mode.accent },
                          ]}
                        />
                        <Text style={styles.checklistText}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {stage.kind === 'review' ? (
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>完成标准</Text>
                  <Text style={styles.summaryBody}>{mode.targetOutput}</Text>
                  <Text style={styles.summaryFootnote}>复盘建议：{mode.reviewTip}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.footerActions}>
              <Pressable
                onPress={handlePrevious}
                disabled={stageIndex === 0}
                style={[
                  styles.secondaryButton,
                  stageIndex === 0 && styles.secondaryButtonDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    stageIndex === 0 && styles.secondaryButtonTextDisabled,
                  ]}
                >
                  上一步
                </Text>
              </Pressable>

              <Pressable
                onPress={handleNext}
                disabled={stage.kind === 'checklist' && !checklistReady}
                style={[
                  styles.primaryButton,
                  { backgroundColor: mode.accent },
                  stage.kind === 'checklist' &&
                    !checklistReady &&
                    styles.primaryButtonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>{stage.actionLabel}</Text>
              </Pressable>
            </View>
          </>
        )}
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
  headerTag: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  ghostButton: {
    alignSelf: 'flex-start',
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
  heroMetaRow: {
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
  progressCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    padding: 18,
    gap: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: colors.inkStrong,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  progressValue: {
    color: colors.inkBody,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  progressTrack: {
    height: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.slateSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  progressHint: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  sectionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    padding: 18,
    gap: 14,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  sectionTitle: {
    color: colors.inkStrong,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  sectionBody: {
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fonts.body,
  },
  checklistBlock: {
    gap: 12,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.warmCard,
  },
  checkBullet: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.barIdle,
  },
  checklistText: {
    flex: 1,
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  summaryCard: {
    borderRadius: radii.md,
    backgroundColor: colors.warmCard,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  summaryTitle: {
    color: colors.inkStrong,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  summaryBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  summaryFootnote: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1.4,
    borderRadius: radii.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: colors.barIdle,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.slateSoft,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.55,
  },
  secondaryButtonText: {
    color: colors.inkBody,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  secondaryButtonTextDisabled: {
    color: colors.inkMuted,
  },
});


