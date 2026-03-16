import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';
import type { OfficialVocabDeck, OfficialVocabMemoryItem } from '../../../domain/models/trainingContent';
import type { TrainingMode } from '../../../domain/models/training';

export type MemoryMark = 'hard' | 'fuzzy' | 'known';

type MemorySessionProps = {
  mode: TrainingMode;
  activeDeck: OfficialVocabDeck;
  currentIndex: number;
  totalItems: number;
  currentItem: OfficialVocabMemoryItem;
  revealed: boolean;
  onReveal: () => void;
  onMark: (mark: MemoryMark) => void;
  onBackToLibrary: () => void;
  isReview?: boolean;
};

export function MemorySession({
  mode,
  activeDeck,
  currentIndex,
  totalItems,
  currentItem,
  revealed,
  onReveal,
  onMark,
  onBackToLibrary,
  isReview,
}: MemorySessionProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    // Reset and start animation whenever currentItem or revealed state changes
    fadeAnim.setValue(0);
    slideAnim.setValue(10);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentItem.id, revealed]);

  return (
    <>
      <View style={styles.header}>
        <Pressable onPress={onBackToLibrary} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>返回词卡库</Text>
        </Pressable>
        <Text style={styles.headerTag}>
          {isReview ? '难记词复习' : activeDeck.shortLabel} · 记忆中
        </Text>
      </View>

      <View style={[styles.progressCard, shadows.card]}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {isReview ? '复习进度' : '当前词包进度'}
          </Text>
          <Text style={styles.progressValue}>
            {currentIndex + 1}/{totalItems}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((currentIndex + 1) / totalItems) * 100}%`,
                backgroundColor: isReview ? colors.copper : mode.accent,
              },
            ]}
          />
        </View>
        <Text style={styles.progressHint}>
          {isReview
            ? '针对刚才没记住的词进行强化。完成后可以选择回到词卡库。'
            : '先自己回忆，再展开讲解；完整过完一包后才会自动记 1 轮学习记录。'}
        </Text>
      </View>

      <Animated.View
        style={[
          styles.sectionCard,
          styles.itemCard,
          shadows.card,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={styles.itemMeta}>
          《{activeDeck.title}》· 第 {currentIndex + 1} 张
        </Text>
        <Text style={styles.itemTerm}>{currentItem.term}</Text>
        <Text style={styles.itemReading}>{currentItem.reading}</Text>

        {!revealed ? (
          <>
            <View style={styles.promptCard}>
              <Text style={styles.promptTitle}>先自己回忆</Text>
              <Text style={styles.promptBody}>
                想它的核心义、最自然的使用场景，以及它最常出现的题型。
              </Text>
              <Text style={styles.promptFootnote}>{currentItem.sourceHint}</Text>
            </View>

            <View style={styles.checklistCard}>
              <View style={styles.checkRow}>
                <View style={[styles.checkDot, { backgroundColor: mode.accent }]} />
                <Text style={styles.checkText}>读音 → 中文核心义</Text>
              </View>
              <View style={styles.checkRow}>
                <View style={[styles.checkDot, { backgroundColor: mode.accent }]} />
                <Text style={styles.checkText}>常用动作或绑定场景</Text>
              </View>
              <View style={styles.checkRow}>
                <View style={[styles.checkDot, { backgroundColor: mode.accent }]} />
                <Text style={styles.checkText}>所属官方题型</Text>
              </View>
            </View>

            <Pressable
              onPress={onReveal}
              style={[styles.primaryButton, { backgroundColor: mode.accent }]}
            >
              <Text style={styles.primaryButtonText}>看讲解与记忆钩子</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.revealContent}>
            <View style={styles.analysisBlock}>
              <Text style={styles.analysisTitle}>核心意思</Text>
              <Text style={styles.analysisBody}>{currentItem.coreMeaning}</Text>
            </View>

            <View style={styles.analysisBlock}>
              <Text style={styles.analysisTitle}>使用要点</Text>
              <Text style={styles.analysisBody}>{currentItem.keyUsage}</Text>
            </View>

            <View style={styles.analysisBlock}>
              <Text style={styles.analysisTitle}>短例句</Text>
              <Text style={styles.analysisBody}>{currentItem.example}</Text>
            </View>

            <View style={styles.analysisBlock}>
              <Text style={styles.analysisTitle}>记忆钩子</Text>
              <Text style={styles.analysisBody}>{currentItem.memoryHook}</Text>
            </View>

            <View style={styles.analysisBlock}>
              <Text style={styles.analysisTitle}>出处提示</Text>
              <Text style={styles.analysisBody}>{currentItem.sourceHint}</Text>
            </View>

            <View style={styles.markGrid}>
              <Pressable
                onPress={() => onMark('hard')}
                style={[styles.markButton, styles.markButtonHard]}
              >
                <Text style={styles.markButtonText}>没记住</Text>
              </Pressable>
              <Pressable
                onPress={() => onMark('fuzzy')}
                style={[styles.markButton, styles.markButtonFuzzy]}
              >
                <Text style={styles.markButtonTextMuted}>模糊</Text>
              </Pressable>
              <Pressable
                onPress={() => onMark('known')}
                style={[styles.markButton, { backgroundColor: mode.accent }]}
              >
                <Text style={styles.markButtonText}>
                  {currentIndex === activeDeck.items.length - 1 ? '完成本包' : '记住了'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
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
  progressCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    color: colors.inkStrong,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  progressValue: {
    color: colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.barIdle,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
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
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  itemCard: {
    gap: 16,
    paddingVertical: 24,
  },
  itemMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
    textAlign: 'center',
  },
  itemTerm: {
    color: colors.inkStrong,
    fontSize: 32,
    fontWeight: '800',
    fontFamily: fonts.title,
    textAlign: 'center',
  },
  itemReading: {
    color: colors.teal,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.body,
    textAlign: 'center',
    marginTop: -8,
  },
  promptCard: {
    borderRadius: radii.md,
    backgroundColor: colors.warmCard,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: 16,
    gap: 6,
  },
  promptTitle: {
    color: colors.copper,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  promptBody: {
    color: colors.inkStrong,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  promptFootnote: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  checklistCard: {
    borderRadius: radii.md,
    backgroundColor: colors.mist,
    padding: 16,
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  checkText: {
    color: colors.inkBody,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: fonts.body,
  },
  primaryButton: {
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  revealContent: {
    gap: 16,
  },
  analysisBlock: {
    borderRadius: radii.md,
    backgroundColor: colors.backgroundCardMuted,
    padding: 14,
    gap: 6,
  },
  analysisTitle: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  analysisBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  markGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  markButton: {
    flex: 1,
    borderRadius: radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markButtonHard: {
    backgroundColor: '#991B1B', // Darker red
  },
  markButtonFuzzy: {
    backgroundColor: colors.slateSoft,
  },
  markButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  markButtonTextMuted: {
    color: colors.inkBody,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
});
