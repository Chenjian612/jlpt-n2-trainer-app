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
const { DRILL_QUESTIONS } = require('../src/data/seed/drillQuestions.ts');
const readingPassages = require('../src/data/seed/reading_passages.json');
const listeningCases = require('../src/data/seed/listening_cases.json');

const CHINESE_TEACHING_MARKER =
  /正确|答案|表示|这里|本句|相当于|不能|用于|强调|意思|符合|因为|所以|例如|而是|选项|复习|记住|常见|适合|对应|原文|作者|文中|关键|注意|容易|应当|可以|说明|语境|接续|含义|原因|结果|条件|判断|表达|该项|本题|不要/;

const assertChineseTeachingFields = (question, extraFields = []) => {
  const fields = [
    ['explanation', question.explanation],
    ['reviewNote', question.reviewNote],
    ...question.choiceInsights.map((value, index) => [`choiceInsights.${index}`, value]),
    ...extraFields.map((field) => [field, question[field]]),
  ];

  fields.forEach(([field, value]) => {
    assert.match(value, CHINESE_TEACHING_MARKER, `${question.id}.${field} 缺少中文讲解`);
  });
};

module.exports = {
  name: 'contentSeeds',
  tests: [
    {
      name: 'late-added grammar reading and listening sets use Chinese teaching prose',
      run() {
        DRILL_QUESTIONS.filter((question) => {
          const number = Number(question.id.replace('grammar-', ''));
          return (number >= 151 && number <= 200) || (number >= 261 && number <= 300);
        }).forEach((question) => assertChineseTeachingFields(question));

        readingPassages
          .filter((passage) => /^reading-01[1-5]$/.test(passage.id))
          .flatMap((passage) => passage.questions)
          .forEach((question) => assertChineseTeachingFields(question));

        listeningCases
          .filter((item) => /^(instant-reply|synthesis)-/.test(item.id))
          .flatMap((item) => item.questions)
          .forEach((question) =>
            assertChineseTeachingFields(question, ['trapPoint']),
          );
      },
    },
    {
      name: 'grammar explanations for Chinese beginners do not use Japanese-only prose',
      run() {
        const question = DRILL_QUESTIONS.find((item) => item.id === 'grammar-168');

        assert.ok(question);
        assert.match(question.explanation, /正因为/);
        assert.equal(question.choiceInsights.length, 4);
        question.choiceInsights.forEach((insight) => {
          assert.match(insight, /[，。；：“”]/);
          assert.match(insight, /[只正原因表相当不能无法不自然最低条件]/);
        });
      },
    },
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
