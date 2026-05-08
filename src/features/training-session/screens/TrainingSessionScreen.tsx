import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { useProgressStore } from '../../../app/providers/ProgressProvider';
import { AppBackground } from '../../../components/common/AppBackground';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import type { TrainingModeId, TrainingSessionKind } from '../../../domain/models/training';
import { getModeSessionCountForDay } from '../../../domain/services/progressService';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';

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
  chapter: {
    introTitle: '进入章节闯关',
    introBody:
      '本轮按章节推进，先学完文法卡再做排序题。章节型模式由专属屏幕承接，这里仅作占位。',
    checklistTitle: '确认本章节奏',
    checklistBody: '走完整章后再进入下一章。',
    reviewTitle: '收口本章',
    reviewBody: '完成后会自动记录到本模式独立进度。',
  },
};

export function TrainingSessionScreen({
  modeId,
  onExit,
  onBackToDetail,
  onBackToDashboard,
}: TrainingSessionScreenProps) {
  const { state, todayKey, recordSession } = useProgressStore();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1040;
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
  const currentStageLabel =
    stage.kind === 'flow'
      ? '训练步骤'
      : stage.kind === 'checklist'
        ? '收口检查'
        : stage.kind === 'review'
          ? '完成确认'
          : '进入准备';

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
      <ScrollView contentContainerStyle={[styles.content, isWideLayout && styles.contentWide]}>
        <View style={styles.header}>
          <Pressable onPress={onExit} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>退出训练</Text>
          </Pressable>
          <Text style={styles.headerTag}>{mode.subtitle}</Text>
        </View>

        <View style={[styles.heroCard, shadows.card, { backgroundColor: mode.accent }]}> 
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
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{mode.checklist.length}</Text>
              <Text style={styles.heroMetaLabel}>收口检查项</Text>
            </View>
          </View>

          <View style={styles.heroAgendaCard}>
            <Text style={styles.heroAgendaEyebrow}>这一轮的目标</Text>
            <Text style={styles.heroAgendaText}>{mode.targetOutput}</Text>
            <Text style={styles.heroAgendaFootnote}>
              当前阶段：{currentStageLabel} · 共 {stages.length} 个步骤
            </Text>
          </View>
        </View>

        {hasRecorded ? (
          <View style={[styles.resultShell, shadows.card]}>
            <View style={styles.resultFlag}>
              <Text style={styles.resultFlagText}>训练已自动记录</Text>
            </View>
            <Text style={styles.resultTitle}>本轮训练完成</Text>
            <Text style={styles.resultLead}>
              本轮结果已经写入今日进度。{mode.title} 今天累计完成 {recordedSessionCount} 轮，系统是在整轮结束后自动记入的。
            </Text>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{recordedSessionCount}</Text>
                <Text style={styles.summaryLabel}>今日累计</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{stages.length}</Text>
                <Text style={styles.summaryLabel}>完成阶段</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{mode.checklist.length}</Text>
                <Text style={styles.summaryLabel}>检查项</Text>
              </View>
            </View>

            <View style={styles.highlightCard}>
              <Text style={styles.highlightEyebrow}>这轮最该带走什么</Text>
              <Text style={styles.highlightTitle}>{mode.targetOutput}</Text>
              <Text style={styles.highlightBody}>
                下一轮不要只重复做动作，要先确认自己能不能更快地进入正确判断路径。
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>下一步建议</Text>
              <Text style={styles.summaryBody}>{mode.reviewTip}</Text>
              <Text style={styles.summaryFootnote}>复盘建议：{mode.targetOutput}</Text>
            </View>

            <View style={styles.resultActions}>
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
          </View>
        ) : (
          <View style={[styles.pageColumns, isWideLayout && styles.pageColumnsWide]}>
            <View style={styles.sidebarColumn}>
              <View style={[styles.progressCard, shadows.card]}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.sectionEyebrow}>轮次总览</Text>
                    <Text style={styles.cardTitle}>当前进度</Text>
                  </View>
                  <View style={styles.stageBadge}>
                    <Text style={styles.stageBadgeText}>{currentStageLabel}</Text>
                  </View>
                </View>

                <View style={styles.progressMetaRow}>
                  <Text style={styles.progressLabel}>阶段推进</Text>
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

              <View style={[styles.timelineCard, shadows.card]}>
                <Text style={styles.sectionEyebrow}>这一轮会怎么走</Text>
                <View style={styles.timelineList}>
                  {stages.map((item, index) => {
                    const active = index === stageIndex;
                    const done = index < stageIndex;

                    return (
                      <View
                        key={`${item.kind}-${index}`}
                        style={[
                          styles.timelineItem,
                          active && { borderColor: mode.accent, backgroundColor: mode.surface },
                        ]}
                      >
                        <View
                          style={[
                            styles.timelineDot,
                            done && { backgroundColor: mode.accent },
                            active && styles.timelineDotActive,
                          ]}
                        />
                        <View style={styles.timelineTextBlock}>
                          <Text
                            style={[
                              styles.timelineTitle,
                              active && { color: mode.accent },
                            ]}
                          >
                            {item.title}
                          </Text>
                          <Text style={styles.timelineBody}>
                            {item.kind === 'flow'
                              ? `步骤 ${index}`
                              : item.kind === 'checklist'
                                ? '逐项确认关键动作'
                                : item.kind === 'review'
                                  ? '收口并自动记录'
                                  : '进入训练前预热'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.mainColumn}>
              <View style={[styles.stageCard, shadows.card]}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.sectionEyebrow}>当前阶段</Text>
                    <Text style={styles.cardTitle}>{stage.title}</Text>
                  </View>
                  {stage.kind === 'flow' ? (
                    <View style={[styles.flowBadge, { backgroundColor: mode.surface }]}>
                      <Text style={[styles.flowBadgeText, { color: mode.accent }]}>
                        {stage.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.sectionBody}>{stage.body}</Text>

                <View style={styles.focusCard}>
                  <Text style={styles.focusLabel}>这一阶段最重要的动作</Text>
                  <Text style={styles.focusText}>
                    {stage.kind === 'intro'
                      ? '先进入正确节奏，不要一上来就变成走流程。'
                      : stage.kind === 'flow'
                        ? stage.body
                        : stage.kind === 'checklist'
                          ? '把关键判断点逐项勾完，再进入复盘。'
                          : mode.targetOutput}
                  </Text>
                </View>

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
            </View>
          </View>
        )}
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 1320,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 18,
  },
  contentWide: {
    paddingHorizontal: 28,
    paddingTop: 20,
    gap: 22,
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
    gap: 12,
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
    fontSize: 32,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  heroBody: {
    color: '#F6FBFA',
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fonts.body,
    maxWidth: 760,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  heroMetaCard: {
    minWidth: 120,
    flexGrow: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  heroMetaValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  heroMetaLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  heroAgendaCard: {
    borderRadius: radii.md,
    padding: 18,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroAgendaEyebrow: {
    color: '#D8F5EA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: fonts.body,
  },
  heroAgendaText: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
    fontFamily: fonts.title,
  },
  heroAgendaFootnote: {
    color: '#D7E7E4',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  resultShell: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 24,
    gap: 18,
  },
  resultFlag: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.heroSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultFlagText: {
    color: colors.hero,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  resultTitle: {
    color: colors.inkStrong,
    fontSize: 30,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  resultLead: {
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fonts.body,
  },
  pageColumns: {
    gap: 18,
  },
  pageColumnsWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sidebarColumn: {
    flex: 0.74,
    gap: 18,
  },
  mainColumn: {
    flex: 1,
    gap: 18,
  },
  progressCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 22,
    gap: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionEyebrow: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: fonts.body,
  },
  cardTitle: {
    color: colors.inkStrong,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  stageBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.backgroundCardMuted,
  },
  stageBadgeText: {
    color: colors.inkStrong,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  progressMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
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
  timelineCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 22,
    gap: 16,
  },
  timelineList: {
    gap: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.warmCard,
    padding: 14,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
    backgroundColor: colors.barIdle,
  },
  timelineDotActive: {
    borderWidth: 2,
    borderColor: colors.hero,
    backgroundColor: colors.backgroundCard,
  },
  timelineTextBlock: {
    flex: 1,
    gap: 4,
  },
  timelineTitle: {
    color: colors.inkStrong,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  timelineBody: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  stageCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 22,
    gap: 16,
  },
  flowBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  flowBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  sectionBody: {
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 24,
    fontFamily: fonts.body,
  },
  focusCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.heroSoft,
    borderWidth: 1,
    borderColor: colors.heroLine,
    padding: 16,
    gap: 6,
  },
  focusLabel: {
    color: colors.hero,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  focusText: {
    color: colors.inkStrong,
    fontSize: 14,
    lineHeight: 22,
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
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  summaryStat: {
    minWidth: 140,
    flexGrow: 1,
    borderRadius: radii.md,
    backgroundColor: colors.warmCard,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 4,
  },
  summaryValue: {
    color: colors.inkStrong,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  summaryLabel: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  highlightCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.hero,
    padding: 18,
    gap: 8,
  },
  highlightEyebrow: {
    color: '#D8F5EA',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  highlightTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  highlightBody: {
    color: '#E6F6F1',
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  summaryCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.warmCard,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  summaryTitle: {
    color: colors.inkStrong,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  summaryBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
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
  resultActions: {
    gap: 12,
  },
  primaryButton: {
    flex: 1.35,
    borderRadius: radii.sm,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.backgroundCard,
  },
  secondaryButtonDisabled: {
    opacity: 0.48,
  },
  secondaryButtonText: {
    color: colors.inkBody,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  secondaryButtonTextDisabled: {
    color: colors.inkMuted,
  },
});
