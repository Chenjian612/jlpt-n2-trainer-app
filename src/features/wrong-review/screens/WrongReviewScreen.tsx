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
import {
  getPersonalizedTutorExplanation,
  getWrongAnswerExplanation,
} from '../../../services/aiCoachClient';
import type { PersonalizedTutorExplanation } from '../../../domain/models/personalizedTutor';
import { AppBackground } from '../../../components/common/AppBackground';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import { REVIEW_SOURCE_MODE, type ReviewModeId } from '../../../domain/models/training';
import type { WrongReviewDecision } from '../../../domain/models/trainingContent';
import {
  getModeSessionCountForDay,
  getPrioritizedWrongAnswersForMode,
  getWrongAnswerPriorityLabel,
} from '../../../domain/services/progressService';
import {
  buildTutorLearningContext,
  getCachedPersonalizedTutor,
  getTutorCacheKey,
  withTutorCacheMetadata,
} from '../../../domain/services/personalizedTutorService';
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
  const {
    state,
    todayKey,
    completeWrongReviewSession,
    saveAiExplanation,
    savePersonalizedTutor,
    saveTransferResult,
  } = useProgressStore();
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
  const [personalizedTutor, setPersonalizedTutor] =
    useState<PersonalizedTutorExplanation | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [transferSelectedChoice, setTransferSelectedChoice] = useState<number | null>(null);
  const [transferChecked, setTransferChecked] = useState(false);
  const [result, setResult] = useState<{
    reviewedCount: number;
    masteredCount: number;
    recordedSessionCount: number;
  } | null>(null);
  const finishRef = useRef(false);

  useEffect(() => {
    if (reviewItems.length === 0) return;
    const cached = state.aiExplanationCache?.[reviewItems[currentIndex]?.questionId ?? ''];
    setAiExplanation(cached ?? null);
    setAiLoading(false);
    setAiError(null);
    setPersonalizedTutor(null);
    setTutorLoading(false);
    setTutorError(null);
    setTransferSelectedChoice(null);
    setTransferChecked(false);
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

  const handleAiExplain = async (forceRefresh = false) => {
    if (aiLoading || (aiExplanation && !forceRefresh)) return;
    const cached = state.aiExplanationCache?.[item.questionId];
    if (cached && !forceRefresh) {
      setAiExplanation(cached);
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const fallbackWrongChoice = item.choices.findIndex((_, index) => index !== item.answer);
      const explanationChoice =
        item.lastUserChoice !== null && item.lastUserChoice !== item.answer
          ? item.lastUserChoice
          : selectedChoice !== null && selectedChoice !== item.answer
            ? selectedChoice
            : fallbackWrongChoice;
      const result = await getWrongAnswerExplanation({
        questionId: item.questionId,
        modeId: item.modeId,
        prompt: item.prompt,
        choices: item.choices,
        answer: item.answer,
        explanation: item.explanation,
        choiceInsights: item.choiceInsights,
        reviewNote: item.reviewNote,
        tags: item.tags,
        source: item.source,
        wrongCount: item.wrongCount,
        selectedChoice: explanationChoice,
      });
      saveAiExplanation(item.questionId, {
        ...result,
        generatedAt: new Date().toISOString(),
      });
      setAiExplanation(result);
      if (forceRefresh && result.generationMode !== 'ai_service') {
        setAiError('AI 服务暂时不可用，已保留本地知识库讲解。可以稍后重试。');
      }
    } catch (err) {
      if (__DEV__) console.warn('[AI Coach]', err);
      setAiError(
        err instanceof Error && err.message === 'KNOWLEDGE_NOT_FOUND'
          ? '本地知识库证据不足，暂时不能可靠解释这道题。'
          : '获取解释失败，请稍后重试',
      );
    } finally {
      setAiLoading(false);
    }
  };

  const getTutorSelectedChoice = (): number => {
    if (selectedChoice !== null && selectedChoice !== item.answer) return selectedChoice;
    if (item.lastUserChoice !== null && item.lastUserChoice !== item.answer) {
      return item.lastUserChoice;
    }
    return item.choices.findIndex((_, index) => index !== item.answer);
  };

  const handlePersonalizedTutor = async (forceRefresh = false) => {
    if (tutorLoading) return;
    const tutorSelectedChoice = getTutorSelectedChoice();
    const context = buildTutorLearningContext(state, item, tutorSelectedChoice);
    const cached = getCachedPersonalizedTutor(
      state,
      item.questionId,
      context.contextVersion,
    );
    if (cached && !forceRefresh) {
      setPersonalizedTutor(cached);
      setTutorError(null);
      return;
    }

    setTutorLoading(true);
    setTutorError(null);
    setTransferSelectedChoice(null);
    setTransferChecked(false);
    try {
      const result = await getPersonalizedTutorExplanation({
        questionId: item.questionId,
        modeId: item.modeId,
        prompt: item.prompt,
        choices: item.choices,
        answer: item.answer,
        explanation: item.explanation,
        choiceInsights: item.choiceInsights,
        reviewNote: item.reviewNote,
        tags: item.tags,
        source: item.source,
        wrongCount: item.wrongCount,
        selectedChoice: tutorSelectedChoice,
        weaknessType: context.weaknessType,
        recentSimilarWrongCount: context.recentSimilarWrongCount,
        recentSimilarPointIds: context.recentSimilarPointIds,
      });
      const cachedResult = withTutorCacheMetadata(result, context.contextVersion);
      savePersonalizedTutor(
        getTutorCacheKey(item.questionId, context.contextVersion),
        cachedResult,
      );
      setPersonalizedTutor(result);
    } catch (err) {
      if (__DEV__) console.warn('[AI Tutor]', err);
      setTutorError('个性化 AI 辅导暂时不可用，知识库事实讲解仍然有效。');
    } finally {
      setTutorLoading(false);
    }
  };

  const handleTransferCheck = () => {
    if (!personalizedTutor || transferSelectedChoice === null || transferChecked) return;
    const context = buildTutorLearningContext(state, item, getTutorSelectedChoice());
    setTransferChecked(true);
    saveTransferResult({
      questionId: item.questionId,
      contextVersion: context.contextVersion,
      selectedChoice: transferSelectedChoice,
      correct: transferSelectedChoice === personalizedTutor.transferQuestion.answer,
      answeredAt: new Date().toISOString(),
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
            <Text testID="wrong-review-result-title" style={styles.sectionTitle}>本轮回收完成</Text>
            <Text style={styles.sectionBody}>
              本轮结果已经写入今日进度。你共处理 {result.reviewedCount} 题，其中 {result.masteredCount} 题答对升格（答对 4 轮后毕业移出队列）；今天这个模式累计完成 {result.recordedSessionCount} 轮。
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
                <Text style={styles.priorityMeta}>Box {item.leitnerBox}/4 · 已错 {item.wrongCount} 次</Text>
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
                        hasCheckedAnswer && isCorrect && styles.choiceButtonCorrect,
                        isLastWrong && !isCorrect && styles.choiceButtonWrong,
                        hasCheckedAnswer && isSelected && !isCorrect && styles.choiceButtonWrong,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceLabel,
                          isSelected && styles.choiceLabelSelected,
                          hasCheckedAnswer && isCorrect && styles.choiceLabelCorrect,
                          isLastWrong && !isCorrect && styles.choiceLabelWrong,
                          hasCheckedAnswer && isSelected && !isCorrect && styles.choiceLabelWrong,
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
                      <View style={styles.aiTitleRow}>
                        <Text style={styles.aiBlockTitle}>RAG 错题讲解</Text>
                        {aiExplanation.generationMode !== 'ai_service' ? (
                          <Text style={styles.aiModeBadge}>
                            {aiExplanation.generationMode === 'local_knowledge'
                              ? '本地知识库'
                              : '历史缓存'}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.aiRow}>
                        <Text style={styles.aiRowLabel}>本题考点</Text>
                        <Text style={styles.aiRowBody}>{aiExplanation.testedPoint}</Text>
                      </View>
                      <View style={styles.aiRow}>
                        <Text style={styles.aiRowLabel}>错误模式</Text>
                        <Text style={styles.aiRowBody}>{aiExplanation.mistakePattern}</Text>
                      </View>
                      {aiExplanation.whyCorrect ? (
                        <View style={styles.aiRow}>
                          <Text style={styles.aiRowLabel}>正确答案依据</Text>
                          <Text style={styles.aiRowBody}>{aiExplanation.whyCorrect}</Text>
                        </View>
                      ) : null}
                      <View style={styles.aiRow}>
                        <Text style={styles.aiRowLabel}>你的选择为什么不对</Text>
                        <Text style={styles.aiRowBody}>{aiExplanation.whyUserWrong}</Text>
                      </View>
                      <View style={styles.aiRow}>
                        <Text style={styles.aiRowLabel}>下次注意</Text>
                        <Text style={styles.aiRowBody}>{aiExplanation.watchNextTime}</Text>
                      </View>
                      {aiExplanation.sources.length > 0 ? (
                        <View style={styles.aiSources}>
                          <Text style={styles.aiSourcesTitle}>检索来源</Text>
                          {aiExplanation.sources.map((source) => (
                            <View key={source.id} style={styles.aiSourceItem}>
                              <Text style={styles.aiSourceTitle}>{source.title}</Text>
                              <Text style={styles.aiRowBody}>{source.snippet}</Text>
                              <Text style={styles.aiSourceMeta}>来源：{source.sourceLabel}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {aiExplanation.generationMode !== 'ai_service' ? (
                        <Pressable
                          style={styles.aiRefreshButton}
                          onPress={() => { void handleAiExplain(true); }}
                          disabled={aiLoading}
                        >
                          {aiLoading ? (
                            <ActivityIndicator color="#3730A3" />
                          ) : (
                            <Text style={styles.aiRefreshButtonText}>使用 AI 重新讲解</Text>
                          )}
                        </Pressable>
                      ) : null}
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
                        <Text style={styles.aiButtonText}>查看知识库讲解</Text>
                      )}
                    </Pressable>
                  )}
                  {aiError ? (
                    <Text style={styles.aiError}>{aiError}</Text>
                  ) : null}

                  {personalizedTutor ? (
                    <View style={styles.tutorBlock}>
                      <View style={styles.aiTitleRow}>
                        <Text style={styles.tutorBlockTitle}>AI 个性化辅导</Text>
                        <Text style={styles.tutorModeBadge}>智能辅导</Text>
                      </View>

                      <View style={styles.tutorEvidenceRow}>
                        <View style={styles.tutorEvidenceItem}>
                          <Text style={styles.tutorEvidenceLabel}>本次误选</Text>
                          <Text style={styles.tutorEvidenceValue}>
                            {personalizedTutor.personalizationEvidence.selectedChoice}
                          </Text>
                        </View>
                        <View style={styles.tutorEvidenceItem}>
                          <Text style={styles.tutorEvidenceLabel}>累计错误</Text>
                          <Text style={styles.tutorEvidenceValue}>
                            {personalizedTutor.personalizationEvidence.wrongCount} 次
                          </Text>
                        </View>
                        <View style={styles.tutorEvidenceItem}>
                          <Text style={styles.tutorEvidenceLabel}>同类错题</Text>
                          <Text style={styles.tutorEvidenceValue}>
                            {personalizedTutor.personalizationEvidence.recentSimilarWrongCount} 题
                          </Text>
                        </View>
                      </View>

                      <View style={styles.tutorSection}>
                        <Text style={styles.tutorSectionLabel}>你的错误类型</Text>
                        <Text style={styles.tutorSectionTitle}>
                          {personalizedTutor.personalizationEvidence.weaknessType}
                        </Text>
                        <Text style={styles.tutorSectionBody}>
                          {personalizedTutor.diagnosisSummary}
                        </Text>
                      </View>

                      <View style={styles.tutorSection}>
                        <Text style={styles.tutorSectionLabel}>为什么你会选它</Text>
                        <Text style={styles.tutorSectionBody}>{personalizedTutor.whyYouChoseIt}</Text>
                      </View>

                      <View style={styles.tutorSection}>
                        <Text style={styles.tutorSectionLabel}>下次照着走的三步判断</Text>
                        {personalizedTutor.reasoningSteps.map((step, index) => (
                          <View key={`${index}-${step}`} style={styles.tutorStepRow}>
                            <Text style={styles.tutorStepNumber}>{index + 1}</Text>
                            <Text style={styles.tutorStepBody}>{step}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.tutorComparison}>
                        <Text style={styles.tutorSectionLabel}>易混点对比</Text>
                        <Text style={styles.tutorComparisonTerms}>
                          {personalizedTutor.confusionComparison.correctPoint} /{' '}
                          {personalizedTutor.confusionComparison.confusedPoint}
                        </Text>
                        <Text style={styles.tutorSectionBody}>
                          {personalizedTutor.confusionComparison.decisiveDifference}
                        </Text>
                      </View>

                      <View style={styles.tutorSection}>
                        <Text style={styles.tutorSectionLabel}>针对你的复习动作</Text>
                        {personalizedTutor.reviewPlan.map((plan) => (
                          <View key={`${plan.timing}-${plan.action}`} style={styles.tutorPlanRow}>
                            <Text style={styles.tutorPlanTiming}>
                              {plan.timing === 'now'
                                ? '现在'
                                : plan.timing === 'tomorrow'
                                  ? '明天'
                                  : '三天后'}
                            </Text>
                            <Text style={styles.tutorStepBody}>{plan.action}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.transferBlock}>
                        <Text style={styles.transferEyebrow}>立即验证</Text>
                        <Text style={styles.transferTitle}>
                          {personalizedTutor.transferQuestion.prompt}
                        </Text>
                        <View style={styles.transferChoiceList}>
                          {personalizedTutor.transferQuestion.choices.map((choice, index) => {
                            const selected = transferSelectedChoice === index;
                            const correct = personalizedTutor.transferQuestion.answer === index;
                            return (
                              <Pressable
                                key={`${index}-${choice}`}
                                testID={`tutor-transfer-choice-${index}`}
                                disabled={transferChecked}
                                onPress={() => setTransferSelectedChoice(index)}
                                style={[
                                  styles.transferChoice,
                                  selected && styles.transferChoiceSelected,
                                  transferChecked && correct && styles.transferChoiceCorrect,
                                  transferChecked && selected && !correct && styles.transferChoiceWrong,
                                ]}
                              >
                                <Text style={styles.transferChoiceText}>{index + 1}. {choice}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <Pressable
                          testID="tutor-transfer-submit"
                          onPress={handleTransferCheck}
                          disabled={transferSelectedChoice === null || transferChecked}
                          style={[
                            styles.transferSubmit,
                            (transferSelectedChoice === null || transferChecked) && styles.disabledButton,
                          ]}
                        >
                          <Text style={styles.aiButtonText}>
                            {transferChecked ? '已完成迁移验证' : '提交迁移题'}
                          </Text>
                        </Pressable>
                        {transferChecked ? (
                          <View
                            style={
                              transferSelectedChoice === personalizedTutor.transferQuestion.answer
                                ? styles.transferResultSuccess
                                : styles.transferResultWarning
                            }
                          >
                            <Text style={styles.transferResultTitle}>
                              {transferSelectedChoice === personalizedTutor.transferQuestion.answer
                                ? '迁移成功：你已经能在新语境中应用这个判断。'
                                : '还未迁移成功：按三步判断路径再走一遍。'}
                            </Text>
                            <Text style={styles.tutorSectionBody}>
                              {personalizedTutor.transferQuestion.explanation}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Pressable
                        style={styles.tutorRefreshButton}
                        onPress={() => { void handlePersonalizedTutor(true); }}
                        disabled={tutorLoading}
                      >
                        <Text style={styles.tutorRefreshButtonText}>根据当前记录重新生成</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      testID="personalized-tutor-button"
                      style={styles.tutorButton}
                      onPress={() => { void handlePersonalizedTutor(); }}
                      disabled={tutorLoading}
                    >
                      {tutorLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.aiButtonText}>生成个性化 AI 辅导</Text>
                      )}
                    </Pressable>
                  )}
                  {tutorError ? <Text style={styles.aiError}>{tutorError}</Text> : null}
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
