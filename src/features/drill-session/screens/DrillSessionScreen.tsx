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
import { getDrillQuestionsByMode } from '../../../data/seed/drillQuestions';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import type { DrillModeId } from '../../../domain/models/training';
import type { WrongAnswerDraft } from '../../../domain/models/trainingContent';
import { getModeSessionCountForDay } from '../../../domain/services/progressService';
import { inferWrongAnswerErrorTypes, WRONG_ANSWER_ERROR_META } from '../../../domain/services/wrongAnswerClassifier';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';
import { withKana } from '../../../utils/withKana';

type DrillSessionScreenProps = {
  modeId: DrillModeId;
  onExit: () => void;
  onBackToDetail: () => void;
  onBackToDashboard: () => void;
};

export function DrillSessionScreen({
  modeId,
  onExit,
  onBackToDetail,
  onBackToDashboard,
}: DrillSessionScreenProps) {
  const { state, todayKey, recordDrillSession } = useProgressStore();
  const { width } = useWindowDimensions();
  const mode = getTrainingModeById(modeId);
  const questions = getDrillQuestionsByMode(modeId);

  if (!mode || questions.length === 0) {
    return (
      <AppBackground>
        <View style={styles.missingState}>
          <Text style={styles.missingTitle}>题组暂时不可用</Text>
          <Pressable onPress={onBackToDashboard} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>返回首页</Text>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  const initialSessionCountRef = useRef(
    getModeSessionCountForDay(state, todayKey, mode.id),
  );
  const initialSessionCount = initialSessionCountRef.current;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{
    correctCount: number;
    wrongCount: number;
    recordedSessionCount: number;
    majorErrorTypeLabel?: string;
    majorErrorTypeSummary?: string;
  } | null>(null);
  const finishedRef = useRef(false);
  const question = questions[currentIndex];
  const chosenAnswer = submitted ? answers[question.id] ?? selectedChoice : selectedChoice;
  const isCorrect = chosenAnswer === question.answer;
  const progressValue = (currentIndex + 1) / questions.length;
  const isWideLayout = width >= 1040;
  const answeredCount = Object.keys(answers).length;
  const pendingCount = questions.length - answeredCount;
  const displayedSessionCount = result ? result.recordedSessionCount : initialSessionCount;
  const missionText = result
    ? result.wrongCount > 0
      ? '新增错题已经自动进入回收队列，下一步先处理优先级更高的题。'
      : '这一轮判断比较稳，可以直接继续下一组内容。'
    : submitted
      ? isCorrect
        ? '这题判断方向没问题，下一步把正确依据用自己的话再说一遍。'
        : '先别记答案，回到题干确认真正决定答案的是哪一点。'
      : selectedChoice === null
        ? '先看题干在问什么，再排掉最像正确项的干扰答案。'
        : '提交前再核对一次句子条件和语感。';
  const questionMetaText = `来源：${question.source} · 第 ${currentIndex + 1} 题`;

  const wrongAnswerDrafts = useMemo<WrongAnswerDraft[]>(
    () =>
      questions.reduce<WrongAnswerDraft[]>((drafts, currentQuestion) => {
        const answer = answers[currentQuestion.id];

        if (answer === undefined || answer === currentQuestion.answer) {
          return drafts;
        }

        drafts.push({
          question: currentQuestion,
          selectedChoice: answer,
        });

        return drafts;
      }, []),
    [answers, questions],
  );

  const handleSubmit = () => {
    if (selectedChoice === null || submitted) {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [question.id]: selectedChoice,
    }));
    setSubmitted(true);
  };

  const handleNext = () => {
    if (!submitted) {
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((current) => current + 1);
      setSelectedChoice(null);
      setSubmitted(false);
      return;
    }

    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;

    const wrongErrorTypes = wrongAnswerDrafts.flatMap((draft) =>
      inferWrongAnswerErrorTypes(modeId, draft.question.tags),
    );

    let majorErrorTypeLabel: string | undefined;
    let majorErrorTypeSummary: string | undefined;

    if (wrongErrorTypes.length > 0) {
      const typeCounts = wrongErrorTypes.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const majorType = Object.keys(typeCounts).reduce((a, b) =>
        typeCounts[a] > typeCounts[b] ? a : b,
      ) as keyof typeof WRONG_ANSWER_ERROR_META;

      majorErrorTypeLabel = WRONG_ANSWER_ERROR_META[majorType].label;
      majorErrorTypeSummary = WRONG_ANSWER_ERROR_META[majorType].summary;
    }

    recordDrillSession(modeId, wrongAnswerDrafts);
    setResult({
      correctCount: questions.length - wrongAnswerDrafts.length,
      wrongCount: wrongAnswerDrafts.length,
      recordedSessionCount: initialSessionCount + 1,
      majorErrorTypeLabel,
      majorErrorTypeSummary,
    });
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
              <Text style={[styles.modePillText, { color: mode.accent }]}>{mode.shortTitle}</Text>
            </View>
            <Text style={styles.heroSource}>{mode.sourceLabel}</Text>
          </View>

          <Text style={styles.heroTitle}>{mode.title}</Text>
          <Text style={styles.heroBody}>
            做完整轮题目后会自动记 1 轮训练；答错的题会直接进入本地错题回收队列。
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaLabel}>当前进度</Text>
              <Text style={styles.heroMetaValue}>
                {result ? questions.length : currentIndex + 1}/{questions.length}
              </Text>
            </View>
            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaLabel}>今日累计</Text>
              <Text style={styles.heroMetaValue}>{displayedSessionCount} 轮</Text>
            </View>
            <View style={styles.heroMetaChip}>
              <Text style={styles.heroMetaLabel}>待完成</Text>
              <Text style={styles.heroMetaValue}>{result ? 0 : pendingCount} 题</Text>
            </View>
          </View>

          <View style={styles.heroAgendaCard}>
            <Text style={styles.heroAgendaEyebrow}>这一轮先抓什么</Text>
            <Text style={styles.heroAgendaText}>{missionText}</Text>
            <Text style={styles.heroAgendaFootnote}>
              第 {Math.min(currentIndex + 1, questions.length)} 题 · 先确认题干条件
            </Text>
          </View>
        </View>

        {result ? (
          <View style={[styles.sectionCard, styles.resultShell, shadows.card]}>
            <Text style={styles.sectionTitle}>本轮训练完成</Text>
            <Text style={styles.sectionBody}>
              本轮结果已经写入今日进度。你共答对 {result.correctCount} 题，答错 {result.wrongCount} 题；今天这个模式累计完成 {result.recordedSessionCount} 轮。
            </Text>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{result.correctCount}</Text>
                <Text style={styles.summaryLabel}>答对</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{result.wrongCount}</Text>
                <Text style={styles.summaryLabel}>加入错题队列</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{result.recordedSessionCount}</Text>
                <Text style={styles.summaryLabel}>今日累计</Text>
              </View>
            </View>

            <View style={styles.summaryHighlight}>
              <Text style={styles.summaryHighlightTitle}>
                {result.majorErrorTypeLabel ? `主要错误：${result.majorErrorTypeLabel}` : '下一步建议'}
              </Text>
              <Text style={styles.summaryHighlightBody}>
                {result.majorErrorTypeSummary
                  ? `${result.majorErrorTypeSummary}\n今天的错题已经进入回收队列，接下来先去对应的错题回收模式做一轮，把判断点重新压实。`
                  : result.wrongCount > 0
                    ? '今天的错题已经进入回收队列，接下来先去对应的错题回收模式做一轮，把判断点重新压实。'
                    : '本轮没有新增错题，可以直接回到首页继续今天的安排，或者再刷一轮保持题感。'}
              </Text>
            </View>

            <View style={[styles.timelineCard, styles.timelineCardResult]}>
              <Text style={styles.timelineTitle}>这一轮发生了什么</Text>
              <View style={styles.timelineList}>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, styles.timelineDotDone]} />
                  <Text style={styles.timelineText}>题目已全部作答，整轮记录已保存。</Text>
                </View>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, result.wrongCount > 0 ? styles.timelineDotAlert : styles.timelineDotDone]} />
                  <Text style={styles.timelineText}>
                    {result.wrongCount > 0
                      ? '新增错题已送入回收队列，后续会优先推荐。'
                      : '本轮没有新增错题，今天可以继续推进新内容。'}
                  </Text>
                </View>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, styles.timelineDotDone]} />
                  <Text style={styles.timelineText}>返回首页后会继续沿用今天的推荐顺序。</Text>
                </View>
              </View>
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
          <View style={[styles.sessionGrid, isWideLayout && styles.sessionGridWide]}>
            <View style={styles.primaryColumn}>
              <View style={[styles.progressCard, shadows.card]}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>题目进度</Text>
                  <Text style={styles.progressValue}>
                    {currentIndex + 1}/{questions.length}
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
                  中途退出不会写入记录；只有做完整轮，训练记录和错题回收才会一起保存。
                </Text>
              </View>

              <View style={[styles.sectionCard, shadows.card]}>
                <Text style={styles.questionMeta}>{questionMetaText}</Text>
                <Text style={styles.sectionTitle}>{question.prompt}</Text>

                <View style={styles.missionCard}>
                  <Text style={styles.missionTitle}>这一题先看什么</Text>
                  <Text style={styles.missionBody}>{missionText}</Text>
                </View>

                <View style={styles.choiceList}>
                  {question.choices.map((choice, index) => {
                    const isSelected = chosenAnswer === index;
                    const isAnswer = question.answer === index;

                    return (
                      <Pressable
                        key={choice}
                        onPress={() => !submitted && setSelectedChoice(index)}
                        style={[
                          styles.choiceButton,
                          isSelected && styles.choiceButtonSelected,
                          submitted && isAnswer && styles.choiceButtonCorrect,
                          submitted && isSelected && !isCorrect && styles.choiceButtonWrong,
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceLabel,
                            submitted && isAnswer && styles.choiceLabelCorrect,
                            submitted && isSelected && !isCorrect && styles.choiceLabelWrong,
                          ]}
                        >
                          {index + 1}. {choice}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {submitted ? (
                  <View style={styles.explanationCard}>
                    <Text
                      style={[
                        styles.explanationHeading,
                        { color: isCorrect ? '#166534' : '#B91C1C' },
                      ]}
                    >
                      {isCorrect ? '回答正确' : `正确答案：${withKana(question.choices[question.answer])}`}
                    </Text>

                    <View style={styles.analysisBlock}>
                      <Text style={styles.analysisTitle}>核心判断</Text>
                      <Text style={styles.explanationBody}>{withKana(question.explanation)}</Text>
                    </View>

                    {!isCorrect && chosenAnswer !== null ? (
                      <View style={styles.analysisBlock}>
                        <Text style={styles.analysisTitle}>你这次为什么会错</Text>
                        <Text style={styles.explanationBody}>{withKana(question.choiceInsights[chosenAnswer])}</Text>
                      </View>
                    ) : null}

                    <View style={styles.analysisBlock}>
                      <Text style={styles.analysisTitle}>选项拆解</Text>
                      <View style={styles.analysisList}>
                        {question.choices.map((choice, index) => {
                          const isAnswerChoice = index === question.answer;
                          const isChosenChoice = chosenAnswer === index;

                          return (
                            <View key={choice} style={styles.analysisItem}>
                              <Text
                                style={[
                                  styles.analysisItemLabel,
                                  isAnswerChoice && styles.analysisItemLabelCorrect,
                                  isChosenChoice && !isCorrect && styles.analysisItemLabelWrong,
                                ]}
                              >
                                {withKana(
                                  isAnswerChoice
                                    ? `正确项 ${index + 1}. ${choice}`
                                    : isChosenChoice && !isCorrect
                                      ? `你选了 ${index + 1}. ${choice}`
                                      : `${index + 1}. ${choice}`,
                                )}
                              </Text>
                              <Text style={styles.analysisItemBody}>{withKana(question.choiceInsights[index])}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.analysisBlock}>
                      <Text style={styles.analysisTitle}>复盘提醒</Text>
                      <Text style={styles.explanationBody}>{withKana(question.reviewNote)}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.footerActions}>
                <Pressable
                  onPress={submitted ? handleNext : handleSubmit}
                  disabled={!submitted && selectedChoice === null}
                  style={[
                    styles.primaryButton,
                    { backgroundColor: mode.accent },
                    !submitted && selectedChoice === null && styles.primaryButtonDisabled,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {submitted
                      ? currentIndex === questions.length - 1
                        ? '完成并记录'
                        : '下一题'
                      : '提交答案'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sideColumn}>
              <View style={[styles.timelineCard, shadows.card]}>
                <Text style={styles.timelineTitle}>这一轮的节奏</Text>
                <View style={styles.timelineList}>
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, styles.timelineDotDone]} />
                    <Text style={styles.timelineText}>先读题干，确认真正被考的判断点。</Text>
                  </View>
                  <View style={styles.timelineItem}>
                    <View style={[styles.timelineDot, submitted ? styles.timelineDotDone : styles.timelineDotActive]} />
                    <Text style={styles.timelineText}>
                      {submitted ? '答案已提交，接下来重点看各个选项差在哪里。' : '先排掉迷惑项，再提交你的最终判断。'}
                    </Text>
                  </View>
                  <View style={styles.timelineItem}>
                    <View
                      style={[
                        styles.timelineDot,
                        submitted && currentIndex < questions.length - 1
                          ? styles.timelineDotActive
                          : styles.timelineDotIdle,
                      ]}
                    />
                    <Text style={styles.timelineText}>
                      {currentIndex === questions.length - 1
                        ? '这题做完后就会自动结算整轮结果。'
                        : '复盘完这一题后，直接推进下一题。'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.focusCard, shadows.card]}>
                <Text style={styles.focusTitle}>当前轮次概览</Text>
                <View style={styles.focusStatRow}>
                  <View style={styles.focusStat}>
                    <Text style={styles.focusValue}>{answeredCount}</Text>
                    <Text style={styles.focusLabel}>已提交</Text>
                  </View>
                  <View style={styles.focusStat}>
                    <Text style={styles.focusValue}>{pendingCount}</Text>
                    <Text style={styles.focusLabel}>待完成</Text>
                  </View>
                </View>
                <Text style={styles.focusBody}>
                  做完整轮才会统一写入进度。你现在的目标不是做快，而是把每题真正的判断依据说清楚。
                </Text>
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
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 18,
  },
  contentWide: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 20,
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
    textAlign: 'right',
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
    padding: 24,
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
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
    minWidth: 180,
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
    maxWidth: 720,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroMetaChip: {
    minWidth: 132,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    gap: 4,
  },
  heroMetaLabel: {
    color: '#DDF5EE',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  heroMetaValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  heroAgendaCard: {
    borderRadius: radii.lg,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8,
    backgroundColor: 'rgba(245, 237, 223, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  heroAgendaEyebrow: {
    color: '#DDF5EE',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
    letterSpacing: 0.6,
  },
  heroAgendaText: {
    color: '#FFFFFF',
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  heroAgendaFootnote: {
    color: '#DDF5EE',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  resultShell: {
    borderRadius: radii.xl,
    padding: 22,
  },
  sessionGrid: {
    gap: 18,
  },
  sessionGridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  primaryColumn: {
    flex: 1.55,
    gap: 18,
  },
  sideColumn: {
    flex: 1,
    gap: 18,
  },
  progressCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 20,
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
    borderRadius: radii.xl,
    padding: 20,
    gap: 14,
  },
  sectionTitle: {
    color: colors.inkStrong,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: fonts.title,
    lineHeight: 31,
  },
  sectionBody: {
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fonts.body,
  },
  questionMeta: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  missionCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.warmCard,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  missionTitle: {
    color: colors.inkStrong,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  missionBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  choiceList: {
    gap: 10,
  },
  choiceButton: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: colors.warmCard,
  },
  choiceButtonSelected: {
    borderColor: colors.teal,
    backgroundColor: '#E6FFFA',
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
  explanationCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.warmCard,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  explanationHeading: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  explanationBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  analysisBlock: {
    gap: 8,
  },
  analysisTitle: {
    color: colors.inkStrong,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  analysisList: {
    gap: 10,
  },
  analysisItem: {
    gap: 4,
    borderRadius: radii.md,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  analysisItemLabel: {
    color: colors.inkStrong,
    fontSize: 13,
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
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  timelineCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 20,
    gap: 14,
  },
  timelineCardResult: {
    backgroundColor: colors.warmCard,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  timelineTitle: {
    color: colors.inkStrong,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  timelineList: {
    gap: 12,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineDot: {
    width: 11,
    height: 11,
    borderRadius: radii.pill,
    marginTop: 6,
    flexShrink: 0,
  },
  timelineDotDone: {
    backgroundColor: colors.teal,
  },
  timelineDotActive: {
    backgroundColor: colors.yellow,
  },
  timelineDotAlert: {
    backgroundColor: colors.copper,
  },
  timelineDotIdle: {
    backgroundColor: colors.barIdle,
  },
  timelineText: {
    flex: 1,
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  focusCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 20,
    gap: 14,
  },
  focusTitle: {
    color: colors.inkStrong,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  focusStatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  focusStat: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: colors.warmCard,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  focusValue: {
    color: colors.inkStrong,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  focusLabel: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  focusBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryStat: {
    flexGrow: 1,
    flexBasis: 180,
    borderRadius: radii.lg,
    backgroundColor: colors.warmCard,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.lineSoft,
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
  summaryHighlight: {
    borderRadius: radii.lg,
    backgroundColor: colors.warmCard,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  summaryHighlightTitle: {
    color: colors.inkStrong,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  summaryHighlightBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  footerActions: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: radii.md,
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
    borderRadius: radii.md,
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

