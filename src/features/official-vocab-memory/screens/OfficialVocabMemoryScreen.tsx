import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useProgressStore } from '../../../app/providers/ProgressProvider';
import { AppBackground } from '../../../components/common/AppBackground';
import {
  getOfficialVocabDeckById,
  getOfficialVocabDecksByType,
} from '../../../data/seed/officialVocabDecks';
import { getTrainingModeById } from '../../../data/seed/trainingModes';
import type {
  OfficialVocabDeck,
  OfficialVocabDeckType,
  OfficialVocabMemoryItem,
} from '../../../domain/models/trainingContent';
import type { OfficialVocabMemoryModeId } from '../../../domain/models/training';
import { getModeSessionCountForDay } from '../../../domain/services/progressService';
import { colors, fonts } from '../../../theme/tokens';

import { DeckLibrary } from '../components/DeckLibrary';
import { MemorySession, type MemoryMark } from '../components/MemorySession';
import { SessionResult } from '../components/SessionResult';

type OfficialVocabMemoryScreenProps = {
  modeId: OfficialVocabMemoryModeId;
  onExit: () => void;
  onBackToDetail: () => void;
  onBackToDashboard: () => void;
};

type MemoryResult = {
  deckTitle: string;
  knownCount: number;
  fuzzyCount: number;
  hardTerms: string[];
  recordedSessionCount: number;
};

export function OfficialVocabMemoryScreen({
  modeId,
  onExit,
  onBackToDetail,
  onBackToDashboard,
}: OfficialVocabMemoryScreenProps) {
  const { state, todayKey, recordSession } = useProgressStore();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1040;
  const mode = getTrainingModeById(modeId);
  const initialSessionCount = getModeSessionCountForDay(state, todayKey, modeId);

  const [activeType, setActiveType] = useState<OfficialVocabDeckType | 'all'>('all');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<OfficialVocabMemoryItem[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [markMap, setMarkMap] = useState<Record<string, MemoryMark>>({});
  const [result, setResult] = useState<MemoryResult | null>(null);
  const recordedRef = useRef(false);

  const visibleDecks = useMemo(() => getOfficialVocabDecksByType(activeType), [activeType]);
  const activeDeck = useMemo(
    () => (activeDeckId ? getOfficialVocabDeckById(activeDeckId) ?? null : null),
    [activeDeckId],
  );
  const currentDeckItems = useMemo(
    () => (reviewItems ? reviewItems : activeDeck?.items ?? []),
    [reviewItems, activeDeck],
  );
  const readyDeckCount = useMemo(
    () => visibleDecks.filter((deck) => deck.status === 'ready').length,
    [visibleDecks],
  );
  const currentItem = currentDeckItems[currentIndex] ?? null;

  if (!mode) {
    return (
      <AppBackground>
        <View style={styles.missingState}>
          <Text style={styles.missingTitle}>官方词卡模式暂时不可用</Text>
        </View>
      </AppBackground>
    );
  }

  const resetDeckProgress = () => {
    recordedRef.current = false;
    setCurrentIndex(0);
    setRevealed(false);
    setMarkMap({});
    setResult(null);
    setReviewItems(null);
  };

  const handleOpenDeck = (deck: OfficialVocabDeck) => {
    if (deck.status !== 'ready') return;
    resetDeckProgress();
    setActiveDeckId(deck.id);
  };

  const handleBackToLibrary = () => {
    setActiveDeckId(null);
    resetDeckProgress();
  };

  const handleStartReview = () => {
    if (!activeDeck || !result || result.hardTerms.length === 0) return;

    const itemsToReview = activeDeck.items.filter((item) =>
      result.hardTerms.includes(item.term),
    );

    setReviewItems(itemsToReview);
    setCurrentIndex(0);
    setRevealed(false);
    setMarkMap({});
    setResult(null);
    recordedRef.current = false;
  };

  const handleMark = (mark: MemoryMark) => {
    if (!currentDeckItems.length || !currentItem || !revealed || recordedRef.current) return;

    const nextMarkMap: Record<string, MemoryMark> = { ...markMap, [currentItem.id]: mark };

    if (currentIndex < currentDeckItems.length - 1) {
      setMarkMap(nextMarkMap);
      setCurrentIndex((index) => index + 1);
      setRevealed(false);
      return;
    }

    // Finished the session
    if (!reviewItems) {
      // Only record session if it's a full deck study, not a review
      recordedRef.current = true;
      recordSession(mode.id, 'study');
    }

    const hardTerms = currentDeckItems
      .filter((item) => nextMarkMap[item.id] === 'hard')
      .map((item) => item.term);
    const fuzzyCount = currentDeckItems.filter((item) => nextMarkMap[item.id] === 'fuzzy').length;
    const knownCount = currentDeckItems.filter((item) => nextMarkMap[item.id] === 'known').length;

    setMarkMap(nextMarkMap);
    setResult({
      deckTitle: reviewItems ? `复习：${activeDeck?.title ?? ''}` : activeDeck?.title ?? '',
      knownCount,
      fuzzyCount,
      hardTerms,
      recordedSessionCount: reviewItems ? result?.recordedSessionCount ?? initialSessionCount : initialSessionCount + 1,
    });
  };

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[styles.content, isWideLayout && styles.contentWide]}
        showsVerticalScrollIndicator={false}
      >
        {!activeDeck ? (
          <DeckLibrary
            mode={mode}
            activeType={activeType}
            setActiveType={setActiveType}
            visibleDecks={visibleDecks}
            readyDeckCount={readyDeckCount}
            initialSessionCount={initialSessionCount}
            recordedSessionCount={result?.recordedSessionCount ?? initialSessionCount}
            onOpenDeck={handleOpenDeck}
            onExit={onExit}
          />
        ) : result ? (
          <SessionResult
            mode={mode}
            deckTitle={result.deckTitle}
            totalItems={currentDeckItems.length}
            knownCount={result.knownCount}
            fuzzyCount={result.fuzzyCount}
            hardTerms={result.hardTerms}
            recordedSessionCount={result.recordedSessionCount}
            onBackToLibrary={handleBackToLibrary}
            onBackToDashboard={onBackToDashboard}
            onBackToDetail={onBackToDetail}
            onStartReview={handleStartReview}
            isReview={!!reviewItems}
          />
        ) : currentItem ? (
          <MemorySession
            mode={mode}
            activeDeck={activeDeck}
            currentIndex={currentIndex}
            totalItems={currentDeckItems.length}
            currentItem={currentItem}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onMark={handleMark}
            onBackToLibrary={handleBackToLibrary}
            isReview={!!reviewItems}
          />
        ) : null}
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 980,
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
    paddingHorizontal: 24,
  },
  missingTitle: {
    color: colors.inkStrong,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: fonts.title,
  },
});
