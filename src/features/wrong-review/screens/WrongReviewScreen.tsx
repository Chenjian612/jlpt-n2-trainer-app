import { useRef, useState } from 'react';
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
import { REVIEW_SOURCE_MODE, type ReviewModeId } from '../../../domain/models/training';
import type { WrongReviewDecision } from '../../../domain/models/trainingContent';
import {
  getModeSessionCountForDay,
  getPrioritizedWrongAnswersForMode,
  getWrongAnswerPriorityLabel,
} from '../../../domain/services/progressService';
import { colors, fonts, radii } from '../../../theme/tokens';

type WrongReviewScreenProps = {
  modeId: ReviewModeId;
  onExit: () => void;
  onBackToDetail: () => void;
  onBackToDashboard: () => void;
};

export function WrongReviewScreen({
  modeId,
  onExit,
  onBackToDetail,
  onBackToDashboard,
}: WrongReviewScreenProps) {
  const { state, todayKey, completeWrongReviewSession } = useProgressStore();
  const mode = getTrainingModeById(modeId);

  if (!mode) {
    return (
      <AppBackground>
        <View style={styles.missingState}>
          <Text style={styles.missingTitle}>错题回收模式不存在</Text>
          <Pressable onPress={onBackToDashboard} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>返回首页</Text>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  const sourceModeId = REVIEW_SOURCE_MODE[modeId];
  const allBacklog = getPrioritizedWrongAnswersForMode(state, sourceModeId);
  const [reviewItems] = useState(() => allBacklog.slice(0, 5));
  const initialSessionCount = getModeSessionCountForDay(state, todayKey, mode.id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<WrongReviewDecision[]>([]);
  const [result, setResult] = useState<{
    reviewedCount: number;
    masteredCount: number;
    recordedSessionCount: number;
  } | null>(null);
  const finishRef = useRef(false);

  if (reviewItems.length === 0) {
    return (
      <AppBackground>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Pressable onPress={onBackToDetail} style={styles.ghostButton}>
              <Text style={styles.ghostButtonText}>返回详情</Text>
            </Pressable>
            <Text style={styles.headerTag}>{mode.subtitle}</Text>
          </View>

          <View style={[styles.heroCard, { backgroundColor: mode.accent }]}>
            <Text style={styles.heroTitle}>{mode.title}</Text>
            <Text style={styles.heroBody}>
              目前还没有待回收的错题。先去做一轮对应的真实刷题，错题才会进入这里。
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>当前状态</Text>
            <Text style={styles.sectionBody}>
              这个回收模式只处理最近答错且尚未标记掌握的题目。现在队列为空，所以本轮不会新增回收记录。
            </Text>
            <Pressable
              onPress={onBackToDashboard}
              style={[styles.primaryButton, { backgroundColor: mode.accent }]}
            >
              <Text style={styles.primaryButtonText}>回到首页</Text>
            </Pressable>
          </View>
        </ScrollView>
      </AppBackground>
    );
  }

  const item = reviewItems[currentIndex];
  const priorityLabel = getWrongAnswerPriorityLabel(item);
  const lastWrongInsight =
    item.lastUserChoice !== null && item.lastUserChoice !== item.answer
      ? item.choiceInsights[item.lastUserChoice] ?? null
      : null;
  const correctInsight = item.choiceInsights[item.answer] ?? item.explanation;

  const handleDecision = (mastered: boolean) => {
    if (finishRef.current) {
      return;
    }

    const nextDecisions = [
      ...decisions,
      { questionId: item.questionId, mastered },
    ];

    if (currentIndex < reviewItems.length - 1) {
      setDecisions(nextDecisions);
      setCurrentIndex((current) => current + 1);
      return;
    }

    finishRef.current = true;
    completeWrongReviewSession(modeId, nextDecisions);
    setResult({
      reviewedCount: reviewItems.length,
      masteredCount: nextDecisions.filter((decision) => decision.mastered).length,
      recordedSessionCount: initialSessionCount + 1,
    });
  };

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={onExit} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>退出回收</Text>
          </Pressable>
          <Text style={styles.headerTag}>{mode.subtitle}</Text>
        </View>

        <View style={[styles.heroCard, { backgroundColor: mode.accent }]}>
          <Text style={styles.heroTitle}>{mode.title}</Text>
          <Text style={styles.heroBody}>
            这轮会优先处理最值得先回收的错题。做完本轮后会自动记 1 轮回收记录。
          </Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{reviewItems.length}</Text>
              <Text style={styles.heroMetaLabel}>本轮回收题数</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{allBacklog.length}</Text>
              <Text style={styles.heroMetaLabel}>当前待回收总数</Text>
            </View>
          </View>
        </View>

        {result ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>本轮回收完成</Text>
            <Text style={styles.sectionBody}>
              本轮结果已经写入今日进度。你共处理 {result.reviewedCount} 题，其中标记已掌握 {result.masteredCount} 题；今天这个模式累计完成 {result.recordedSessionCount} 轮。
            </Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>下一步建议</Text>
              <Text style={styles.summaryBody}>
                {result.masteredCount < result.reviewedCount
                  ? '还没掌握的题会继续留在队列里，下一次优先回收同类错误。'
                  : '这一轮处理的题都已标记掌握，接下来适合回到真实刷题继续验证。'}
              </Text>
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
                <Text style={styles.progressLabel}>回收进度</Text>
                <Text style={styles.progressValue}>
                  {currentIndex + 1}/{reviewItems.length}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${((currentIndex + 1) / reviewItems.length) * 100}%`,
                      backgroundColor: mode.accent,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressHint}>
                本轮优先挑最值得先处理的 {reviewItems.length} 题；中途退出不计回收轮次，也不会修改错题状态。
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.priorityRow}>
                <View style={styles.priorityPill}>
                  <Text style={styles.priorityPillText}>{priorityLabel}</Text>
                </View>
                <Text style={styles.priorityMeta}>已错 {item.wrongCount} 次</Text>
              </View>

              <Text style={styles.sectionTitle}>{item.prompt}</Text>
              <Text style={styles.sectionBody}>
                这是你最近反复出错的一题。先看清自己上次为什么误选，再判断这题现在是否已经真正掌握。
              </Text>

              <View style={styles.choiceList}>
                {item.choices.map((choice, index) => {
                  const isCorrect = index === item.answer;
                  const isLastWrong = index === item.lastUserChoice;

                  return (
                    <View
                      key={choice}
                      style={[
                        styles.choiceButton,
                        isCorrect && styles.choiceButtonCorrect,
                        isLastWrong && !isCorrect && styles.choiceButtonWrong,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceLabel,
                          isCorrect && styles.choiceLabelCorrect,
                          isLastWrong && !isCorrect && styles.choiceLabelWrong,
                        ]}
                      >
                        {index + 1}. {choice}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>为什么先回收这题</Text>
                <Text style={styles.summaryBody}>
                  {priorityLabel === '高优先级'
                    ? '这题已经重复错了多次，继续拖延最容易固化成稳定误判。'
                    : priorityLabel === '待首次回收'
                      ? '这题刚进入错题队列，还没做过正式回收，趁记忆还新先处理更高效。'
                      : priorityLabel === '该复习了'
                        ? '这题之前回收过，但已经隔了一段时间，现在适合再确认一次。'
                        : '这题已经处理过一轮，但还需要继续巩固，防止重新滑回错误。'}
                </Text>
                <Text style={styles.summaryFootnote}>
                  来源：{item.source} · {item.tags.join(' / ')}
                </Text>
              </View>

              <View style={styles.analysisBlock}>
                <Text style={styles.analysisTitle}>核心判断</Text>
                <Text style={styles.analysisBody}>{item.explanation}</Text>
              </View>

              {lastWrongInsight ? (
                <View style={styles.analysisBlock}>
                  <Text style={styles.analysisTitle}>上次误选为什么不对</Text>
                  <Text style={styles.analysisBody}>{lastWrongInsight}</Text>
                </View>
              ) : null}

              <View style={styles.analysisBlock}>
                <Text style={styles.analysisTitle}>正确项为什么对</Text>
                <Text style={styles.analysisBody}>{correctInsight}</Text>
              </View>

              <View style={styles.analysisBlock}>
                <Text style={styles.analysisTitle}>选项拆解</Text>
                <View style={styles.analysisList}>
                  {item.choices.map((choice, index) => {
                    const isCorrect = index === item.answer;
                    const isLastWrong = index === item.lastUserChoice && !isCorrect;

                    return (
                      <View key={choice} style={styles.analysisItem}>
                        <Text
                          style={[
                            styles.analysisItemLabel,
                            isCorrect && styles.analysisItemLabelCorrect,
                            isLastWrong && styles.analysisItemLabelWrong,
                          ]}
                        >
                          {isCorrect
                            ? `正确项 ${index + 1}. ${choice}`
                            : isLastWrong
                              ? `上次误选 ${index + 1}. ${choice}`
                              : `${index + 1}. ${choice}`}
                        </Text>
                        <Text style={styles.analysisItemBody}>
                          {item.choiceInsights[index] ?? '这项暂时没有补充说明。'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.analysisBlock}>
                <Text style={styles.analysisTitle}>复盘提醒</Text>
                <Text style={styles.analysisBody}>{item.reviewNote}</Text>
              </View>
            </View>

            <View style={styles.footerActions}>
              <Pressable
                onPress={() => handleDecision(false)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>暂时还不稳</Text>
              </Pressable>
              <Pressable
                onPress={() => handleDecision(true)}
                style={[styles.primaryButton, { backgroundColor: mode.accent }]}
              >
                <Text style={styles.primaryButtonText}>这题我已掌握</Text>
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
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  priorityPill: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.warmCard,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  priorityPillText: {
    color: colors.inkStrong,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  priorityMeta: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
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
  choiceList: {
    gap: 10,
  },
  choiceButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.warmCard,
  },
  choiceButtonCorrect: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  choiceButtonWrong: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  choiceLabel: {
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  choiceLabelCorrect: {
    color: '#166534',
  },
  choiceLabelWrong: {
    color: '#991B1B',
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
  analysisBlock: {
    borderRadius: radii.md,
    backgroundColor: colors.warmCard,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  analysisTitle: {
    color: colors.inkStrong,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  analysisBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  analysisList: {
    gap: 10,
  },
  analysisItem: {
    gap: 4,
  },
  analysisItemLabel: {
    color: colors.inkStrong,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  analysisItemLabelCorrect: {
    color: '#166534',
  },
  analysisItemLabelWrong: {
    color: '#991B1B',
  },
  analysisItemBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    borderRadius: radii.sm,
    paddingVertical: 16,
    alignItems: 'center',
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
  secondaryButtonText: {
    color: colors.inkBody,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
});


