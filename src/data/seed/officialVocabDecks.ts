import type {
  OfficialVocabDeck,
  OfficialVocabDeckType,
} from '../../domain/models/trainingContent';
import { OFFICIAL_RESOURCES } from './officialResourceAdapter';
import officialVocabDecksData from './official_vocab_decks.json';

const getResourceLabel = (section: string) =>
  OFFICIAL_RESOURCES.find(r => r.section === section)?.label ?? '官方样题资源';

type OfficialVocabDeckRaw = Omit<OfficialVocabDeck, 'source'> & { sourceSection: string };

const OFFICIAL_VOCAB_DECKS: OfficialVocabDeck[] = (
  officialVocabDecksData as OfficialVocabDeckRaw[]
).map(deck => ({
  ...deck,
  source: getResourceLabel(deck.sourceSection),
}));

export const OFFICIAL_VOCAB_DECK_TYPES: Array<OfficialVocabDeckType | 'all'> = [
  'all',
  'language_knowledge',
  'listening',
  'reading',
];

export const getOfficialVocabDecks = (): OfficialVocabDeck[] => OFFICIAL_VOCAB_DECKS;

export const getOfficialVocabDeckById = (
  deckId: string,
): OfficialVocabDeck | undefined =>
  OFFICIAL_VOCAB_DECKS.find((deck) => deck.id === deckId);

export const getOfficialVocabDecksByType = (
  type: OfficialVocabDeckType | 'all',
): OfficialVocabDeck[] =>
  type === 'all'
    ? OFFICIAL_VOCAB_DECKS
    : OFFICIAL_VOCAB_DECKS.filter((deck) => deck.type === type);
