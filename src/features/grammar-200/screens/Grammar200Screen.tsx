import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { useGrammar200Store } from '../../../app/providers/Grammar200Provider';
import { useProgressStore } from '../../../app/providers/ProgressProvider';
import { AppBackground } from '../../../components/common/AppBackground';
import {
  GRAMMAR_200_CHAPTERS,
  GRAMMAR_200_SOURCE_LABEL,
  getSortQuestionPatternRefs,
} from '../../../data/seed/grammar200';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import type {
  Grammar200Chapter,
  Grammar200ChapterPhase,
  Grammar200SortAiExplanation,
  Grammar200SortQuestion,
} from '../../../domain/models/grammar200';
import type { Grammar200ModeId } from '../../../domain/models/training';
import { getSortQuestionExplanation } from '../../../services/aiCoachClient';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';

type Grammar200ScreenProps = {
  modeId: Grammar200ModeId;
  onExit: () => void;
  onBackToDetail: () => void;
  onBackToDashboard: () => void;
};

type Phase = 'chapter-picker' | Grammar200ChapterPhase;

export function Grammar200Screen({
  modeId,
  onExit,
  onBackToDashboard,
}: Grammar200ScreenProps) {
  const mode = getTrainingModeById(modeId);
  const {
    state: g200State,
    recordChapterCompletion,
    saveAiExplanation,
  } = useGrammar200Store();
  const { recordSession } = useProgressStore();

  const [phase, setPhase] = useState<Phase>('chapter-picker');
  const [activeChapter, setActiveChapter] =
    useState<Grammar200Chapter | null>(null);

  // Study phase state
  const [studyIndex, setStudyIndex] = useState(0);
  const [unstableIds, setUnstableIds] = useState<Record<string, boolean>>({});

  // Sort phase state
  const [sortIndex, setSortIndex] = useState(0);
  const [sortPlacement, setSortPlacement] = useState<(number | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [sortRevealed, setSortRevealed] = useState(false);
  const [sortAttempts, setSortAttempts] = useState<
    { questionId: string; correct: boolean }[]
  >([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!mode) {
    return (
      <AppBackground>
        <View style={styles.missingState}>
          <Text style={styles.missingTitle}>模式不存在</Text>
          <Pressable onPress={onBackToDashboard} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>返回首页</Text>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  const startChapter = (chapter: Grammar200Chapter) => {
    if (!chapter.published) return;
    setActiveChapter(chapter);
    setStudyIndex(0);
    setUnstableIds({});
    setSortIndex(0);
    setSortPlacement([null, null, null, null]);
    setSortRevealed(false);
    setSortAttempts([]);
    setPhase('overview');
  };

  const backToPicker = () => {
    setActiveChapter(null);
    setPhase('chapter-picker');
  };

  // ---------- Phase: chapter picker ----------
  if (phase === 'chapter-picker' || !activeChapter) {
    return (
      <ChapterPickerView
        mode={mode}
        chapters={GRAMMAR_200_CHAPTERS}
        progressByChapter={g200State.chapters}
        onPickChapter={startChapter}
        onExit={onExit}
      />
    );
  }

  // ---------- Phase: chapter overview ----------
  if (phase === 'overview') {
    const completed = activeChapter.patterns.length;
    return (
      <ChapterOverviewView
        accent={mode.accent}
        surface={mode.surface}
        chapter={activeChapter}
        bestScore={g200State.chapters[activeChapter.id]?.bestScore ?? 0}
        onBack={backToPicker}
        onStartStudy={() => {
          if (completed === 0) return;
          setPhase('study');
        }}
      />
    );
  }

  // ---------- Phase: study cards ----------
  if (phase === 'study') {
    const pattern = activeChapter.patterns[studyIndex];
    const isLast = studyIndex === activeChapter.patterns.length - 1;
    const isFirst = studyIndex === 0;

    const handleNext = (markUnstable: boolean) => {
      const nextUnstable = { ...unstableIds, [pattern.id]: markUnstable };
      setUnstableIds(nextUnstable);
      if (isLast) {
        setPhase('sort');
        return;
      }
      setStudyIndex((current) => current + 1);
    };

    const handlePrev = () => {
      if (isFirst) return;
      setStudyIndex((current) => Math.max(0, current - 1));
    };

    return (
      <StudyCardView
        accent={mode.accent}
        surface={mode.surface}
        chapter={activeChapter}
        pattern={pattern}
        index={studyIndex}
        total={activeChapter.patterns.length}
        onMark={handleNext}
        onPrev={handlePrev}
        canGoPrev={!isFirst}
        onBack={() => setPhase('overview')}
        onJumpToSort={() => setPhase('sort')}
      />
    );
  }

  // ---------- Phase: sort drill ----------
  if (phase === 'sort') {
    const question = activeChapter.sortQuestions[sortIndex];
    const isLast = sortIndex === activeChapter.sortQuestions.length - 1;

    const handlePlace = (fragmentIndex: number) => {
      if (sortRevealed) return;
      // already placed? unplace it
      const currentSlot = sortPlacement.findIndex(
        (slot) => slot === fragmentIndex,
      );
      if (currentSlot !== -1) {
        const next = [...sortPlacement];
        next[currentSlot] = null;
        setSortPlacement(next);
        return;
      }
      // place into next empty slot
      const emptySlot = sortPlacement.findIndex((slot) => slot === null);
      if (emptySlot === -1) return;
      const next = [...sortPlacement];
      next[emptySlot] = fragmentIndex;
      setSortPlacement(next);
    };

    const handleClear = () => {
      if (sortRevealed) return;
      setSortPlacement([null, null, null, null]);
    };

    const isComplete = sortPlacement.every((slot) => slot !== null);
    const isCorrect =
      isComplete &&
      sortPlacement.every(
        (slot, idx) => slot === question.correctOrder[idx],
      );

    const handleSubmit = () => {
      if (!isComplete) return;
      setSortRevealed(true);
      setSortAttempts((current) => [
        ...current,
        { questionId: question.id, correct: isCorrect },
      ]);
    };

    const handleNext = () => {
      if (isLast) {
        const correctCount =
          sortAttempts.filter((attempt) => attempt.correct).length;
        recordChapterCompletion(activeChapter.id, correctCount);
        recordSession(modeId, 'chapter');
        setPhase('result');
        return;
      }
      setSortIndex((current) => current + 1);
      setSortPlacement([null, null, null, null]);
      setSortRevealed(false);
      setAiError(null);
    };

    const cachedAi = g200State.aiExplanationCache[question.id] ?? null;

    const handleAiExplain = async () => {
      if (aiLoading || cachedAi) return;
      setAiError(null);
      setAiLoading(true);
      try {
        const patternRefs = getSortQuestionPatternRefs(activeChapter, question);
        const result = await getSortQuestionExplanation({
          fullSentence: question.fullSentenceJp,
          fullSentenceReading: question.fullSentenceReading,
          fullSentenceZh: question.fullSentenceZh,
          patternTerms: patternRefs.map((p) => p.term),
          baseExplanation: question.explanation,
        });
        saveAiExplanation(question.id, {
          ...result,
          generatedAt: new Date().toISOString(),
        });
      } catch (err) {
        if (__DEV__) console.warn('[Grammar200 AI]', err);
        setAiError('AI 解析失败，请稍后重试');
      } finally {
        setAiLoading(false);
      }
    };

    return (
      <SortDrillView
        accent={mode.accent}
        surface={mode.surface}
        chapter={activeChapter}
        question={question}
        index={sortIndex}
        total={activeChapter.sortQuestions.length}
        placement={sortPlacement}
        revealed={sortRevealed}
        isComplete={isComplete}
        isCorrect={isCorrect}
        onPlace={handlePlace}
        onClear={handleClear}
        onSubmit={handleSubmit}
        onNext={handleNext}
        onBack={() => setPhase('overview')}
        aiExplanation={cachedAi}
        aiLoading={aiLoading}
        aiError={aiError}
        onAiExplain={handleAiExplain}
      />
    );
  }

  // ---------- Phase: result ----------
  const correctCount = sortAttempts.filter((a) => a.correct).length;
  const totalCount = activeChapter.sortQuestions.length;
  return (
    <ResultView
      accent={mode.accent}
      surface={mode.surface}
      chapter={activeChapter}
      correctCount={correctCount}
      totalCount={totalCount}
      attempts={sortAttempts}
      onRedo={() => {
        setStudyIndex(0);
        setUnstableIds({});
        setSortIndex(0);
        setSortPlacement([null, null, null, null]);
        setSortRevealed(false);
        setSortAttempts([]);
        setPhase('overview');
      }}
      onPicker={backToPicker}
      onHome={onBackToDashboard}
    />
  );
}

// ====================== Chapter picker ======================

type ChapterPickerProps = {
  mode: ReturnType<typeof getTrainingModeById>;
  chapters: Grammar200Chapter[];
  progressByChapter: ReturnType<typeof useGrammar200Store>['state']['chapters'];
  onPickChapter: (chapter: Grammar200Chapter) => void;
  onExit: () => void;
};

function ChapterPickerView({
  mode,
  chapters,
  progressByChapter,
  onPickChapter,
  onExit,
}: ChapterPickerProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1040;
  if (!mode) return null;

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        <View style={styles.header}>
          <Pressable onPress={onExit} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>返回首页</Text>
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
            <Text style={styles.heroSource}>{GRAMMAR_200_SOURCE_LABEL}</Text>
          </View>
          <Text style={styles.heroTitle}>{mode.title}</Text>
          <Text style={styles.heroBody}>{mode.description}</Text>
          <View style={styles.heroAgendaCard}>
            <Text style={styles.heroAgendaEyebrow}>本模块怎么用</Text>
            <Text style={styles.heroAgendaText}>
              选一章，先过 20 条核心文法，再做 10 题排序闯关。每条文法都有读音、中文核心义、例句翻译。
            </Text>
            <Text style={styles.heroAgendaFootnote}>
              排序题做错的，回到对应文法卡看一遍记忆钩子，比硬背更稳。
            </Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>选择章节</Text>

        <View style={styles.chapterGrid}>
          {chapters.map((chapter) => {
            const progress = progressByChapter[chapter.id];
            const locked = !chapter.published;
            return (
              <Pressable
                key={chapter.id}
                onPress={() => onPickChapter(chapter)}
                style={[
                  styles.chapterCard,
                  shadows.card,
                  locked && styles.chapterCardLocked,
                ]}
                disabled={locked}
              >
                <View style={styles.chapterCardHeader}>
                  <View style={[
                    styles.chapterIndexPill,
                    { backgroundColor: locked ? colors.slateSoft : mode.surface },
                  ]}>
                    <Text style={[
                      styles.chapterIndexText,
                      { color: locked ? colors.inkMuted : mode.accent },
                    ]}>
                      第 {chapter.index} 章
                    </Text>
                  </View>
                  {progress?.bestScore !== undefined && progress.bestScore > 0 ? (
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreBadgeText}>
                        最佳 {progress.bestScore}/10
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.chapterTitle}>{chapter.title}</Text>
                <Text style={styles.chapterRange}>{chapter.rangeLabel}</Text>
                <Text style={styles.chapterIntro}>{chapter.intro}</Text>
                {locked ? (
                  <Text style={styles.chapterLockedText}>即将上线</Text>
                ) : (
                  <Text style={[styles.chapterEnterText, { color: mode.accent }]}>
                    进入本章 →
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </AppBackground>
  );
}

// ====================== Chapter overview ======================

type ChapterOverviewProps = {
  accent: string;
  surface: string;
  chapter: Grammar200Chapter;
  bestScore: number;
  onBack: () => void;
  onStartStudy: () => void;
};

function ChapterOverviewView({
  accent,
  surface,
  chapter,
  bestScore,
  onBack,
  onStartStudy,
}: ChapterOverviewProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1040;

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>返回章节列表</Text>
          </Pressable>
          <Text style={styles.headerTag}>{chapter.rangeLabel}</Text>
        </View>

        <View style={[styles.heroCard, shadows.card, { backgroundColor: accent }]}>
          <View style={[styles.modePill, { backgroundColor: surface, alignSelf: 'flex-start' }]}>
            <Text style={[styles.modePillText, { color: accent }]}>
              第 {chapter.index} 章
            </Text>
          </View>
          <Text style={styles.heroTitle}>{chapter.title}</Text>
          <Text style={styles.heroBody}>{chapter.intro}</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{chapter.patterns.length}</Text>
              <Text style={styles.heroMetaLabel}>文法卡</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{chapter.sortQuestions.length}</Text>
              <Text style={styles.heroMetaLabel}>排序题</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{bestScore}</Text>
              <Text style={styles.heroMetaLabel}>历史最佳</Text>
            </View>
          </View>
        </View>

        <View style={[styles.sectionCard, shadows.card]}>
          <Text style={styles.sectionTitle}>本章节奏</Text>
          <View style={styles.flowList}>
            <FlowStep accent={accent} index={1} text="顺过 20 条文法卡：term + 读音 + 中文释义 + 例句" />
            <FlowStep accent={accent} index={2} text="做 10 题排序闯关，模拟 N2 文法 Section 7 题型" />
            <FlowStep accent={accent} index={3} text="结果页查看正确率和详细解析，错题马上回看" />
          </View>
        </View>

        <View style={[styles.sectionCard, shadows.card]}>
          <Text style={styles.sectionTitle}>本章覆盖</Text>
          <View style={styles.tagWrap}>
            {chapter.patterns.map((pattern) => (
              <View key={pattern.id} style={[styles.termTag, { borderColor: accent }]}>
                <Text style={[styles.termTagNo, { color: accent }]}>
                  {pattern.no}
                </Text>
                <Text style={styles.termTagText}>{pattern.term}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable
          onPress={onStartStudy}
          style={[styles.primaryButton, { backgroundColor: accent }]}
        >
          <Text style={styles.primaryButtonText}>开始本章学习</Text>
        </Pressable>
      </ScrollView>
    </AppBackground>
  );
}

function FlowStep({
  accent,
  index,
  text,
}: {
  accent: string;
  index: number;
  text: string;
}) {
  return (
    <View style={styles.flowRow}>
      <View style={[styles.flowDot, { backgroundColor: accent }]}>
        <Text style={styles.flowDotText}>{index}</Text>
      </View>
      <Text style={styles.flowText}>{text}</Text>
    </View>
  );
}

// ====================== Study card ======================

type StudyCardProps = {
  accent: string;
  surface: string;
  chapter: Grammar200Chapter;
  pattern: Grammar200Chapter['patterns'][number];
  index: number;
  total: number;
  onMark: (markUnstable: boolean) => void;
  onPrev: () => void;
  canGoPrev: boolean;
  onBack: () => void;
  onJumpToSort: () => void;
};

function StudyCardView({
  accent,
  surface,
  pattern,
  index,
  total,
  onMark,
  onPrev,
  canGoPrev,
  onBack,
  onJumpToSort,
}: StudyCardProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1040;
  const progress = (index + 1) / total;

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>退回章节</Text>
          </Pressable>
          <Pressable onPress={onJumpToSort} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>跳到排序题</Text>
          </Pressable>
        </View>

        <View style={[styles.progressCard, shadows.card]}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>文法学习进度</Text>
            <Text style={styles.progressValue}>
              {index + 1}/{total}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%`, backgroundColor: accent },
              ]}
            />
          </View>
        </View>

        <View style={[styles.sectionCard, shadows.card]}>
          <View style={styles.cardHeader}>
            <View style={[styles.numberBadge, { backgroundColor: surface }]}>
              <Text style={[styles.numberBadgeText, { color: accent }]}>
                {pattern.no}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patternTerm}>{pattern.term}</Text>
              {pattern.reading && pattern.reading !== pattern.term ? (
                <Text style={styles.patternReading}>读音：{pattern.reading}</Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.meaningBlock, { backgroundColor: surface }]}>
            <Text style={[styles.meaningEyebrow, { color: accent }]}>中文核心义</Text>
            <Text style={styles.meaningText}>{pattern.meaningZh}</Text>
          </View>

          <AnalysisRow title="接续 / 结构" body={pattern.structure} />
          <AnalysisRow title="使用要点" body={pattern.usage} />
          {pattern.confusingWith ? (
            <AnalysisRow title="易混对比" body={pattern.confusingWith} />
          ) : null}
          <AnalysisRow title="记忆钩子" body={pattern.memoryHook} accent={accent} />
          {pattern.examTip ? (
            <AnalysisRow title="N2 考点提示" body={pattern.examTip} />
          ) : null}

          <Text style={styles.subSectionTitle}>例句</Text>
          {pattern.examples.map((example, idx) => (
            <View key={idx} style={styles.exampleBlock}>
              <Text style={styles.exampleJp}>{example.jp}</Text>
              <Text style={styles.exampleReading}>{example.reading}</Text>
              <Text style={styles.exampleZh}>{example.zh}</Text>
            </View>
          ))}

          <View style={styles.footerActions}>
            <Pressable
              onPress={onPrev}
              disabled={!canGoPrev}
              style={[
                styles.ghostButton,
                styles.prevButton,
                !canGoPrev && styles.prevButtonDisabled,
              ]}
            >
              <Text style={styles.ghostButtonText}>← 上一条</Text>
            </Pressable>
            <Pressable
              onPress={() => onMark(true)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>还不稳</Text>
            </Pressable>
            <Pressable
              onPress={() => onMark(false)}
              style={[styles.primaryButton, { backgroundColor: accent, flex: 1 }]}
            >
              <Text style={styles.primaryButtonText}>
                {index === total - 1 ? '已学完，进入排序题' : '已记住，下一条'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

function PathStep({
  accent,
  step,
  label,
  body,
}: {
  accent: string;
  step: number;
  label: string;
  body: string;
}) {
  return (
    <View style={[styles.pathStepCard, { borderColor: accent }]}>
      <View style={styles.pathStepHead}>
        <View style={[styles.pathStepNum, { backgroundColor: accent }]}>
          <Text style={styles.pathStepNumText}>{step}</Text>
        </View>
        <Text style={[styles.pathStepLabel, { color: accent }]}>{label}</Text>
      </View>
      <Text style={styles.pathStepBody}>{body}</Text>
    </View>
  );
}

function PathArrow({ accent }: { accent: string }) {
  return (
    <View style={styles.pathArrowRow}>
      <Text style={[styles.pathArrowText, { color: accent }]}>↓</Text>
    </View>
  );
}

function AnalysisRow({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent?: string;
}) {
  return (
    <View style={styles.analysisRow}>
      <Text
        style={[
          styles.analysisTitle,
          accent ? { color: accent } : null,
        ]}
      >
        {title}
      </Text>
      <Text style={styles.analysisBody}>{body}</Text>
    </View>
  );
}

// ====================== Sort drill ======================

type SortDrillProps = {
  accent: string;
  surface: string;
  chapter: Grammar200Chapter;
  question: Grammar200SortQuestion;
  index: number;
  total: number;
  placement: (number | null)[];
  revealed: boolean;
  isComplete: boolean;
  isCorrect: boolean;
  onPlace: (fragmentIndex: number) => void;
  onClear: () => void;
  onSubmit: () => void;
  onNext: () => void;
  onBack: () => void;
  aiExplanation: Grammar200SortAiExplanation | null;
  aiLoading: boolean;
  aiError: string | null;
  onAiExplain: () => void;
};

function SortDrillView({
  accent,
  surface,
  question,
  index,
  total,
  placement,
  revealed,
  isComplete,
  isCorrect,
  onPlace,
  onClear,
  onSubmit,
  onNext,
  onBack,
  aiExplanation,
  aiLoading,
  aiError,
  onAiExplain,
}: SortDrillProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1040;
  const progress = (index + 1) / total;

  const stemSlots = placement.map((slot) =>
    slot === null ? '____' : question.fragments[slot],
  );

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>退回章节</Text>
          </Pressable>
          <Text style={styles.headerTag}>排序闯关</Text>
        </View>

        <View style={[styles.progressCard, shadows.card]}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>排序题进度</Text>
            <Text style={styles.progressValue}>
              {index + 1}/{total}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%`, backgroundColor: accent },
              ]}
            />
          </View>
        </View>

        <View style={[styles.sectionCard, shadows.card]}>
          <Text style={styles.sectionEyebrow}>第 {question.index} 题</Text>
          <Text style={styles.sectionTitle}>把碎片排进 4 个空格</Text>

          <View style={[styles.stemBox, { backgroundColor: surface }]}>
            <Text style={styles.stemText}>
              <Text style={styles.stemFixed}>{question.stemPrefix}</Text>
              {stemSlots.map((slot, slotIdx) => (
                <Text
                  key={slotIdx}
                  style={[
                    styles.slotText,
                    placement[slotIdx] !== null && { color: accent, fontWeight: '800' },
                  ]}
                >
                  {' '}
                  {slot}{' '}
                </Text>
              ))}
              <Text style={styles.stemFixed}>{question.stemSuffix}</Text>
            </Text>
          </View>

          <Text style={styles.subSectionTitle}>碎片</Text>
          <View style={styles.fragmentRow}>
            {question.fragments.map((fragment, fragIdx) => {
              const placedAt = placement.findIndex((slot) => slot === fragIdx);
              const isPlaced = placedAt !== -1;
              return (
                <Pressable
                  key={fragIdx}
                  onPress={() => onPlace(fragIdx)}
                  disabled={revealed}
                  style={[
                    styles.fragmentChip,
                    isPlaced && { backgroundColor: accent },
                    revealed && styles.fragmentChipDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.fragmentText,
                      isPlaced && { color: '#FFFFFF' },
                    ]}
                  >
                    {isPlaced ? `${placedAt + 1}. ${fragment}` : fragment}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {!revealed ? (
            <View style={styles.footerActions}>
              <Pressable onPress={onClear} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>清空</Text>
              </Pressable>
              <Pressable
                onPress={onSubmit}
                disabled={!isComplete}
                style={[
                  styles.primaryButton,
                  { backgroundColor: accent, flex: 1, opacity: isComplete ? 1 : 0.4 },
                ]}
              >
                <Text style={styles.primaryButtonText}>提交</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View
                style={[
                  styles.feedbackBox,
                  { backgroundColor: isCorrect ? '#DCFCE7' : '#FEE2E2' },
                ]}
              >
                <Text
                  style={[
                    styles.feedbackTitle,
                    { color: isCorrect ? '#166534' : '#B91C1C' },
                  ]}
                >
                  {isCorrect ? '✓ 正确' : '✗ 答错'}
                </Text>
              </View>

              <View style={styles.exampleBlock}>
                <Text style={styles.subSectionTitle}>完整句子</Text>
                <Text style={styles.exampleJp}>{question.fullSentenceJp}</Text>
                <Text style={styles.exampleReading}>{question.fullSentenceReading}</Text>
                <Text style={styles.exampleZh}>{question.fullSentenceZh}</Text>
              </View>

              <View style={styles.analysisRow}>
                <Text style={[styles.analysisTitle, { color: accent }]}>
                  解析
                </Text>
                <Text style={styles.analysisBody}>{question.explanation}</Text>
              </View>

              <View style={[styles.aiBlock, { borderColor: accent }]}>
                <View style={styles.aiBlockHeader}>
                  <Text style={[styles.aiBlockTitle, { color: accent }]}>
                    AI 解题路径
                  </Text>
                  {!aiExplanation ? (
                    <Pressable
                      onPress={onAiExplain}
                      disabled={aiLoading}
                      style={[
                        styles.aiButton,
                        { backgroundColor: accent },
                        aiLoading && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={styles.aiButtonText}>
                        {aiLoading ? 'AI 推导中…' : '让 AI 演示路径'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.mantraBox}>
                  <Text style={[styles.mantraTitle, { color: accent }]}>
                    口令
                  </Text>
                  <Text style={styles.mantraBody}>
                    先看句尾，后找助词；先拼小块，再排全句；遇到语法，整块处理。
                  </Text>
                </View>

                {aiError ? (
                  <Text style={styles.aiErrorText}>{aiError}</Text>
                ) : null}
                {aiExplanation ? (
                  <>
                    <View style={styles.pathFlow}>
                      <PathStep
                        accent={accent}
                        step={1}
                        label="锁句尾"
                        body={aiExplanation.lockEnding}
                      />
                      <PathArrow accent={accent} />
                      <PathStep
                        accent={accent}
                        step={2}
                        label="抓固定块"
                        body={aiExplanation.identifyChunks}
                      />
                      <PathArrow accent={accent} />
                      <PathStep
                        accent={accent}
                        step={3}
                        label="链助词"
                        body={aiExplanation.chainParticles}
                      />
                      <PathArrow accent={accent} />
                      <PathStep
                        accent={accent}
                        step={4}
                        label="定全句"
                        body={aiExplanation.finalOrder}
                      />
                    </View>

                    <View style={[styles.takeawayBox, { backgroundColor: accent }]}>
                      <Text style={styles.takeawayEyebrow}>带走的规律</Text>
                      <Text style={styles.takeawayBody}>
                        {aiExplanation.transferRule}
                      </Text>
                    </View>
                  </>
                ) : !aiLoading ? (
                  <Text style={styles.aiHintText}>
                    点上方按钮，AI 会按"锁句尾 → 抓固定块 → 链助词 → 定全句"4 步演示本题路径，最后给一条可迁移到同类题的规律。
                  </Text>
                ) : null}
              </View>

              <Pressable
                onPress={onNext}
                style={[styles.primaryButton, { backgroundColor: accent }]}
              >
                <Text style={styles.primaryButtonText}>
                  {index === total - 1 ? '查看本章结果' : '下一题'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </AppBackground>
  );
}

// ====================== Result ======================

type ResultProps = {
  accent: string;
  surface: string;
  chapter: Grammar200Chapter;
  correctCount: number;
  totalCount: number;
  attempts: { questionId: string; correct: boolean }[];
  onRedo: () => void;
  onPicker: () => void;
  onHome: () => void;
};

function ResultView({
  accent,
  surface,
  chapter,
  correctCount,
  totalCount,
  attempts,
  onRedo,
  onPicker,
  onHome,
}: ResultProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 1040;
  const ratio = totalCount === 0 ? 0 : correctCount / totalCount;
  const verdict = useMemo(() => {
    if (ratio >= 0.9) return '本章已经稳了，可以推进下一章。';
    if (ratio >= 0.7) return '基本掌握，错题对应的文法卡再读一遍记忆钩子。';
    if (ratio >= 0.5) return '一半左右，建议把错题对应的文法卡复习一轮再重做本章。';
    return '当前还很不稳，先回学习卡逐条过一遍再来挑战。';
  }, [ratio]);

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]}>
        <View style={styles.header}>
          <Pressable onPress={onPicker} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>返回章节列表</Text>
          </Pressable>
          <Text style={styles.headerTag}>本章总结</Text>
        </View>

        <View style={[styles.heroCard, shadows.card, { backgroundColor: accent }]}>
          <Text style={styles.heroTitle}>
            {correctCount} / {totalCount}
          </Text>
          <Text style={styles.heroBody}>{chapter.title} · 排序闯关结果</Text>
          <View style={styles.heroAgendaCard}>
            <Text style={styles.heroAgendaEyebrow}>建议</Text>
            <Text style={styles.heroAgendaText}>{verdict}</Text>
          </View>
        </View>

        <View style={[styles.sectionCard, shadows.card]}>
          <Text style={styles.sectionTitle}>逐题概览</Text>
          {attempts.map((attempt, idx) => {
            const question = chapter.sortQuestions.find(
              (q) => q.id === attempt.questionId,
            );
            return (
              <View key={attempt.questionId} style={styles.attemptRow}>
                <View
                  style={[
                    styles.attemptDot,
                    { backgroundColor: attempt.correct ? '#16A34A' : '#DC2626' },
                  ]}
                >
                  <Text style={styles.attemptDotText}>
                    {attempt.correct ? '✓' : '✗'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attemptTitle}>
                    第 {idx + 1} 题
                  </Text>
                  {question ? (
                    <Text style={styles.attemptBody} numberOfLines={2}>
                      {question.fullSentenceJp}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.footerActions}>
          <Pressable onPress={onRedo} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>再做一次</Text>
          </Pressable>
          <Pressable
            onPress={onHome}
            style={[styles.primaryButton, { backgroundColor: accent, flex: 1 }]}
          >
            <Text style={styles.primaryButtonText}>回到首页</Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

// ====================== Styles ======================

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
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
    borderRadius: 30,
    padding: 24,
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
    color: '#F8FAFC',
    fontSize: 12,
    lineHeight: 18,
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
    minWidth: 110,
    flexGrow: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  heroMetaValue: {
    color: '#FFFFFF',
    fontSize: 22,
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
    borderRadius: radii.lg,
    padding: 18,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroAgendaEyebrow: {
    color: '#E9E2F5',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: fonts.body,
  },
  heroAgendaText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: fonts.title,
  },
  heroAgendaFootnote: {
    color: '#D7CDE7',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  sectionHeading: {
    color: colors.inkStrong,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.title,
    marginTop: 4,
  },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  chapterCard: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 280,
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 18,
    gap: 8,
  },
  chapterCardLocked: {
    opacity: 0.55,
  },
  chapterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chapterIndexPill: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chapterIndexText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  scoreBadge: {
    borderRadius: radii.pill,
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreBadgeText: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  chapterTitle: {
    color: colors.inkStrong,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  chapterRange: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  chapterIntro: {
    color: colors.inkBody,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  chapterEnterText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
    marginTop: 4,
  },
  chapterLockedText: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
    marginTop: 4,
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
  sectionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.xl,
    padding: 22,
    gap: 14,
  },
  sectionTitle: {
    color: colors.inkStrong,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  sectionEyebrow: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: fonts.body,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  numberBadge: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBadgeText: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  patternTerm: {
    color: colors.inkStrong,
    fontSize: 28,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  patternReading: {
    color: colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.body,
    marginTop: 4,
  },
  meaningBlock: {
    borderRadius: radii.lg,
    padding: 16,
    gap: 6,
  },
  meaningEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: fonts.body,
  },
  meaningText: {
    color: colors.inkStrong,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '700',
    fontFamily: fonts.title,
  },
  analysisRow: {
    gap: 6,
    paddingVertical: 6,
  },
  analysisTitle: {
    color: colors.inkStrong,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  analysisBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  subSectionTitle: {
    color: colors.inkStrong,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.title,
    marginTop: 6,
  },
  exampleBlock: {
    borderRadius: radii.lg,
    backgroundColor: colors.warmCard,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  exampleJp: {
    color: colors.inkStrong,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: fonts.title,
  },
  exampleReading: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  exampleZh: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  termTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1.2,
    backgroundColor: colors.backgroundCard,
  },
  termTagNo: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  termTagText: {
    color: colors.inkStrong,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.title,
  },
  flowList: {
    gap: 10,
  },
  flowRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  flowDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowDotText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  flowText: {
    flex: 1,
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  primaryButton: {
    borderRadius: radii.sm,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.inkBody,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  stemBox: {
    borderRadius: radii.lg,
    padding: 16,
    marginTop: 6,
  },
  stemText: {
    color: colors.inkStrong,
    fontSize: 16,
    lineHeight: 28,
    fontFamily: fonts.title,
    fontWeight: '700',
  },
  stemFixed: {
    color: colors.inkStrong,
  },
  slotText: {
    color: colors.inkSoft,
    fontWeight: '700',
  },
  fragmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fragmentChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.warmCard,
    borderWidth: 1.2,
    borderColor: colors.lineSoft,
  },
  fragmentChipDisabled: {
    opacity: 0.6,
  },
  fragmentText: {
    color: colors.inkStrong,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.title,
  },
  feedbackBox: {
    borderRadius: radii.lg,
    padding: 14,
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  attemptRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  attemptDot: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attemptDotText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  attemptTitle: {
    color: colors.inkStrong,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  attemptBody: {
    color: colors.inkBody,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
    marginTop: 2,
  },
  prevButton: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radii.sm,
  },
  prevButtonDisabled: {
    opacity: 0.4,
  },
  aiBlock: {
    borderRadius: radii.lg,
    borderWidth: 1.4,
    padding: 16,
    gap: 10,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
  },
  aiBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  aiBlockTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  aiButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
  },
  aiButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  aiHintText: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  aiErrorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  aiContentList: {
    gap: 12,
  },
  aiContentRow: {
    gap: 4,
  },
  aiContentTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: fonts.body,
  },
  aiContentBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  mantraBox: {
    borderRadius: radii.md,
    backgroundColor: colors.warmCard,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  mantraTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: fonts.body,
  },
  mantraBody: {
    color: colors.inkBody,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: fonts.body,
  },
  pathFlow: {
    gap: 0,
  },
  pathStepCard: {
    borderRadius: radii.lg,
    borderWidth: 1.4,
    padding: 14,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  pathStepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pathStepNum: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathStepNumText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  pathStepLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: fonts.title,
  },
  pathStepBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  pathArrowRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  pathArrowText: {
    fontSize: 18,
    fontWeight: '800',
  },
  takeawayBox: {
    borderRadius: radii.lg,
    padding: 16,
    gap: 6,
    marginTop: 8,
  },
  takeawayEyebrow: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: fonts.body,
  },
  takeawayBody: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
    fontFamily: fonts.title,
  },
});
