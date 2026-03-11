import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useProgressStore } from '../../../app/providers/ProgressProvider';
import { AppBackground } from '../../../components/common/AppBackground';
import { getListeningCasesByMode } from '../../../data/seed/listeningCases';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import type { ListeningModeId } from '../../../domain/models/training';
import { getModeSessionCountForDay } from '../../../domain/services/progressService';
import { colors, fonts, radii } from '../../../theme/tokens';

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
  const { state, todayKey, recordSession } = useProgressStore();
  const mode = getTrainingModeById(modeId);
  const cases = getListeningCasesByMode(modeId);

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
  const [listenCounts, setListenCounts] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{
    correctCount: number;
    wrongCount: number;
    recordedSessionCount: number;
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
  const player = useAudioPlayer(currentCase.audioAsset, { updateInterval: 250 });
  const audioStatus = useAudioPlayerStatus(player);

  const chosenAnswer = submitted
    ? answers[question.id] ?? selectedChoice
    : selectedChoice;
  const isCorrect = chosenAnswer === question.answer;
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
    (audioStatus.didJustFinish || audioStatus.currentTime < 0.05);
  const displayDuration =
    audioStatus.duration > 0
      ? formatSeconds(audioStatus.duration)
      : currentCase.audioDurationLabel;
  const submitDisabled = selectedChoice === null || !hasPlayedCurrent;
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

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    player.setPlaybackRate(playbackRate, 'medium');
  }, [playbackRate, player]);

  useEffect(() => {
    if (submitted && audioStatus.playing) {
      player.pause();
    }
  }, [audioStatus.playing, player, submitted]);

  const markListenAttempt = () => {
    setListenCounts((current) => ({
      ...current,
      [currentCase.id]: (current[currentCase.id] ?? 0) + 1,
    }));
  };

  const handlePlayPause = () => {
    if (!audioStatus.isLoaded) {
      return;
    }

    if (audioStatus.playing) {
      player.pause();
      return;
    }

    if (!hasPlayedCurrent && audioStatus.currentTime < 0.15) {
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

  const handleReplay = async () => {
    if (!audioStatus.isLoaded) {
      return;
    }

    markListenAttempt();
    await player.seekTo(0);
    player.play();
  };

  const handleSubmit = () => {
    if (selectedChoice === null || submitted || !hasPlayedCurrent) {
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

  const handleNext = () => {
    if (!submitted) {
      return;
    }

    if (currentIndex < listeningItems.length - 1) {
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

    recordSession(mode.id, 'drill');
    setResult({
      correctCount: listeningItems.length - wrongCount,
      wrongCount,
      recordedSessionCount: initialSessionCount + 1,
    });
  };

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={onExit} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>退出听力</Text>
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
            <Text style={styles.heroSource}>{currentCase.source}</Text>
          </View>

          <Text style={styles.heroTitle}>{mode.title}</Text>
          <Text style={styles.heroBody}>
            按照正式节奏先听再答。当前接入的是官方公开示例音频，至少播放一次后再作答，提交后再看复盘摘要、依据句和陷阱分析。
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
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>本轮听力完成</Text>
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
              <Text style={styles.summaryTitle}>下一步建议</Text>
              <Text style={styles.summaryBody}>
                {result.wrongCount > 0
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
        ) : (
          <>
            <View style={styles.briefingCard}>
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

            <View style={styles.progressCard}>
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
                这一轮已经是先听后答的完整流程。每题至少播放 1 次官方示例音频，做完整轮后会自动记 1 轮听力。
              </Text>
            </View>

            <View style={styles.audioCard}>
              <View style={styles.audioHeader}>
                <Text style={styles.sectionTitle}>官方示例音频</Text>
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
                    {formatSeconds(audioStatus.currentTime)}
                  </Text>
                  <Text style={styles.audioTimeText}>{displayDuration}</Text>
                </View>
                <View style={styles.audioTrack}>
                  <View
                    style={[
                      styles.audioFill,
                      {
                        width: `${playbackProgress * 100}%`,
                        backgroundColor: mode.accent,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.audioButtonRow}>
                <Pressable
                  disabled={!audioStatus.isLoaded}
                  onPress={handlePlayPause}
                  style={[
                    styles.primaryButton,
                    styles.audioPrimaryButton,
                    { backgroundColor: mode.accent },
                    !audioStatus.isLoaded && styles.primaryButtonDisabled,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {audioStatus.playing
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

            <View style={styles.sectionCard}>
              <Text style={styles.questionMeta}>
                第 {currentIndex + 1} 题 · 本材料第 {currentCaseQuestionIndex + 1} 题 · {question.tags.join(' / ')}
              </Text>
              <Text style={styles.sectionTitle}>{question.prompt}</Text>
              <Text style={styles.questionHint}>
                {hasPlayedCurrent
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
                    <Text style={styles.analysisTitle}>复盘摘要</Text>
                    <View style={styles.dialogueList}>
                      {currentCase.dialogue.map((line, index) => (
                        <View key={`${line.speaker}-${index}`} style={styles.dialogueItem}>
                          <Text style={styles.dialogueSpeaker}>{line.speaker}</Text>
                          <Text style={styles.dialogueText}>{line.text}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>关键转折</Text>
                    <Text style={styles.explanationBody}>{question.keySignal}</Text>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>原文依据</Text>
                    <Text style={styles.explanationBody}>{question.basisLine}</Text>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>陷阱点</Text>
                    <Text style={styles.explanationBody}>{question.trapPoint}</Text>
                  </View>

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
                      ? '完成并自动记录'
                      : '进入下一题'
                    : hasPlayedCurrent
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
    borderRadius: radii.lg,
    padding: 18,
    gap: 14,
  },
  sectionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    padding: 18,
    gap: 14,
  },
  audioCard: {
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
    backgroundColor: '#FFFDF8',
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
  audioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
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
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.slateSoft,
    overflow: 'hidden',
  },
  audioFill: {
    height: '100%',
    borderRadius: radii.pill,
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
    backgroundColor: '#FFFDF8',
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
    backgroundColor: '#FFFDF8',
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


