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
import { getReadingPassageByMode } from '../../../data/seed/readingPassages';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import type { ReadingModeId } from '../../../domain/models/training';
import { getModeSessionCountForDay } from '../../../domain/services/progressService';
import { inferReadingWeaknessErrorTypes } from '../../../domain/services/wrongAnswerClassifier';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';
import { withKana } from '../../../utils/withKana';

type ReadingSessionScreenProps = {
  modeId: ReadingModeId;
  onExit: () => void;
  onBackToDetail: () => void;
  onBackToDashboard: () => void;
};

export function ReadingSessionScreen({
  modeId,
  onExit,
  onBackToDetail,
  onBackToDashboard,
}: ReadingSessionScreenProps) {
  const { state, todayKey, recordSession } = useProgressStore();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1040;
  const mode = getTrainingModeById(modeId);
  const passage = getReadingPassageByMode(modeId);

  if (!mode || !passage || passage.questions.length === 0) {
    return (
      <AppBackground>
        <View style={styles.missingState}>
          <Text style={styles.missingTitle}>读解材料暂时不可用</Text>
          <Pressable onPress={onBackToDashboard} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>返回首页</Text>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  const initialSessionCount = getModeSessionCountForDay(state, todayKey, mode.id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{
    correctCount: number;
    wrongCount: number;
    recordedSessionCount: number;
  } | null>(null);
  const finishedRef = useRef(false);

  const question = passage.questions[currentIndex];
  const chosenAnswer = submitted ? answers[question.id] ?? selectedChoice : selectedChoice;
  const isCorrect = chosenAnswer === question.answer;
  const progressValue = (currentIndex + 1) / passage.questions.length;
  const missionText = submitted
    ? isCorrect
      ? '这题判断得对，下一步把依据句用自己的话复述一遍。'
      : '先别记选项，回到原文确认真正支撑答案的是哪一句。'
    : '先确认题干到底问什么，再回文中找依据，最后排掉最像正确项的干扰项。';
  const questionMetaText = `第 ${currentIndex + 1} 题 / 第 ${currentIndex + 1} 問`;
  const wrongQuestionLabels = useMemo(
    () =>
      passage.questions.reduce<string[]>((labels, currentQuestion, index) => {
        const answer = answers[currentQuestion.id];

        if (answer !== undefined && answer !== currentQuestion.answer) {
          labels.push(`第 ${index + 1} 题`);
        }

        return labels;
      }, []),
    [answers, passage.questions],
  );
  const readingWeaknessSignals = useMemo(
    () =>
      passage.questions
        .filter((currentQuestion) => answers[currentQuestion.id] !== undefined)
        .map((currentQuestion) => ({
          questionId: currentQuestion.id,
          modeId,
          prompt: currentQuestion.prompt,
          source: passage.source,
          tags: currentQuestion.tags,
          errorTypes: inferReadingWeaknessErrorTypes(currentQuestion.tags),
          wasCorrect: answers[currentQuestion.id] === currentQuestion.answer,
        })),
    [answers, modeId, passage.questions, passage.source],
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

    if (currentIndex < passage.questions.length - 1) {
      setCurrentIndex((current) => current + 1);
      setSelectedChoice(null);
      setSubmitted(false);
      return;
    }

    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    const wrongCount = wrongQuestionLabels.length;

    recordSession(modeId, 'drill', readingWeaknessSignals);
    setResult({
      correctCount: passage.questions.length - wrongCount,
      wrongCount,
      recordedSessionCount: initialSessionCount + 1,
    });
  };

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={[styles.content, isWideLayout && styles.contentWide]}>
        <View style={styles.header}>
          <Pressable onPress={onExit} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>退出读解</Text>
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
            <Text style={styles.heroSource}>{passage.source}</Text>
          </View>

          <Text style={styles.heroTitle}>{mode.title}</Text>
          <Text style={styles.heroBody}>{passage.guidance}</Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{passage.questions.length}</Text>
              <Text style={styles.heroMetaLabel}>本轮题数</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>
                {passage.paragraphs.length}
              </Text>
              <Text style={styles.heroMetaLabel}>段落数</Text>
            </View>
          </View>
        </View>

        {result ? (
          <View style={[styles.sectionCard, styles.resultCard, shadows.card]}>
            <Text style={styles.sectionTitle}>本轮读解完成</Text>
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
                <Text style={styles.summaryLabel}>答错</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {Math.round((result.correctCount / passage.questions.length) * 100)}%
                </Text>
                <Text style={styles.summaryLabel}>正确率</Text>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>下一步建议</Text>
              <Text style={styles.summaryBody}>
                {result.wrongCount > 0
                  ? `优先回看 ${wrongQuestionLabels.join(' / ')} 的证据句，再复述一次为什么其他选项不成立。`
                  : '这轮没有答错题，接下来重点回忆每题的证据位置，别只记住答案本身。'}
              </Text>
              <Text style={styles.summaryFootnote}>复盘提示：{mode.reviewTip}</Text>
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
            <View style={styles.passagesCard}>
              <Text style={styles.sectionTitle}>{passage.title}</Text>
              <Text style={styles.leadText}>{passage.lead}</Text>

              <View style={styles.passageList}>
                {passage.paragraphs.map((paragraph, index) => (
                  <View key={paragraph} style={styles.passageBlock}>
                    <Text style={styles.passageLabel}>第 {index + 1} 段</Text>
                    <Text style={styles.passageBody}>{paragraph}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>题目进度</Text>
                <Text style={styles.progressValue}>
                  {currentIndex + 1}/{passage.questions.length}
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
                先回文中定位依据，再看选项。做完整轮后会自动记 1 轮读解。
              </Text>
            </View>

            <View style={[styles.sectionCard, styles.resultCard, shadows.card]}>
              <Text style={styles.questionMeta}>{questionMetaText}</Text>
              <Text style={styles.sectionTitle}>{question.prompt}</Text>

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
                        submitted &&
                          isSelected &&
                          !isCorrect &&
                          styles.choiceButtonWrong,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceLabel,
                          submitted && isAnswer && styles.choiceLabelCorrect,
                          submitted &&
                            isSelected &&
                            !isCorrect &&
                            styles.choiceLabelWrong,
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
                    <Text style={styles.analysisTitle}>证据位置</Text>
                    <Text style={styles.explanationBody}>{withKana(question.evidence)}</Text>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>核心判断</Text>
                    <Text style={styles.explanationBody}>{withKana(question.explanation)}</Text>
                  </View>

                  {!isCorrect && chosenAnswer !== null ? (
                    <View style={styles.analysisBlock}>
                      <Text style={styles.analysisTitle}>你这次为什么会错</Text>
                      <Text style={styles.explanationBody}>
                        {withKana(question.choiceInsights[chosenAnswer])}
                      </Text>
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
                                isChosenChoice &&
                                  !isCorrect &&
                                  styles.analysisItemLabelWrong,
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
                            <Text style={styles.analysisItemBody}>
                              {withKana(question.choiceInsights[index])}
                            </Text>
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
                  !submitted &&
                    selectedChoice === null &&
                    styles.primaryButtonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {submitted
                    ? currentIndex === passage.questions.length - 1
                      ? '完成并记录'
                      : '下一题'
                    : '提交答案'}
                </Text>
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
    flexWrap: 'wrap',
  },
  heroMetaCard: {
    minWidth: 140,
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
  passagesCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 22,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 22,
    gap: 16,
  },
  resultCard: {
    gap: 18,
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
  leadText: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  passageList: {
    gap: 12,
  },
  passageBlock: {
    gap: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.warmCard,
    padding: 16,
  },
  passageLabel: {
    color: colors.inkStrong,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  passageBody: {
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 24,
    fontFamily: fonts.body,
  },
  progressCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 22,
    gap: 14,
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
  questionMeta: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
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
    borderRadius: radii.md,
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
    borderRadius: radii.sm,
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
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryStat: {
    flex: 1,
    borderRadius: radii.md,
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
    gap: 12,
  },
  primaryButton: {
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






