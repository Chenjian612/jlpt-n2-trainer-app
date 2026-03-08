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
import { getStudyPackByMode } from '../../../data/seed/studyPacks';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import type { StudyModeId } from '../../../domain/models/training';
import { getModeSessionCountForDay } from '../../../domain/services/progressService';
import { colors, fonts, radii } from '../../../theme/tokens';

type StudyPackScreenProps = {
  modeId: StudyModeId;
  onExit: () => void;
  onBackToDetail: () => void;
  onBackToDashboard: () => void;
};

type StudyResult = {
  solidCount: number;
  unstableTerms: string[];
  recordedSessionCount: number;
};

export function StudyPackScreen({
  modeId,
  onExit,
  onBackToDetail,
  onBackToDashboard,
}: StudyPackScreenProps) {
  const { state, todayKey, recordSession } = useProgressStore();
  const mode = getTrainingModeById(modeId);
  const pack = getStudyPackByMode(modeId);

  if (!mode || !pack || pack.items.length === 0) {
    return (
      <AppBackground>
        <View style={styles.missingState}>
          <Text style={styles.missingTitle}>学习包暂时不可用</Text>
          <Pressable onPress={onBackToDashboard} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>返回首页</Text>
          </Pressable>
        </View>
      </AppBackground>
    );
  }

  const initialSessionCount = getModeSessionCountForDay(state, todayKey, mode.id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [confidenceMap, setConfidenceMap] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<StudyResult | null>(null);
  const recordedRef = useRef(false);

  const item = pack.items[currentIndex];
  const progressValue = (currentIndex + 1) / pack.items.length;
  const recallChecklist = useMemo(
    () => [
      '先在脑内回忆核心意思，不要急着看答案',
      '再想它最容易和哪个词或句型混',
      '最后试着说出一个最短例句或搭配',
    ],
    [],
  );

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleMark = (confident: boolean) => {
    if (!revealed || recordedRef.current) {
      return;
    }

    const nextConfidenceMap = {
      ...confidenceMap,
      [item.id]: confident,
    };

    if (currentIndex < pack.items.length - 1) {
      setConfidenceMap(nextConfidenceMap);
      setCurrentIndex((current) => current + 1);
      setRevealed(false);
      return;
    }

    recordedRef.current = true;
    recordSession(mode.id, 'study');
    const unstableTerms = pack.items
      .filter((currentItem) => nextConfidenceMap[currentItem.id] === false)
      .map((currentItem) => currentItem.term);

    setConfidenceMap(nextConfidenceMap);
    setResult({
      solidCount: pack.items.length - unstableTerms.length,
      unstableTerms,
      recordedSessionCount: initialSessionCount + 1,
    });
  };

  return (
    <AppBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={onExit} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>退出学习包</Text>
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
            <Text style={styles.heroSource}>{pack.source}</Text>
          </View>

          <Text style={styles.heroTitle}>{mode.title}</Text>
          <Text style={styles.heroBody}>{pack.theme}</Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>{pack.items.length}</Text>
              <Text style={styles.heroMetaLabel}>本轮学习项</Text>
            </View>
            <View style={styles.heroMetaCard}>
              <Text style={styles.heroMetaValue}>
                {result?.recordedSessionCount ?? initialSessionCount}
              </Text>
              <Text style={styles.heroMetaLabel}>今日已记录轮次</Text>
            </View>
          </View>
        </View>

        {result ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>本轮记忆包已记录</Text>
            <Text style={styles.sectionBody}>
              本轮共过了 {pack.items.length} 项，标记已记住 {result.solidCount} 项，还不稳 {result.unstableTerms.length} 项。今天这个模式已累计记录 {result.recordedSessionCount} 轮。
            </Text>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>接下来怎么复习</Text>
              <Text style={styles.summaryBody}>
                {result.unstableTerms.length > 0
                  ? `今晚优先回看：${result.unstableTerms.join(' / ')}。先只回忆核心意思和易混点，不要重新全背一遍。`
                  : '这轮没有标记“不稳”项，今晚只需要用 1 分钟快速口头回忆整包即可。'}
              </Text>
              <Text style={styles.summaryFootnote}>
                明天优先从今天最容易卡住的项开始回忆，再进入新的学习包。
              </Text>
            </View>

            <Pressable
              onPress={onBackToDashboard}
              style={[styles.primaryButton, { backgroundColor: mode.accent }]}
            >
              <Text style={styles.primaryButtonText}>回到首页继续安排</Text>
            </Pressable>

            <Pressable onPress={onBackToDetail} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>回到模式详情</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.progressCard}>
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>学习进度</Text>
                <Text style={styles.progressValue}>
                  {currentIndex + 1}/{pack.items.length}
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
                先自己回忆，再展开讲解。做完整包后才会自动记录 1 次 study session。
              </Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.itemMeta}>
                第 {currentIndex + 1} 项 · {item.reading ? `${item.term}（${item.reading}）` : item.term}
              </Text>
              <Text style={styles.sectionTitle}>{item.term}</Text>
              {item.reading ? <Text style={styles.readingText}>{item.reading}</Text> : null}

              <View style={styles.promptCard}>
                <Text style={styles.promptTitle}>先自己回忆</Text>
                <Text style={styles.promptBody}>{item.reviewPrompt}</Text>
              </View>

              {!revealed ? (
                <>
                  <View style={styles.checklistCard}>
                    {recallChecklist.map((check) => (
                      <View key={check} style={styles.checkRow}>
                        <View
                          style={[
                            styles.checkDot,
                            { backgroundColor: mode.accent },
                          ]}
                        />
                        <Text style={styles.checkText}>{check}</Text>
                      </View>
                    ))}
                  </View>

                  <Pressable
                    onPress={handleReveal}
                    style={[styles.primaryButton, { backgroundColor: mode.accent }]}
                  >
                    <Text style={styles.primaryButtonText}>看讲解与记忆钩子</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>核心意思</Text>
                    <Text style={styles.analysisBody}>{item.coreMeaning}</Text>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>使用要点</Text>
                    <Text style={styles.analysisBody}>{item.keyUsage}</Text>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>易混对比</Text>
                    <Text style={styles.analysisBody}>{item.confusingPair}</Text>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>短例句</Text>
                    <Text style={styles.analysisBody}>{item.example}</Text>
                  </View>

                  <View style={styles.analysisBlock}>
                    <Text style={styles.analysisTitle}>记忆钩子</Text>
                    <Text style={styles.analysisBody}>{item.memoryHook}</Text>
                  </View>

                  <View style={styles.footerActions}>
                    <Pressable
                      onPress={() => handleMark(false)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonText}>还不稳</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleMark(true)}
                      style={[
                        styles.primaryButton,
                        { backgroundColor: mode.accent, flex: 1 },
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {currentIndex === pack.items.length - 1
                          ? '完成并自动记录'
                          : '已记住，下一项'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
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
  },
  heroMetaCard: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 14,
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
  itemMeta: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  sectionTitle: {
    color: colors.inkStrong,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  readingText: {
    color: colors.inkMuted,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  sectionBody: {
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fonts.body,
  },
  promptCard: {
    borderRadius: radii.md,
    backgroundColor: colors.slateSoft,
    padding: 16,
    gap: 8,
  },
  promptTitle: {
    color: colors.inkStrong,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  promptBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  checklistCard: {
    borderRadius: radii.md,
    backgroundColor: colors.warmCard,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  checkRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  checkText: {
    flex: 1,
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  analysisBlock: {
    borderRadius: radii.md,
    backgroundColor: colors.warmCard,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  analysisTitle: {
    color: colors.inkStrong,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  analysisBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 22,
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
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
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
