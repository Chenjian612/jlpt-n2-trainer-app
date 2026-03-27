# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies
npm run dev          # 【推荐】一键启动：AI 代理(9876) + Expo(8081)
npm run start        # 仅启动 Expo dev server（不含 AI 代理，AI 功能不可用）
npm run proxy        # 仅启动 AI 代理（port 9876）
npm run web          # start web target
npm run android      # run on Android
npm run ios          # run on iOS
```

## AI 错题解释功能说明

AI 功能依赖本地代理绕过 CORS 限制。**每次开发必须同时启动代理**，否则"为什么我错了"按钮会报错。

`npm run dev` 会同时启动代理和 Expo，**始终用这个命令代替 `npm run start`**。

配置文件 `.env.local`（不提交 git）：
```
EXPO_PUBLIC_AI_API_KEY=<DeepSeek API Key>
EXPO_PUBLIC_AI_PROVIDER=deepseek
EXPO_PUBLIC_DEEPSEEK_PROXY_URL=http://localhost:9876
```

代理脚本：`scripts/claude-proxy.js`（监听 9876，转发至对应 AI API）

外网访问：在第二个终端运行 `npx cloudflared tunnel --url http://localhost:8081`，把生成的 `https://` 地址发给其他设备即可。详见 `DEV_STARTUP.md`。

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

### Feature structure

Each feature under `src/features/<feature-name>/` follows: `screens/` (top-level route targets), `components/` (local UI), `hooks/` (view-model logic). Dashboard uses `useDashboardViewModel` to separate data from rendering.

### Content data conventions

**All learning content lives in JSON files; TypeScript files only load and query them.**

| JSON file | TS loader | Content |
|---|---|---|
| `seed/drill_questions.json` | `seed/drillQuestions.ts` | Grammar/vocab drill questions |
| `seed/n2_vocab_base.json` | `seed/extendedVocabLibrary.ts` | N2 vocab (500+ items) |
| `seed/reading_passages.json` | `seed/readingPassages.ts` | Reading passages |
| `seed/listening_cases.json` | `seed/listeningCases.ts` | Listening cases |
| `seed/official_vocab_decks.json` | `seed/officialVocabDecks.ts` | Official vocab decks |
| `seed/grammar_study_items.json` | `seed/studyPacks.ts` | Grammar study pack items |

Do **not** inline data arrays in `.ts` files. All types are in `src/domain/models/trainingContent.ts`.

**Drill question `id` format:** `"grammar-xxx"` or `"vocab-xxx"`. `modeId` must be `"grammar_drill"` or `"vocab_drill"`.

**Listening audio:** React Native requires static `require()` strings. JSON stores an `audioKey` string (e.g. `"N2M1Q2"`); the actual `require()` mapping lives in the `AUDIO_ASSETS` object in `listeningCases.ts`. Adding a new audio file requires updating both the JSON and `AUDIO_ASSETS`.

**Official vocab decks:** JSON uses `sourceSection` (`"vocabulary"` | `"grammar"` | `"reading"` | `"listening"`), not `source`. The loader resolves it via `getResourceLabel()`.

### Config

Tunable constants (batch sizes, priority weights, spaced-repetition intervals, mastery thresholds) are in `src/config/constants.ts` as `APP_CONFIG`.

### Theme

All colors, fonts, radii, and shadows live in `src/theme/tokens.ts`. Import from there — do not hardcode color values in component files.
