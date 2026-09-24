import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import {
  type GestureResponderEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { useProgressStore } from '../../../app/providers/ProgressProvider';
import { AppBackground } from '../../../components/common/AppBackground';
import { PersonalizedTutorPanel } from '../../../components/common/PersonalizedTutorPanel';
import { getListeningCasesByMode } from '../../../data/seed/listeningCases';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import type { ListeningModeId } from '../../../domain/models/training';
import type { PersonalizedTutorExplanation } from '../../../domain/models/personalizedTutor';
import { getPersonalizedTutorExplanation } from '../../../services/aiCoachClient';
import {
  buildTutorLearningContext,
  getCachedPersonalizedTutor,
  getTutorCacheKey,
  withTutorCacheMetadata,
} from '../../../domain/services/personalizedTutorService';
import { getModeSessionCountForDay } from '../../../domain/services/progressService';
import { prioritizeListeningReviewCases } from '../../../domain/services/reviewScheduleService';
import { inferListeningWeaknessErrorTypes, WEAKNESS_ERROR_META } from '../../../domain/services/wrongAnswerClassifier';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';
import { withKana } from '../../../utils/withKana';

type ListeningSessionScreenProps = {
  modeId: ListeningModeId;
  onExit: () => void;
  onBackToDetail: () => void;
  onBackToDashboard: () => void;
};

const PLAYBACK_RATES = [0.9, 1, 1.15] as const;

const formatSeconds = (value: number): string => {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const totalSeconds = Math.floor(safeValue);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');

  return `${minutes}:${seconds}`;
};

const formatRateLabel = (value: (typeof PLAYBACK_RATES)[number]): string =>
  `${value.toFixed(2).replace(/\.00$/, '.0')}x`;

export function ListeningSessionScreen({
  modeId,
  onExit,
  onBackToDetail,
  onBackToDashboard,
}: ListeningSessionScreenProps) {
  const {
    state,
    todayKey,
    recordSession,
    savePersonalizedTutor,
    saveTransferResult,
  } = useProgressStore();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1040;
  const mode = getTrainingModeById(modeId);
  const [cases] = useState(() => prioritizeListeningReviewCases(getListeningCasesByMode(modeId), state));

  if (!mode || cases.length === 0) {
    return (
      <AppBackground>
        <View style={styles.missingState}>
          <Text style={styles.missingTitle}>听力材料暂时不可用</Text>
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
  const [playbackRate, setPlaybackRate] =
    useState<(typeof PLAYBACK_RATES)[number]>(1);
  const [audioTrackWidth, setAudioTrackWidth] = useState(0);
  const [listenCounts, setListenCounts] = useState<Record<string, number>>({});
  const [tipsShownCases, setTipsShownCases] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [personalizedTutor, setPersonalizedTutor] =
    useState<PersonalizedTutorExplanation | null>(null);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [tutorError, setTutorError] = useState<string | null>(null);
  const [transferSelectedChoice, setTransferSelectedChoice] = useState<number | null>(null);
  const [transferChecked, setTransferChecked] = useState(false);
  const [result, setResult] = useState<{
    correctCount: number;
    wrongCount: number;
    recordedSessionCount: number;
    majorErrorTypeLabel?: string;
    majorErrorTypeSummary?: string;
  } | null>(null);
  const finishedRef = useRef(false);

  const listeningItems = useMemo(
    () =>
      cases.flatMap((caseData) =>
        caseData.questions.map((question, caseQuestionIndex) => ({
          caseData,
          question,
          caseQuestionIndex,
        })),
      ),
    [cases],
  );
  const currentItem = listeningItems[currentIndex];
  const currentCase = currentItem.caseData;
  const question = currentItem.question;
  const currentCaseQuestionIndex = currentItem.caseQuestionIndex;
  const currentCaseIndex = cases.findIndex((caseData) => caseData.id === currentCase.id) + 1;
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const audioStatus = useAudioPlayerStatus(player);

  const chosenAnswer = submitted
    ? answers[question.id] ?? selectedChoice
    : selectedChoice;
  const isCorrect = chosenAnswer === question.answer;
  const questionErrorTypes = inferListeningWeaknessErrorTypes(question.tags);
  const existingWeakness = state.weaknessSignals.find(
    (item) => item.questionId === question.id,
  );
  const tutorWrongCount = (existingWeakness?.wrongCount ?? 0) + 1;
  const progressValue = (currentIndex + 1) / listeningItems.length;
  const listenCount = listenCounts[currentCase.id] ?? 0;
  const hasPlayedCurrent = listenCount > 0;
  const playbackProgress =
    audioStatus.duration > 0
      ? Math.min(audioStatus.currentTime / audioStatus.duration, 1)
      : 0;
  const shouldRestartPlayback =
    hasPlayedCurrent &&
    !audioStatus.playing &&
    (audioStatus.currentTime < 0.05 ||
      (audioStatus.duration > 0 &&
        audioStatus.currentTime >= audioStatus.duration - 0.25));
  const displayDuration =
    audioStatus.duration > 0
      ? formatSeconds(audioStatus.duration)
      : currentCase.audioDurationLabel;
  const isInstantReply = question.tags?.includes('即時応答') ?? false;
  const submitDisabled = selectedChoice === null || (!isInstantReply && !hasPlayedCurrent);
  const missionText = isInstantReply
    ? submitted
      ? isCorrect
        ? '语感判断对了，回想一下为什么其他选项不自然。'
        : '注意语气和语境，再读一遍刺激句确认说话人的意图。'
      : '读刺激句，判断说话人的意图，选出最自然的回应。'
    : submitted
      ? isCorrect
        ? '这题判断方向对了，下一步把改变结论的那一句再复述一遍。'
        : '先别记答案，先确认是哪一句把结论改写掉了。'
      : hasPlayedCurrent
        ? '现在已经可以作答，重点抓转折后的决定信息。'
        : '先听出场景和任务，再去辨认真正决定答案的那一句。';
  const questionMetaText = `第 ${currentIndex + 1} 题 · 本材料第 ${currentCaseQuestionIndex + 1} 题`;
  const wrongQuestionLabels = useMemo(
    () =>
      listeningItems.reduce<string[]>((labels, item, index) => {
        const answer = answers[item.question.id];

        if (answer !== undefined && answer !== item.question.answer) {
          labels.push(`第 ${index + 1} 题`);
        }

        return labels;
      }, []),
    [answers, listeningItems],
  );
  const listeningWeaknessSignals = useMemo(
    () =>
      listeningItems
        .filter((item) => answers[item.question.id] !== undefined)
        .map((item) => ({
          questionId: item.question.id,
          modeId,
          prompt: item.question.prompt,
          source: item.caseData.source,
          tags: item.question.tags,
          errorTypes: inferListeningWeaknessErrorTypes(item.question.tags),
          wasCorrect: answers[item.question.id] === item.question.answer,
        })),
    [answers, listeningItems, modeId],
  );

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    player.pause();
    player.replace(currentCase.audioAsset);

    return () => {
      player.pause();
    };
  }, [currentCase.audioAsset, player]);

  useEffect(() => {
    player.setPlaybackRate(playbackRate, 'medium');
  }, [playbackRate, player]);

  const markListenAttempt = () => {
    setListenCounts((current) => ({
      ...current,
      [currentCase.id]: (current[currentCase.id] ?? 0) + 1,
    }));
  };

  const handlePlayPause = () => {
    if (!audioStatus.isLoaded) {
      if (!hasPlayedCurrent) {
        markListenAttempt();
      }
      player.replace(currentCase.audioAsset);
      player.play();
      return;
    }

    if (audioStatus.playing) {
      player.pause();
      return;
    }

    if (!hasPlayedCurrent) {
      markListenAttempt();
    }

    if (shouldRestartPlayback) {
      void player.seekTo(0).then(() => {
        player.play();
      });
      return;
    }

    player.play();
  };

  const seekFromTrackEvent = (event: GestureResponderEvent) => {
    if (!audioStatus.isLoaded || audioStatus.duration <= 0 || audioTrackWidth <= 0) {
      return;
    }

    const fraction = Math.min(
      Math.max(event.nativeEvent.locationX / audioTrackWidth, 0),
      1,
    );
    void player.seekTo(fraction * audioStatus.duration);
  };

  const seekBy = (seconds: number) => {
    if (!audioStatus.isLoaded || audioStatus.duration <= 0) {
      return;
    }

    const nextTime = Math.min(
      Math.max(audioStatus.currentTime + seconds, 0),
      audioStatus.duration,
    );
    void player.seekTo(nextTime);
  };

  const handleReplay = async () => {
    if (!audioStatus.isLoaded) {
      return;
    }

    markListenAttempt();
    await player.seekTo(0);
    player.play();
  };

  const handleSubmit = () => {
    if (selectedChoice === null || submitted || submitDisabled) {
      return;
    }

    if (audioStatus.playing) {
      player.pause();
    }

    setAnswers((current) => ({
      ...current,
      [question.id]: selectedChoice,
    }));
    setSubmitted(true);
  };

  const resetTutor = () => {
    setPersonalizedTutor(null);
    setTutorError(null);
    setTutorLoading(false);
    setTransferSelectedChoice(null);
    setTransferChecked(false);
  };

  const buildCurrentTutorContext = (choice: number) =>
    buildTutorLearningContext(
      state,
      {
        questionId: question.id,
        modeId,
        tags: question.tags,
        wrongCount: tutorWrongCount,
        errorTypes: questionErrorTypes,
        active: true,
      },
      choice,
    );

  const handlePersonalizedTutor = async (forceRefresh = false) => {
    if (tutorLoading || chosenAnswer === null || chosenAnswer === question.answer) return;
    if (audioStatus.playing) player.pause();
    const context = buildCurrentTutorContext(chosenAnswer);
    const cached = getCachedPersonalizedTutor(state, question.id, context.contextVersion);
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
        questionId: question.id,
        modeId,
        prompt: question.prompt,
        choices: question.choices,
        answer: question.answer,
        explanation: question.explanation,
        choiceInsights: question.choiceInsights,
        reviewNote: question.reviewNote,
        tags: question.tags,
        source: currentCase.source,
        wrongCount: tutorWrongCount,
        selectedChoice: chosenAnswer,
        weaknessType: context.weaknessType,
        recentSimilarWrongCount: context.recentSimilarWrongCount,
        recentSimilarPointIds: context.recentSimilarPointIds,
        listeningEvidence: {
          testedPoint: WEAKNESS_ERROR_META[questionErrorTypes[0]].label,
          basisLine: question.basisLine,
          keySignal: question.keySignal,
          trapPoint: question.trapPoint,
        },
      });
      savePersonalizedTutor(
        getTutorCacheKey(question.id, context.contextVersion),
        withTutorCacheMetadata(result, context.contextVersion),
      );
      setPersonalizedTutor(result);
    } catch (error) {
      if (__DEV__) console.warn('[Listening AI Tutor]', error);
      setTutorError('听力 AI 辅导暂时不可用，原文依据和固定解析仍然有效。');
    } finally {
      setTutorLoading(false);
    }
  };

  const handleTransferCheck = () => {
    if (
      !personalizedTutor ||
      transferSelectedChoice === null ||
      transferChecked ||
      chosenAnswer === null
    ) return;
    const context = buildCurrentTutorContext(chosenAnswer);
    setTransferChecked(true);
    saveTransferResult({
      questionId: question.id,
      contextVersion: context.contextVersion,
      selectedChoice: transferSelectedChoice,
      correct: transferSelectedChoice === personalizedTutor.transferQuestion.answer,
      answeredAt: new Date().toISOString(),
    });
  };

  const handleNext = () => {
    if (!submitted) {
      return;
    }

    if (currentIndex < listeningItems.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextQuestion = listeningItems[nextIndex].question;
      const nextAnswer = answers[nextQuestion.id];

      setCurrentIndex(nextIndex);
      setSelectedChoice(nextAnswer ?? null);
      setSubmitted(nextAnswer !== undefined);
      resetTutor();
      return;
    }

    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    const wrongCount = wrongQuestionLabels.length;

    const wrongSignals = listeningWeaknessSignals.filter((s) => !s.wasCorrect);
    let majorErrorTypeLabel: string | undefined;
    let majorErrorTypeSummary: string | undefined;

    if (wrongSignals.length > 0) {
      const wrongErrorTypes = wrongSignals.flatMap((s) => s.errorTypes);
      const typeCounts = wrongErrorTypes.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const majorType = Object.keys(typeCounts).reduce((a, b) =>
        typeCounts[a] > typeCounts[b] ? a : b,
      ) as keyof typeof WEAKNESS_ERROR_META;

      majorErrorTypeLabel = WEAKNESS_ERROR_META[majorType].label;
      majorErrorTypeSummary = WEAKNESS_ERROR_META[majorType].summary;
    }

    recordSession(modeId, 'drill', listeningWeaknessSignals);
    setResult({
      correctCount: listeningItems.length - wrongCount,
      wrongCount,
      recordedSessionCount: initialSessionCount + 1,
      majorErrorTypeLabel,
      majorErrorTypeSummary,
    });
  };

  const handlePrevious = () => {
    if (currentIndex === 0) {
      return;
    }

    player.pause();
    const previousIndex = currentIndex - 1;
    const previousQuestion = listeningItems[previousIndex].question;
    const previousAnswer = answers[previousQuestion.id];

    setCurrentIndex(previousIndex);
    setSelectedChoice(previousAnswer ?? null);
    setSubmitted(previousAnswer !== undefined);
    resetTutor();
  };

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={[styles.content, isWideLayout && styles.contentWide]}>
        <View style={styles.header}>
          <Pressable onPress={onExit} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>退出听力</Text>
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
            <Text style={styles.heroSource}>{currentCase.source}</Text>
          </View>

          <Text style={styles.heroTitle}>{mode.title}</Text>
          <Text style={styles.heroBody}>
            按照正式节奏先听再答。每道题都使用与原文对应的日语音频；提交后可查看日语原文、中文翻译、依据句和陷阱分析。
          </Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{listeningItems.length}</Text>
              <Text style={styles.heroMetaLabel}>本轮题数</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{displayDuration}</Text>
              <Text style={styles.heroMetaLabel}>当前音频</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{listenCount}</Text>
              <Text style={styles.heroMetaLabel}>已听次数</Text>
            </View>
          </View>
        </View>

        {result ? (
          <View style={[styles.sectionCard, styles.resultCard, shadows.card]}>
            <Text testID="listening-result-title" style={styles.sectionTitle}>本轮听力完成</Text>
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
                  {Math.round((result.correctCount / listeningItems.length) * 100)}%
                </Text>
                <Text style={styles.summaryLabel}>正确率</Text>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {result.majorErrorTypeLabel ? `主要漏听类型：${result.majorErrorTypeLabel}` : '下一步建议'}
              </Text>
              <Text style={styles.summaryBody}>
                {result.majorErrorTypeSummary
                  ? `${result.majorErrorTypeSummary}\n优先回看 ${wrongQuestionLabels.join(' / ')} 的依据句，重点区分题干问的是“最终决定”“主要动作”还是“最重视的点”。`
                  : result.wrongCount > 0
                    ? `优先回看 ${wrongQuestionLabels.join(' / ')} 的依据句，重点区分题干问的是“最终决定”“主要动作”还是“最重视的点”。`
                    : '这轮没有答错题，接下来重点复述每题的依据句和陷阱点，不要只记答案。'}
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
        ) : !tipsShownCases.has(currentCase.id) && currentCaseQuestionIndex === 0 ? (
          <View style={[styles.tipsCard, shadows.card]}>
            <Text style={styles.tipsEyebrow}>本题型解题要领</Text>
            <Text style={styles.sectionTitle}>{currentCase.title}</Text>
            <Text style={styles.sceneText}>场景：{currentCase.scene}</Text>
            <Text style={styles.taskText}>任务：{currentCase.task}</Text>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>核心陷阱</Text>
              <Text style={styles.noteBody}>{currentCase.note}</Text>
            </View>

            <View style={styles.checklistCard}>
              <Text style={styles.noteTitle}>听题三要点</Text>
              <View style={styles.checklistList}>
                {currentCase.listenChecklist.map((item, i) => (
                  <View key={item} style={styles.checklistItem}>
                    <Text style={styles.checklistIndex}>{i + 1}</Text>
                    <Text style={styles.checklistText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Pressable
              testID="listening-tips-confirm"
              style={[styles.primaryButton, { backgroundColor: mode.accent }]}
              onPress={() =>
                setTipsShownCases((prev) => new Set([...prev, currentCase.id]))
              }
            >
              <Text style={styles.primaryButtonText}>明白了，开始听题</Text>
            </Pressable>

            {currentIndex > 0 ? (
              <Pressable
                testID="listening-previous"
                onPress={handlePrevious}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>上一题</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <View style={[styles.briefingCard, shadows.card]}>
              <Text style={styles.sectionTitle}>{currentCase.title}</Text>
              <Text style={styles.sceneText}>场景：{currentCase.scene}</Text>
              <Text style={styles.taskText}>任务：{currentCase.task}</Text>
              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>听前提醒</Text>
                <Text style={styles.noteBody}>{currentCase.note}</Text>
              </View>

              <View style={styles.checklistCard}>
                <Text style={styles.noteTitle}>本题听点</Text>
                <View style={styles.checklistList}>
                  {currentCase.listenChecklist.map((item) => (
                    <View key={item} style={styles.checklistItem}>
                      <Text style={styles.checklistBullet}>•</Text>
                      <Text style={styles.checklistText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={[styles.progressCard, shadows.card]}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>题目进度</Text>
                <Text style={styles.progressValue}>
                  {currentIndex + 1}/{listeningItems.length}
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
                这一轮采用先听后答的流程。非即时应答题至少播放 1 次匹配音频，做完整轮后会自动记 1 轮听力。
              </Text>
            </View>

            <View style={[styles.audioCard, shadows.card]}>
              <View style={styles.audioHeader}>
                <View style={styles.audioTitleGroup}>
                  <Text style={styles.sectionTitle}>
                    {currentCase.audioKind === 'official' ? '官方示例音频' : '日语合成练习音频'}
                  </Text>
                  <Text style={styles.audioSourceHint}>
                    {currentCase.audioKind === 'official'
                      ? '题目与原音频已按官方脚本逐句核对'
                      : '根据本题日语原文生成，仅用于个人练习'}
                  </Text>
                </View>
                <View style={styles.audioMetaBadge}>
                  <Text style={styles.audioMetaBadgeText}>已听 {listenCount} 遍</Text>
                </View>
              </View>

              <Text style={styles.audioHint}>
                {audioStatus.isLoaded
                  ? hasPlayedCurrent
                    ? '可以继续复听，也可以直接作答。做错后建议对照复盘摘要再二听一次。'
                    : '先播放一次音频，再进入答题。不要先看复盘内容。'
                  : '音频加载中，请稍等片刻。'}
              </Text>

              <View style={styles.audioProgressCard}>
                <View style={styles.audioTimeRow}>
                  <Text style={styles.audioTimeText}>
                    <Text testID="listening-audio-current-time">
                    {formatSeconds(audioStatus.currentTime)}
                    </Text>
                  </Text>
                  <Text style={styles.audioTimeText}>{displayDuration}</Text>
                </View>
                <Pressable
                  testID="listening-audio-progress"
                  accessible
                  accessibilityRole="adjustable"
                  accessibilityLabel="音频播放进度"
                  aria-valuemin={0}
                  aria-valuemax={Math.max(Math.round(audioStatus.duration), 0)}
                  aria-valuenow={Math.round(audioStatus.currentTime)}
                  aria-valuetext={`${formatSeconds(audioStatus.currentTime)} / ${displayDuration}`}
                  accessibilityValue={{
                    min: 0,
                    max: Math.max(Math.round(audioStatus.duration), 0),
                    now: Math.round(audioStatus.currentTime),
                    text: `${formatSeconds(audioStatus.currentTime)} / ${displayDuration}`,
                  }}
                  accessibilityActions={[
                    { name: 'decrement', label: '后退十秒' },
                    { name: 'increment', label: '前进十秒' },
                  ]}
                  onAccessibilityAction={(event) =>
                    seekBy(event.nativeEvent.actionName === 'increment' ? 10 : -10)
                  }
                  onLayout={(event) => setAudioTrackWidth(event.nativeEvent.layout.width)}
                  onPress={seekFromTrackEvent}
                  style={styles.audioTrack}
                >
                  <View
                    style={[
                      styles.audioFill,
                      {
                        width: `${playbackProgress * 100}%`,
                        backgroundColor: mode.accent,
                      },
                    ]}
                  />
                </Pressable>
                <Text style={styles.audioSeekHint}>点按进度条定位音频</Text>
              </View>

              <View style={styles.audioButtonRow}>
                <Pressable
                  testID="listening-play-button"
                  onPress={handlePlayPause}
                  style={[
                    styles.primaryButton,
                    styles.audioPrimaryButton,
                    { backgroundColor: mode.accent },
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {!audioStatus.isLoaded
                      ? '加载并播放'
                      : audioStatus.playing
                      ? '暂停播放'
                      : shouldRestartPlayback
                        ? '重新播放'
                        : hasPlayedCurrent
                          ? '继续播放'
                          : '播放音频'}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={!audioStatus.isLoaded}
                  onPress={() => {
                    void handleReplay();
                  }}
                  style={[
                    styles.audioSecondaryButton,
                    !audioStatus.isLoaded && styles.secondaryButtonDisabled,
                  ]}
                >
                  <Text style={styles.audioSecondaryButtonText}>从头再听</Text>
                </Pressable>
              </View>

              <View style={styles.rateRow}>
                {PLAYBACK_RATES.map((rate) => {
                  const active = playbackRate === rate;

                  return (
                    <Pressable
                      key={rate}
                      onPress={() => setPlaybackRate(rate)}
                      style={[
                        styles.rateChip,
                        active && {
                          borderColor: mode.accent,
                          backgroundColor: mode.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.rateChipText,
                          active && { color: mode.accent },
                        ]}
                      >
                        {formatRateLabel(rate)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.sectionCard, styles.resultCard, shadows.card]}>
              <Text style={styles.questionMeta}>{questionMetaText}</Text>
              {isInstantReply ? (
                <View style={styles.stimulusCard}>
                  <Text style={styles.stimulusEyebrow}>刺激句</Text>
                  <Text style={styles.stimulusText}>{currentCase.dialogue[0]?.text}</Text>
                </View>
              ) : null}
              <Text testID="listening-question-prompt" style={styles.sectionTitle}>
                {question.prompt}
              </Text>
              <Text style={styles.questionHint}>
                {isInstantReply
                  ? '读刺激句，选出最自然、最得体的回应。'
                  : hasPlayedCurrent
                    ? '可以作答。若还不稳，建议先再听一遍再提交。'
                    : '先播放至少 1 次音频后，提交按钮才会解锁。'}
              </Text>

              <View style={styles.choiceList}>
                {question.choices.map((choice, index) => {
                  const isSelected = chosenAnswer === index;
                  const isAnswer = question.answer === index;

                  return (
                    <Pressable
                      key={choice}
                      testID={`listening-choice-${index}`}
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
                    <Text style={styles.analysisTitle}>听力原文与翻译</Text>
                    <View style={styles.dialogueList}>
                      {currentCase.dialogue.map((line, index) => (
                        <View key={`${line.speaker}-${index}`} style={styles.dialogueItem}>
                          <Text style={styles.dialogueSpeaker}>{line.speaker}</Text>
                          <Text
                            testID={`listening-transcript-ja-${index}`}
                            style={styles.dialogueText}
                          >
                            {withKana(line.text)}
                          </Text>
                          <Text
                            testID={`listening-transcript-zh-${index}`}
                            style={styles.dialogueTranslation}
                          >
                            {line.translation}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>关键转折</Text>
                    <Text style={styles.explanationBody}>{withKana(question.keySignal)}</Text>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>原文依据</Text>
                    <Text style={styles.explanationBody}>{withKana(question.basisLine)}</Text>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>陷阱点</Text>
                    <Text style={styles.explanationBody}>{withKana(question.trapPoint)}</Text>
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

                  {!isCorrect && chosenAnswer !== null ? (
                    <PersonalizedTutorPanel
                      mode="listening"
                      explanation={personalizedTutor}
                      loading={tutorLoading}
                      error={tutorError}
                      transferSelectedChoice={transferSelectedChoice}
                      transferChecked={transferChecked}
                      onGenerate={handlePersonalizedTutor}
                      onSelectTransferChoice={setTransferSelectedChoice}
                      onCheckTransfer={handleTransferCheck}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.footerActions}>
              {currentIndex > 0 ? (
                <Pressable
                  testID="listening-previous"
                  onPress={handlePrevious}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>上一题</Text>
                </Pressable>
              ) : null}
              <Pressable
                testID={submitted ? 'listening-next' : 'listening-submit'}
                onPress={submitted ? handleNext : handleSubmit}
                disabled={!submitted && submitDisabled}
                style={[
                  styles.primaryButton,
                  { backgroundColor: mode.accent },
                  !submitted && submitDisabled && styles.primaryButtonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {submitted
                    ? currentIndex === listeningItems.length - 1
                      ? '完成并记录'
                      : '下一题'
                    : isInstantReply || hasPlayedCurrent
                      ? '提交答案'
                      : '请先播放音频'}
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
    maxWidth: 1180,
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
  briefingCard: {
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
  audioCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 22,
    gap: 16,
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
  sceneText: {
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fonts.body,
  },
  taskText: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  noteCard: {
    borderRadius: radii.md,
    backgroundColor: colors.warmCard,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: 16,
    gap: 8,
  },
  checklistCard: {
    borderRadius: radii.md,
    backgroundColor: colors.backgroundCard,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: 16,
    gap: 10,
  },
  noteTitle: {
    color: colors.inkStrong,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  noteBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  checklistList: {
    gap: 10,
  },
  checklistItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  checklistBullet: {
    color: colors.teal,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  checklistText: {
    flex: 1,
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  tipsCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 24,
    gap: 18,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  tipsEyebrow: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  stimulusCard: {
    backgroundColor: colors.heroSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.heroLine,
    padding: 14,
    gap: 6,
  },
  stimulusEyebrow: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  stimulusText: {
    color: colors.inkStrong,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: fonts.title,
    lineHeight: 26,
  },
  checklistIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.tealSoft,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
    color: colors.teal,
    overflow: 'hidden',
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
  audioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  audioTitleGroup: {
    flex: 1,
    gap: 4,
  },
  audioSourceHint: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  audioMetaBadge: {
    borderRadius: radii.pill,
    backgroundColor: colors.warmCard,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  audioMetaBadgeText: {
    color: colors.inkBody,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  audioHint: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  audioProgressCard: {
    borderRadius: radii.md,
    backgroundColor: colors.warmCard,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: 14,
    gap: 10,
  },
  audioTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  audioTimeText: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  audioTrack: {
    height: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.slateSoft,
    overflow: 'hidden',
  },
  audioFill: {
    height: '100%',
    borderRadius: radii.pill,
  },
  audioSeekHint: {
    color: colors.inkMuted,
    fontSize: 11,
    textAlign: 'center',
    fontFamily: fonts.body,
  },
  audioButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  audioPrimaryButton: {
    flex: 1,
  },
  audioSecondaryButton: {
    minWidth: 110,
    borderRadius: radii.sm,
    backgroundColor: colors.slateSoft,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioSecondaryButtonText: {
    color: colors.inkBody,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  rateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rateChip: {
    flex: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.backgroundCard,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rateChipText: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  questionMeta: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  questionHint: {
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
  dialogueList: {
    gap: 10,
  },
  dialogueItem: {
    gap: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  dialogueSpeaker: {
    color: colors.inkStrong,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  dialogueText: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  dialogueTranslation: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  analysisList: {
    gap: 10,
  },
  analysisItem: {
    gap: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.backgroundCard,
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
