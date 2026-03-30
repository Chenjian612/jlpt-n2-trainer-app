# CLAUDE.md

This file provides working guidance for Claude Code in this repository.

## Commands

```bash
npm install
npm run dev
npm run start
npm run proxy
npm run web
npm run android
npm run ios
npm test
npm run test:web:components
npm run test:web:e2e
npm run test:web:listening
npx tsc --noEmit
```

Notes:

- `npm run dev` starts Expo and the local proxy script together.
- `npm run start` starts Expo only.
- `npm run proxy` starts `scripts/claude-proxy.js` only.
- Playwright Web tests expect the app to be available first; default `BASE_URL` is `http://127.0.0.1:19006`.

## AI Wrong-Answer Analysis

AI is used only in the wrong-review flow (`WrongReviewScreen`) for the "为什么我错了？" feature.

Environment variables:

```env
EXPO_PUBLIC_AI_API_KEY=<provider API key>
EXPO_PUBLIC_AI_PROVIDER=openai
EXPO_PUBLIC_DEEPSEEK_PROXY_URL=http://localhost:9876
```

Important details:

- Supported providers are `openai`, `deepseek`, and `claude`.
- If `EXPO_PUBLIC_AI_PROVIDER` is unset, the code defaults to `openai`.
- `EXPO_PUBLIC_DEEPSEEK_PROXY_URL` is a legacy name, but the code now treats it as a generic proxy base URL.
- For Claude on Web, using the local proxy is typically required because direct browser calls hit CORS constraints.

## Architecture

This is an Expo / React Native app with manual routing and a single global progress store.

### Entry flow

```text
App.tsx
  -> src/app/AppRoot.tsx
  -> ProgressProvider
  -> AppNavigator
  -> feature screens
```

### State flow

```text
AsyncStorage
  -> progressRepository
  -> ProgressProvider
  -> useProgressStore()
  -> feature screens
```

`ProgressProvider` hydrates from `AsyncStorage` on mount and saves back after state changes. Storage key:

```text
jlpt-n2-trainer-state-v1
```

### Navigation

`src/app/navigation/AppNavigator.tsx` manages three route shapes:

- `dashboard`
- `mode-detail`
- `training-session`

Inside `training-session`, screen selection is decided by type guards from `src/domain/models/training.ts`.

### Training modes

Nine `TrainingModeId`s are active:

- `grammar_drill`
- `grammar_study`
- `vocab_drill`
- `vocab_study`
- `official_vocab_memory`
- `reading_drill`
- `listening_analyze`
- `review_wrong`
- `vocab_review_wrong`

Screen mapping:

- drill modes -> `DrillSessionScreen`
- study modes -> `StudyPackScreen`
- official vocab -> `OfficialVocabMemoryScreen`
- reading -> `ReadingSessionScreen`
- listening -> `ListeningSessionScreen`
- review modes -> `WrongReviewScreen`

### Domain layer

- `src/domain/models/`
  - Pure types only
- `src/domain/services/progressService.ts`
  - Session recording, normalization, wrong-answer queueing, weakness tracking
- `src/domain/services/dashboardService.ts`
  - Dashboard metrics, today plan, recommendation ordering
- `src/domain/services/coachService.ts`
  - Weakness aggregation and coach snapshot
- `src/domain/services/wrongAnswerClassifier.ts`
  - Maps tags to wrong-answer / weakness error types

### ProgressState

Current shape:

```ts
{
  weeklyGoal: number;
  sessionsByDay: Record<string, TrainingSessionRecord[]>;
  wrongAnswers: WrongAnswerItem[];
  weaknessSignals: WeaknessSignalItem[];
  studyWeaknesses: StudyWeaknessItem[];
  aiExplanationCache: Record<string, AiWrongAnswerExplanation>;
}
```

Behavior summary:

- drill errors -> `wrongAnswers` -> review queue
- reading/listening mistakes -> `weaknessSignals`
- study-pack unstable items -> `studyWeaknesses`
- AI analysis responses -> `aiExplanationCache`

### Content sources

Learning content is JSON-first. TypeScript files should adapt and query JSON instead of becoming the source of truth.

| JSON file | TS loader | Purpose |
| --- | --- | --- |
| `src/data/seed/drill_questions.json` | `src/data/seed/drillQuestions.ts` | Grammar / vocab drills |
| `src/data/seed/grammar_study_items.json` | `src/data/seed/studyPacks.ts` | Grammar study items |
| `src/data/seed/n2_vocab_base.json` | `src/data/seed/extendedVocabLibrary.ts` | Base vocab library |
| `src/data/seed/official_vocab_decks.json` | `src/data/seed/officialVocabDecks.ts` | Official vocab decks |
| `src/data/seed/reading_passages.json` | `src/data/seed/readingPassages.ts` | Reading passages |
| `src/data/seed/listening_cases.json` | `src/data/seed/listeningCases.ts` | Listening cases |

Current content scale:

- 800 drill questions total (300 grammar + 500 vocab)
- 90 grammar study items
- 540 vocab items
- 6 official vocab decks / 120 cards
- 15 reading passages / 60 questions
- 23 listening cases / 26 questions (covers all 5 N2 listening question types)

### Testing

The repository does have runnable test scripts now.

- `npm test`
  - Node-side logic tests
- `npm run test:web:components`
  - Playwright component flow smoke tests
- `npm run test:web:e2e`
  - Playwright dashboard/review smoke flow
- `npm run test:web:listening`
  - Playwright listening session smoke flow (tips page, instant-reply, result screen)
- `npx tsc --noEmit`
  - TypeScript check

### Theme

All shared colors, fonts, radii, and shadows live in `src/theme/tokens.ts`. Prefer those over hardcoded values.
