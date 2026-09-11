import { useEffect, useMemo, useRef, useState } from 'react';
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
  StudyWeaknessDraft,
} from '../../../domain/models/trainingContent';
import type { OfficialVocabMemoryModeId } from '../../../domain/models/training';
import {
  getActiveStudyWeaknesses,
  getModeSessionCountForDay,
} from '../../../domain/services/progressService';
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
};

type ReviewKind = 'scheduled' | 'immediate' | null;

export function OfficialVocabMemoryScreen({
  modeId,
  onExit,
  onBackToDetail,
  onBackToDashboard,
}: OfficialVocabMemoryScreenProps) {
  const { state, todayKey, recordStudySession } = useProgressStore();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1040;
  const mode = getTrainingModeById(modeId);
  const initialSessionCount = getModeSessionCountForDay(state, todayKey, modeId);
  const dueWeaknesses = getActiveStudyWeaknesses(state, modeId);
  const dueItemIds = new Set(dueWeaknesses.map((item) => item.id));

  const [activeType, setActiveType] = useState<OfficialVocabDeckType | 'all'>('all');
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<OfficialVocabMemoryItem[] | null>(null);
  const [reviewKind, setReviewKind] = useState<ReviewKind>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [markMap, setMarkMap] = useState<Record<string, MemoryMark>>({});
  const [result, setResult] = useState<MemoryResult | null>(null);
  const [recordedSessionCount, setRecordedSessionCount] = useState(initialSessionCount);
  const recordedRef = useRef(false);

  const readyDecks = useMemo(
    () => getOfficialVocabDecksByType('all').filter((deck) => deck.status === 'ready'),
    [],
  );
  const availableTypes = useMemo(() => {
    const types = new Set<OfficialVocabDeckType>();
    readyDecks.forEach((deck) => types.add(deck.type));
    return ['all', ...Array.from(types)] as Array<OfficialVocabDeckType | 'all'>;
  }, [readyDecks]);
  const visibleDecks = useMemo(() => {
    const filtered = activeType === 'all'
      ? readyDecks
      : readyDecks.filter((deck) => deck.type === activeType);
    return [...filtered].sort((left, right) => {
      const leftDue = left.items.filter((item) => dueItemIds.has(item.id)).length;
      const rightDue = right.items.filter((item) => dueItemIds.has(item.id)).length;
      return rightDue - leftDue;
    });
  }, [activeType, readyDecks, dueWeaknesses]);
  const activeDeck = useMemo(
    () => (activeDeckId ? getOfficialVocabDeckById(activeDeckId) ?? null : null),
    [activeDeckId],
  );
  const currentDeckItems = useMemo(
    () => (reviewItems ? reviewItems : activeDeck?.items ?? []),
    [reviewItems, activeDeck],
  );
  const readyDeckCount = useMemo(() => readyDecks.length, [readyDecks]);
  const currentItem = currentDeckItems[currentIndex] ?? null;

  useEffect(() => {
    if (!availableTypes.includes(activeType)) {
      setActiveType('all');
    }
  }, [activeType, availableTypes]);

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
    setReviewKind(null);
  };

  const handleOpenDeck = (deck: OfficialVocabDeck) => {
    if (deck.status !== 'ready') return;
    resetDeckProgress();
    setActiveDeckId(deck.id);
    const scheduledItems = deck.items.filter((item) => dueItemIds.has(item.id));
    if (scheduledItems.length > 0) {
      setReviewItems(scheduledItems);
      setReviewKind('scheduled');
    }
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
    setReviewKind('immediate');
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

    // Full-deck study and scheduled review both advance persistent spacing.
    // Immediate same-session retry is feedback only, so it does not skip a box.
    if (reviewKind !== 'immediate') {
      recordedRef.current = true;
      const studyWeaknesses: StudyWeaknessDraft[] = currentDeckItems.map((item) => ({
        item: {
          ...item,
          modeId,
          confusingPair: item.sourceHint,
          reviewPrompt: `看到「${item.term}」时，先回忆读音、核心义和常见搭配。`,
        },
        wasConfident: nextMarkMap[item.id] === 'known',
      }));
      recordStudySession(modeId, studyWeaknesses);
      setRecordedSessionCount((count) => count + 1);
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
            availableTypes={availableTypes}
            setActiveType={setActiveType}
            visibleDecks={visibleDecks}
            readyDeckCount={readyDeckCount}
            initialSessionCount={initialSessionCount}
            recordedSessionCount={recordedSessionCount}
            dueItemIds={[...dueItemIds]}
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
            recordedSessionCount={recordedSessionCount}
            onBackToLibrary={handleBackToLibrary}
            onBackToDashboard={onBackToDashboard}
            onBackToDetail={onBackToDetail}
            onStartReview={handleStartReview}
            isReview={reviewKind !== null}
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
            isReview={reviewKind !== null}
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



