# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies
npm run start        # start Expo dev server (Metro on port 8081)
npm run web          # start web target
npm run android      # run on Android
npm run ios          # run on iOS
```

There is no test runner configured. Playwright is installed for browser-level smoke tests but there are no test scripts in `package.json` — tests are run manually.

TypeScript checking:
```bash
npx tsc --noEmit
```

## Architecture

This is an Expo / React Native app (Expo 54, React 19, TypeScript) with no navigation library — routing is handled manually via a `Route` union type in `AppNavigator`.

### Data flow

```
AsyncStorage
  └─ progressRepository (load/save JSON)
       └─ ProgressProvider (React Context)
            └─ useProgressStore() hook
                 └─ Feature screens
```

`ProgressProvider` (`src/app/providers/ProgressProvider.tsx`) is the single global store. It hydrates from `AsyncStorage` on mount (key: `jlpt-n2-trainer-state-v1`) and saves on every state change. All mutations go through typed action methods exposed by the context (`recordSession`, `recordDrillSession`, `recordStudySession`, `completeWrongReviewSession`, etc.).

### Navigation

`AppNavigator` (`src/app/navigation/AppNavigator.tsx`) manages a `Route` state with three shapes: `dashboard`, `mode-detail`, and `training-session`. Screen selection inside `training-session` is determined by type-guard functions (`isDrillModeId`, `isReadingModeId`, etc.) from `src/domain/models/training.ts`.

### Domain layer

- **`src/domain/models/`** — pure types: `TrainingModeId` union, `ProgressState`, `TrainingSessionRecord`, `WeaknessFocusItem`, etc. No logic here.
- **`src/domain/services/progressService.ts`** — all state mutation logic (pure functions). This is where session recording, wrong-answer accumulation, weakness signal tracking, and study-weakness staging happen.
- **`src/domain/services/dashboardService.ts`** — computes `DashboardInsight`, `DashboardMetrics`, recommended mode order, etc. from `ProgressState`.
- **`src/domain/services/coachService.ts`** — aggregates weakness signals from drill, reading, and listening for the homepage coach card.
- **`src/domain/services/wrongAnswerClassifier.ts`** — classifies wrong answers into `WeaknessErrorType` categories.

### Training modes

Nine modes are defined in `src/data/seed/trainingModes.ts` as `TrainingMode[]`. Each mode has an `id: TrainingModeId` which determines which screen handles it:

| ModeId | Screen |
|---|---|
| `grammar_drill`, `vocab_drill` | `DrillSessionScreen` |
| `reading_drill` | `ReadingSessionScreen` |
| `listening_analyze` | `ListeningSessionScreen` |
| `official_vocab_memory` | `OfficialVocabMemoryScreen` |
| `review_wrong`, `vocab_review_wrong` | `WrongReviewScreen` |
| `grammar_study`, `vocab_study` | `StudyPackScreen` |

### `ProgressState` structure

```ts
{
  weeklyGoal: number;
  sessionsByDay: Record<string, TrainingSessionRecord[]>;  // keyed by "YYYY-MM-DD"
  wrongAnswers: WrongAnswerItem[];      // grammar/vocab drill errors → review queue
  weaknessSignals: WeaknessSignalItem[]; // reading/listening question-level errors
  studyWeaknesses: StudyWeaknessItem[]; // study-pack self-marked unstable items
}
```

### Weakness system

- **Drill errors** → `wrongAnswers[]` → `WrongReviewScreen` (priority-sorted queue)
- **Reading/listening errors** → `weaknessSignals[]` → aggregated by `coachService` → shown in `WeaknessCoachCard` on the dashboard
- **Study pack self-assessment** → `studyWeaknesses[]` → dynamically staged to front of next study session

### Theme

All colors, fonts, radii, and shadows live in `src/theme/tokens.ts`. Import from there — do not hardcode color values in component files.
