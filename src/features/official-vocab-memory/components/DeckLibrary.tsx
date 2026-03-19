import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, shadows } from '../../../theme/tokens';
import type { OfficialVocabDeck, OfficialVocabDeckType } from '../../../domain/models/trainingContent';
import type { TrainingMode } from '../../../domain/models/training';
import { getRepoUrl } from '../../../data/seed/officialResourceAdapter';

type DeckLibraryProps = {
  mode: TrainingMode;
  activeType: OfficialVocabDeckType | 'all';
  availableTypes: Array<OfficialVocabDeckType | 'all'>;
  setActiveType: (type: OfficialVocabDeckType | 'all') => void;
  visibleDecks: OfficialVocabDeck[];
  readyDeckCount: number;
  initialSessionCount: number;
  recordedSessionCount: number;
  onOpenDeck: (deck: OfficialVocabDeck) => void;
  onExit: () => void;
};

const TYPE_LABELS: Record<OfficialVocabDeckType | 'all', string> = {
  all: '全部',
  language_knowledge: '文字・语彙',
  listening: '听力',
  reading: '读解',
};

const TYPE_BODIES: Record<OfficialVocabDeckType | 'all', string> = {
  all: '按题型筛词卡。当前只展示有明确官方来源或已标注待导入的资源包。',
  language_knowledge: '以后用于承接官方语言知识下载包整理出的文字、词汇高频词。',
  listening: '优先记官方公开音频里反复出现的资料、安排、决定类高频词。',
  reading: '以后用于承接官方读解下载包里的论证词、提示词和干扰项词。',
};

const DECK_STATUS_LABEL: Record<OfficialVocabDeck['status'], string> = {
  ready: '已接入',
  pending: '待导入',
};

const DECK_STATUS_BODY: Record<OfficialVocabDeck['status'], string> = {
  ready: '可以直接开卡记忆，本轮结束后会自动记 1 轮学习记录。',
  pending: '仓库当前没有对应的官方下载包，本入口先保留，不乱写来源。',
};

export function DeckLibrary({
  mode,
  activeType,
  availableTypes,
  setActiveType,
  visibleDecks,
  readyDeckCount,
  initialSessionCount,
  recordedSessionCount,
  onOpenDeck,
  onExit,
}: DeckLibraryProps) {
  const handleOpenSource = () => {
    Linking.openURL(getRepoUrl()).catch((err) =>
      console.error('Failed to open GitHub:', err),
    );
  };

  return (
    <>
      <View style={styles.header}>
        <Pressable onPress={onExit} style={styles.ghostButton}>
          <Text style={styles.ghostButtonText}>退出官方词卡</Text>
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
          <Text style={styles.heroSource}>{mode.sourceLabel}</Text>
        </View>

        <Text style={styles.heroTitle}>{mode.title}</Text>
        <Text style={styles.heroBody}>{mode.detailIntro}</Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaCard}>
            <Text style={styles.heroMetaValue}>{readyDeckCount}</Text>
            <Text style={styles.heroMetaLabel}>当前可开卡词包</Text>
          </View>
          <View style={styles.heroMetaCard}>
            <Text style={styles.heroMetaValue}>{recordedSessionCount || initialSessionCount}</Text>
            <Text style={styles.heroMetaLabel}>今日已记录轮次</Text>
          </View>
        </View>

        <View style={styles.heroAgendaCard}>
          <Text style={styles.heroAgendaEyebrow}>来源规则</Text>
          <Text style={styles.heroAgendaText}>
            只收官方公开可下载资源整理出的词卡。没有本地官方下载包的题型，会明确显示待导入，不伪造来源。
          </Text>
          <Text style={styles.heroAgendaFootnote}>
            当前筛选：{TYPE_LABELS[activeType]} · {TYPE_BODIES[activeType]}
          </Text>
        </View>
      </View>

      <View style={[styles.sectionCard, shadows.card]}>
        <Text style={styles.sectionTitle}>按题型筛词卡</Text>
        <Text style={styles.sectionBody}>
          系统已与 GitHub 资源仓库联动。你可以通过下方筛选进入对应词包，或直接访问资源库查看原始 PDF 和音频。
        </Text>
        <View style={styles.filterRow}>
          {availableTypes.map((type) => {
            const active = type === activeType;
            return (
              <Pressable
                testID={`official-filter-${type}`}
                key={type}
                onPress={() => setActiveType(type)}
                style={[
                  styles.filterPill,
                  active && { backgroundColor: mode.surface, borderColor: mode.accent },
                ]}
              >
                <Text style={[styles.filterText, active && { color: mode.accent }]}>
                  {TYPE_LABELS[type]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.deckList}>
        {visibleDecks.map((deck) => (
          <View key={deck.id} style={[styles.deckCard, shadows.card]}>
            <View style={styles.deckTop}>
              <View style={styles.deckTitleBlock}>
                <View style={styles.deckBadgeRow}>
                  <View style={[styles.deckChip, { backgroundColor: mode.surface }]}>
                    <Text style={[styles.deckChipText, { color: mode.accent }]}>
                      {TYPE_LABELS[deck.type]}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      deck.status === 'ready'
                        ? { backgroundColor: mode.surface }
                        : styles.pendingPill,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        deck.status === 'ready' ? { color: mode.accent } : styles.pendingText,
                      ]}
                    >
                      {DECK_STATUS_LABEL[deck.status]}
                    </Text>
                  </View>
                </View>
                <Text style={styles.deckTitle}>{deck.title}</Text>
                <Text style={styles.deckBody}>{deck.description}</Text>
              </View>
              <View style={styles.deckMetaCard}>
                <Text style={styles.deckMetaValue}>
                  {deck.status === 'ready' ? deck.items.length : '--'}
                </Text>
                <Text style={styles.deckMetaLabel}>
                  {deck.status === 'ready' ? '词卡数' : '待导入'}
                </Text>
              </View>
            </View>

            <View style={styles.deckInfoCard}>
              <Text style={styles.deckInfoTitle}>资源映射状态</Text>
              <Text style={styles.deckInfoBody}>{deck.downloadLabel}</Text>
              <Pressable onPress={handleOpenSource} style={styles.sourceLinkRow}>
                <Text style={styles.deckInfoFootnote}>数据源：{deck.source}</Text>
                <Text style={styles.linkText}>在 GitHub 查看 ↗</Text>
              </Pressable>
            </View>

            <Text style={styles.deckNote}>{deck.note}</Text>
            <Text style={styles.deckStatusHint}>{DECK_STATUS_BODY[deck.status]}</Text>

            <Pressable
              testID={`official-open-deck-${deck.id}`}
              onPress={() => onOpenDeck(deck)}
              disabled={deck.status !== 'ready'}
              style={[
                styles.primaryButton,
                deck.status === 'ready'
                  ? { backgroundColor: mode.accent }
                  : styles.disabledButton,
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  deck.status !== 'ready' && styles.disabledButtonText,
                ]}
              >
                {deck.status === 'ready' ? `开始背 ${deck.shortLabel}` : '等待导入资源'}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
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
  heroCard: {
    borderRadius: 30,
    padding: 24,
    gap: 18,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
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
    color: '#DFFAF6',
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
    color: '#F0FDFA',
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
    color: '#CCFBF1',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  heroAgendaCard: {
    borderRadius: radii.md,
    padding: 16,
    gap: 8,
    backgroundColor: 'rgba(8, 56, 50, 0.3)',
  },
  heroAgendaEyebrow: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  heroAgendaText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  heroAgendaFootnote: {
    color: '#D1FAE5',
    fontSize: 12,
    lineHeight: 18,
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
  sectionTitle: {
    color: colors.inkStrong,
    fontSize: 22,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  sectionBody: {
    color: colors.inkBody,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.backgroundCardMuted,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterText: {
    color: colors.inkBody,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  deckList: {
    gap: 16,
  },
  deckCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radii.lg,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  deckTop: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  deckTitleBlock: {
    flex: 1,
    gap: 6,
  },
  deckBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  deckChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  deckChipText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  statusPill: {
    borderRadius: radii.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  pendingPill: {
    backgroundColor: colors.slateSoft,
  },
  pendingText: {
    color: colors.inkMuted,
  },
  deckTitle: {
    color: colors.inkStrong,
    fontSize: 21,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  deckBody: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  deckMetaCard: {
    minWidth: 84,
    borderRadius: radii.md,
    backgroundColor: colors.backgroundCardMuted,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 3,
  },
  deckMetaValue: {
    color: colors.inkStrong,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
  deckMetaLabel: {
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  deckInfoCard: {
    borderRadius: radii.md,
    backgroundColor: colors.backgroundCardMuted,
    padding: 14,
    gap: 4,
  },
  deckInfoTitle: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
  },
  deckInfoBody: {
    color: colors.inkStrong,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  deckInfoFootnote: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.body,
  },
  sourceLinkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  linkText: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.body,
    textDecorationLine: 'underline',
  },
  deckNote: {
    color: colors.inkBody,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.body,
  },
  deckStatusHint: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 20,
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
  disabledButton: {
    backgroundColor: colors.slateSoft,
  },
  disabledButtonText: {
    color: colors.inkMuted,
  },
});
