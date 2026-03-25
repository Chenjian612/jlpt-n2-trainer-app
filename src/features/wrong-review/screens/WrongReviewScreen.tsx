import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { APP_CONFIG } from '../../../config/constants';
import { useProgressStore } from '../../../app/providers/ProgressProvider';
import type { WrongAnswerExplanation } from '../../../services/aiCoachClient';
import { getWrongAnswerExplanation } from '../../../services/aiCoachClient';
import { AppBackground } from '../../../components/common/AppBackground';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import { REVIEW_SOURCE_MODE, type ReviewModeId } from '../../../domain/models/training';
import type { WrongReviewDecision } from '../../../domain/models/trainingContent';
import {
  getModeSessionCountForDay,
  getPrioritizedWrongAnswersForMode,
  getWrongAnswerPriorityLabel,
} from '../../../domain/services/progressService';
import { styles } from './wrongReviewStyles';

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
  const { state, todayKey, completeWrongReviewSession, saveAiExplanation } =
    useProgressStore();
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
  const [reviewItems] = useState(() => allBacklog.slice(0, APP_CONFIG.REVIEW_BATCH_SIZE));
  const initialSessionCount = getModeSessionCountForDay(state, todayKey, mode.id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [hasCheckedAnswer, setHasCheckedAnswer] = useState(false);
  const [decisions, setDecisions] = useState<WrongReviewDecision[]>([]);
  const [aiExplanation, setAiExplanation] = useState<WrongAnswerExplanation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    reviewedCount: number;
    masteredCount: number;
    recordedSessionCount: number;
  } | null>(null);
  const finishRef = useRef(false);

  useEffect(() => {
    if (reviewItems.length === 0) return;
    const cached = state.aiExplanationCache[reviewItems[currentIndex]?.questionId ?? ''];
    setAiExplanation(cached ?? null);
    setAiLoading(false);
    setAiError(null);
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const answeredCorrectly = selectedChoice === item.answer;

  const handleCheckAnswer = () => {
    if (selectedChoice === null || hasCheckedAnswer) {
      return;
    }
    setHasCheckedAnswer(true);
  };

  const handleDecision = (mastered: boolean) => {
    if (finishRef.current || selectedChoice === null || !hasCheckedAnswer) {
      return;
    }
    const nextDecisions = [
      ...decisions,
      { questionId: item.questionId, selectedChoice, mastered },
    ];

    if (currentIndex < reviewItems.length - 1) {
      setDecisions(nextDecisions);
      setCurrentIndex((current) => current + 1);
      setSelectedChoice(null);
      setHasCheckedAnswer(false);
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

  const handleAiExplain = async () => {
    if (aiLoading || aiExplanation) return;
    const cached = state.aiExplanationCache[item.questionId];
    if (cached) {
      setAiExplanation(cached);
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await getWrongAnswerExplanation({
        question: item.prompt,
        choices: item.choices,
        selectedChoice: item.lastUserChoice ?? selectedChoice ?? 0,
        correctChoice: item.answer,
        tags: item.tags,
        modeId: item.modeId,
        wrongCount: item.wrongCount,
      });
      saveAiExplanation(item.questionId, {
        ...result,
        generatedAt: new Date().toISOString(),
      });
      setAiExplanation(result);
    } catch (err) {
      if (__DEV__) console.warn('[AI Coach]', err);
      setAiError('获取解释失败，请稍后重试');
    } finally {
      setAiLoading(false);
    }
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
            <Text testID="wrong-review-result-title" style={styles.sectionTitle}>本轮回收完成</Text>
            <Text style={styles.sectionBody}>
              本轮结果已经写入今日进度。你共处理 {result.reviewedCount} 题，其中重新作答正确并移出队列 {result.masteredCount} 题；今天这个模式累计完成 {result.recordedSessionCount} 轮。
            </Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>下一步建议</Text>
              <Text style={styles.summaryBody}>
                {result.masteredCount < result.reviewedCount
                  ? '还没掌握的题会继续留在队列里，下一次优先回收同类错误。'
                  : '这一轮处理的题都通过了重新作答验证，接下来适合回到真实刷题继续验证。'}
              </Text>
            </View>
            <Pressable
              testID="wrong-review-back-dashboard"
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
                这是你最近反复出错的一题。先重新作答，再根据本次结果决定是否移出回收队列。
              </Text>

              <View style={styles.choiceList}>
                {item.choices.map((choice, index) => {
                  const isCorrect = index === item.answer;
                  const isLastWrong = index === item.lastUserChoice;
                  const isSelected = index === selectedChoice;

                  return (
                    <Pressable
                      testID={`wrong-review-choice-${index}`}
                      key={choice}
                      onPress={() => {
                        if (hasCheckedAnswer) return;
                        setSelectedChoice(index);
                      }}
                      disabled={hasCheckedAnswer}
                      style={[
                        styles.choiceButton,
                        isSelected && styles.choiceButtonSelected,
                        isCorrect && styles.choiceButtonCorrect,
                        isLastWrong && !isCorrect && styles.choiceButtonWrong,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceLabel,
                          isSelected && styles.choiceLabelSelected,
                          isCorrect && styles.choiceLabelCorrect,
                          isLastWrong && !isCorrect && styles.choiceLabelWrong,
                        ]}
                      >
                        {index + 1}. {choice}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                testID="wrong-review-submit-answer"
                onPress={handleCheckAnswer}
                disabled={selectedChoice === null || hasCheckedAnswer}
                style={[
                  styles.primaryButton,
                  { backgroundColor: mode.accent },
                  (selectedChoice === null || hasCheckedAnswer) && styles.disabledButton,
                ]}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    (selectedChoice === null || hasCheckedAnswer) && styles.disabledButtonText,
                  ]}
                >
                  {hasCheckedAnswer ? '已完成重新作答' : '提交本次答案'}
                </Text>
              </Pressable>

              {hasCheckedAnswer ? (
                <View
                  style={[
                    styles.checkResultCard,
                    answeredCorrectly ? styles.checkResultCardSuccess : styles.checkResultCardWarning,
                  ]}
                >
                  <Text
                    style={[
                      styles.checkResultTitle,
                      answeredCorrectly ? styles.checkResultTitleSuccess : styles.checkResultTitleWarning,
                    ]}
                  >
                    {answeredCorrectly ? '这次答对了，可以考虑移出队列。' : '这次仍然答错，建议继续保留在队列里。'}
                  </Text>
                  <Text style={styles.checkResultBody}>
                    {answeredCorrectly
                      ? '下面会展示解析和误选原因。确认逻辑真正吃透后，再决定是否把这题移出。'
                      : `本次选择了第 ${(selectedChoice ?? 0) + 1} 项，正确答案是第 ${item.answer + 1} 项。先看解析，再继续保留这题。`}
                  </Text>
                </View>
              ) : null}

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

              {hasCheckedAnswer ? (
                <>
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
                        const isCurrentWrong = index === selectedChoice && !isCorrect;

                        return (
                          <View key={choice} style={styles.analysisItem}>
                            <Text
                              style={[
                                styles.analysisItemLabel,
                                isCorrect && styles.analysisItemLabelCorrect,
                                (isLastWrong || isCurrentWrong) && styles.analysisItemLabelWrong,
                              ]}
                            >
                              {isCorrect
                                ? `正确项 ${index + 1}. ${choice}`
                                : isCurrentWrong
                                  ? `本次误选 ${index + 1}. ${choice}`
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

                  {aiExplanation ? (
                    <View style={styles.aiBlock}>
                      <Text style={styles.aiBlockTitle}>AI 错题分析</Text>
                      <View style={styles.aiRow}>
                        <Text style={styles.aiRowLabel}>错误模式</Text>
                        <Text style={styles.aiRowBody}>{aiExplanation.mistakePattern}</Text>
                      </View>
                      <View style={styles.aiRow}>
                        <Text style={styles.aiRowLabel}>干扰项为何有效</Text>
                        <Text style={styles.aiRowBody}>{aiExplanation.whyDistractorFooled}</Text>
                      </View>
                      <View style={styles.aiRow}>
                        <Text style={styles.aiRowLabel}>下次注意</Text>
                        <Text style={styles.aiRowBody}>{aiExplanation.watchNextTime}</Text>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.aiButton}
                      onPress={() => { void handleAiExplain(); }}
                      disabled={aiLoading}
                    >
                      {aiLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.aiButtonText}>为什么我错了？</Text>
                      )}
                    </Pressable>
                  )}
                  {aiError ? (
                    <Text style={styles.aiError}>{aiError}</Text>
                  ) : null}
                </>
              ) : null}
            </View>

            {hasCheckedAnswer ? (
              <View style={styles.footerActions}>
                <Pressable
                  testID="wrong-review-keep-in-queue"
                  onPress={() => handleDecision(false)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>
                    {answeredCorrectly ? '这次答对了，但先保留队列' : '继续保留在回收队列'}
                  </Text>
                </Pressable>
                {answeredCorrectly ? (
                  <Pressable
                    testID="wrong-review-resolve"
                    onPress={() => handleDecision(true)}
                    style={[styles.primaryButton, { backgroundColor: mode.accent }]}
                  >
                    <Text style={styles.primaryButtonText}>重新答对，移出队列</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </AppBackground>
  );
}

