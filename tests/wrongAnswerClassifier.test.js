require('sucrase/register/ts');

const assert = require('node:assert/strict');

const {
  inferModeWeaknessErrorTypes,
  inferWrongAnswerErrorTypes,
  isWeaknessErrorType,
  isWrongAnswerErrorType,
} = require('../src/domain/services/wrongAnswerClassifier.ts');

module.exports = {
  name: 'wrongAnswerClassifier',
  tests: [
    {
      name: 'wrong answer error types are inferred from matching tags',
      run() {
        assert.deepEqual(
          inferWrongAnswerErrorTypes('grammar_drill', ['限制', 'other']),
          ['grammar_constraint'],
        );
      },
    },
    {
      name: 'wrong answer error types fall back to mode default when tags do not match',
      run() {
        assert.deepEqual(
          inferWrongAnswerErrorTypes('vocab_drill', ['unknown_tag']),
          ['vocab_context'],
        );
      },
    },
    {
      name: 'reading and listening weakness types infer from tags and defaults',
      run() {
        assert.deepEqual(
          inferModeWeaknessErrorTypes('reading_drill', ['细节题']),
          ['reading_evidence'],
        );
        assert.deepEqual(
          inferModeWeaknessErrorTypes('listening_analyze', ['unknown_tag']),
          ['listening_detail_tracking'],
        );
      },
    },
    {
      name: 'type guards accept known error types and reject unknown values',
      run() {
        assert.equal(isWrongAnswerErrorType('grammar_constraint'), true);
        assert.equal(isWrongAnswerErrorType('not_real'), false);
        assert.equal(isWeaknessErrorType('reading_evidence'), true);
        assert.equal(isWeaknessErrorType('not_real'), false);
      },
    },
  ],
};

