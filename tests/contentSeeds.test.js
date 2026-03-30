require('sucrase/register/ts');

const assert = require('node:assert/strict');

const { EXTENDED_VOCAB_LIBRARY } = require('../src/data/seed/extendedVocabLibrary.ts');
const {
  getOfficialVocabDecks,
} = require('../src/data/seed/officialVocabDecks.ts');
const {
  getReadingPassageForSession,
  getReadingPassagesByMode,
} = require('../src/data/seed/readingPassages.ts');
const { getStudyPackByMode } = require('../src/data/seed/studyPacks.ts');

module.exports = {
  name: 'contentSeeds',
  tests: [
    {
      name: 'extended vocab library grows to the expanded target size',
      run() {
        assert.equal(EXTENDED_VOCAB_LIBRARY.length, 540);
      },
    },
    {
      name: 'grammar study rotates three-item stages across the expanded pack',
      run() {
        const stageOne = getStudyPackByMode('grammar_study', 0);
        const stageTwo = getStudyPackByMode('grammar_study', 1);

        assert.ok(stageOne);
        assert.ok(stageTwo);
        assert.equal(stageOne.items.length, 3);
        assert.equal(stageTwo.items.length, 3);
        assert.notDeepEqual(
          stageOne.items.map((item) => item.id),
          stageTwo.items.map((item) => item.id),
        );
      },
    },
    {
      name: 'official vocab memory now exposes multiple ready decks per resource type',
      run() {
        const deckCounts = getOfficialVocabDecks()
          .filter((deck) => deck.status === 'ready')
          .reduce(
            (acc, deck) => ({
              ...acc,
              [deck.type]: (acc[deck.type] || 0) + 1,
            }),
            {
              language_knowledge: 0,
              listening: 0,
              reading: 0,
            },
          );

        assert.equal(deckCounts.language_knowledge, 2);
        assert.equal(deckCounts.listening, 2);
        assert.equal(deckCounts.reading, 2);
      },
    },
    {
      name: 'reading passages rotate by session count and wrap around',
      run() {
        const passages = getReadingPassagesByMode('reading_drill');

        assert.equal(passages.length, 15);
        assert.equal(getReadingPassageForSession('reading_drill', 0)?.id, passages[0].id);
        assert.equal(getReadingPassageForSession('reading_drill', 1)?.id, passages[1].id);
        assert.equal(
          getReadingPassageForSession('reading_drill', passages.length)?.id,
          passages[0].id,
        );
      },
    },
  ],
};
