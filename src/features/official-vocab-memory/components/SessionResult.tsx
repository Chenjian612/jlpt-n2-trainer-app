import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';
import type { TrainingMode } from '../../../domain/models/training';

type SessionResultProps = {
  mode: TrainingMode;
  deckTitle: string;
  totalItems: number;
  knownCount: number;
  fuzzyCount: number;
  hardTerms: string[];
  recordedSessionCount: number;
  onBackToLibrary: () => void;
  onBackToDashboard: () => void;
  onBackToDetail: () => void;
  onStartReview: () => void;
  isReview?: boolean;
};

export function SessionResult({
  mode,
  deckTitle,
  totalItems,
  knownCount,
  fuzzyCount,
  hardTerms,
  recordedSessionCount,
  onBackToLibrary,
  onBackToDashboard,
  onBackToDetail,
  onStartReview,
  isReview,
}: SessionResultProps) {
  return (
    <View style={[styles.sectionCard, styles.resultCard, shadows.card]}>
      <Text style={styles.sectionTitle}>
        {isReview ? '难记词复习完成' : '本轮官方词卡完成'}
      </Text>
      <Text style={styles.sectionBody}>
        {isReview
          ? `针对刚才明显没记住的 ${totalItems} 个词完成了强化。其中已记住 ${knownCount} 项，仍有 ${hardTerms.length} 项较难。`
          : `《${deckTitle}》已经写入今日进度。你这轮一共过了 ${totalItems} 张卡，其中已记住 ${knownCount} 项、模糊 ${fuzzyCount} 项、明显没记住 ${hardTerms.length} 项。`}
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>下一步建议</Text>
        <Text style={styles.summaryBody}>
          {hardTerms.length > 0
            ? isReview
              ? '还有几个词没吃透，建议退出后明天再开一包类似的，或者去听对应的音频原题。'
              : `先把这些词单独回看一遍：${hardTerms.join(' / ')}。或者直接点击下方按钮开始强化复习。`
            : '这轮没有明显卡住的词。今晚只需要用 1 分钟口头回忆每张卡的核心义和出现题型。'}
        </Text>
      </View>

      {!isReview && hardTerms.length > 0 && (
        <Pressable
          onPress={onStartReview}
          style={[styles.primaryButton, { backgroundColor: colors.copper }]}
        >
          <Text style={styles.primaryButtonText}>立即再次复习难记词 ({hardTerms.length})</Text>
        </Pressable>
      )}

      <Pressable
        onPress={onBackToLibrary}
        style={[styles.primaryButton, { backgroundColor: mode.accent }]}
      >
        <Text style={styles.primaryButtonText}>
          {isReview ? '回到词卡库' : '继续选包'}
        </Text>
      </Pressable>

      <Pressable onPress={onBackToDashboard} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>继续今天的安排</Text>
      </Pressable>

      <Pressable onPress={onBackToDetail} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>回到模式页</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  resultCard: {
    gap: 16,
    paddingVertical: 24,
  },
  sectionTitle: {
    color: colors.inkStrong,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.title,
    textAlign: 'center',
  },
  sectionBody: {
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
    textAlign: 'center',
  },
  summaryCard: {
    borderRadius: radii.md,
    backgroundColor: colors.warmCard,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    padding: 16,
    gap: 8,
  },
  summaryTitle: {
    color: colors.copper,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  summaryBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  summaryFootnote: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.backgroundCardMuted,
    borderRadius: radii.md,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: colors.inkStrong,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  statLabel: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
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
  secondaryButton: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundCard,
  },
  secondaryButtonText: {
    color: colors.inkBody,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
});
