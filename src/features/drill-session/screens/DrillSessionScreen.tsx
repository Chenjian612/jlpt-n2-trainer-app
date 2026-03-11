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
import { getDrillQuestionsByMode } from '../../../data/seed/drillQuestions';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import type { DrillModeId } from '../../../domain/models/training';
import type { WrongAnswerDraft } from '../../../domain/models/trainingContent';
import { getModeSessionCountForDay } from '../../../domain/services/progressService';
import { colors, fonts, radii } from '../../../theme/tokens';

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
  const question = questions[currentIndex];
  const chosenAnswer = submitted ? answers[question.id] ?? selectedChoice : selectedChoice;
  const isCorrect = chosenAnswer === question.answer;
  const progressValue = (currentIndex + 1) / questions.length;

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
    recordDrillSession(modeId, wrongAnswerDrafts);
    setResult({
      correctCount: questions.length - wrongAnswerDrafts.length,
      wrongCount: wrongAnswerDrafts.length,
      recordedSessionCount: initialSessionCount + 1,
    });
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
          <Text style={styles.heroBody}>
            做完整轮题目后会自动记 1 轮训练；答错的题会自动进入本地错题回收队列。
          </Text>
        </View>

        {result ? (
          <View style={styles.sectionCard}>
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
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>下一步建议</Text>
              <Text style={styles.summaryBody}>
                {result.wrongCount > 0
                  ? '今天的错题已经进入回收队列，接下来优先去对应的错题回收模式做一轮。'
                  : '本轮没有新增错题，可以直接回到首页继续今天的安排。'}
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
                中途退出不会写入记录；只有做完整轮，训练记录和错题才会一起保存。
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.questionMeta}>
                来源：{question.source} · {question.tags.join(' / ')}
              </Text>
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
                    {isCorrect ? '回答正确' : `正确答案：${question.choices[question.answer]}`}
                  </Text>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>核心判断</Text>
                    <Text style={styles.explanationBody}>{question.explanation}</Text>
                  </View>

                  {!isCorrect && chosenAnswer !== null ? (
                    <View style={styles.analysisBlock}>
                      <Text style={styles.analysisTitle}>你这次为什么会错</Text>
                      <Text style={styles.explanationBody}>
                        {question.choiceInsights[chosenAnswer]}
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
                              {isAnswerChoice
                                ? `正确项 ${index + 1}. ${choice}`
                                : isChosenChoice && !isCorrect
                                  ? `你选了 ${index + 1}. ${choice}`
                                  : `${index + 1}. ${choice}`}
                            </Text>
                            <Text style={styles.analysisItemBody}>
                              {question.choiceInsights[index]}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>复盘提醒</Text>
                    <Text style={styles.explanationBody}>{question.reviewNote}</Text>
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
                    ? currentIndex === questions.length - 1
                      ? '完成并自动记录'
                      : '进入下一题'
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


