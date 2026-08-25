# 学习资源数据规范 (Data Conventions)

## 核心原则

**所有学习内容数据必须存放在 JSON 文件中，TypeScript 文件只负责加载数据和提供查询函数。**

- 面向学习者的 `explanation`、`choiceInsights`、`reviewNote`、`trapPoint` 等教学字段必须使用简明中文。
- 日语只保留题目/原文证据、语法形式、词语或短例句；不直观的日语内容须在同一项紧跟中文释义。
- 禁止在教学字段中使用只有日语、没有中文说明的整句或整段解析。

---

## 文件对应关系

| JSON 数据文件 | TS 加载文件 | 内容说明 |
|---|---|---|
| `seed/n2_vocab_base.json` | `seed/extendedVocabLibrary.ts` | N2 核心词汇库（500+ 条） |
| `seed/drill_questions.json` | `seed/drillQuestions.ts` | 语法 / 词汇刷题题目 |
| `seed/reading_passages.json` | `seed/readingPassages.ts` | 读解文章及题目 |
| `seed/listening_cases.json` | `seed/listeningCases.ts` | 听力案例（含 audioKey） |
| `seed/official_vocab_decks.json` | `seed/officialVocabDecks.ts` | 官方样题词卡 deck |
| `seed/grammar_study_items.json` | `seed/studyPacks.ts` | 文法学习包条目 |

> AI RAG 扩展说明：现有 seed 数据继续作为训练内容来源。后续若增加结构化 AI 知识库，建议优先新增独立 JSON 文件，例如 `ai_grammar_knowledge.json`、`ai_vocab_knowledge.json`、`ai_question_mappings.json`，不要把 RAG 专用字段直接散落到多个 TS 文件中。总体方案见仓库根目录的 `AI-RAG-LEARNING-PLAN.md`。

---

## 新增内容时的操作步骤

### 1. 词汇（vocab）
编辑 `seed/n2_vocab_base.json`，追加符合 `OfficialVocabMemoryItem` 类型的对象：
```json
{
  "id": "n2-vocab-xxx",
  "term": "単語",
  "reading": "たんご",
  "coreMeaning": "含义说明。",
  "keyUsage": "搭配说明。",
  "example": "例文。中文翻译。",
  "memoryHook": "记忆提示。"
}
```
**不要**在 `extendedVocabLibrary.ts` 或 `studyPacks.ts` 里直接写词汇数组。

### 2. 文法 / 词汇刷题题目（drill）
编辑 `seed/drill_questions.json`，追加符合 `DrillQuestion` 类型的对象：
```json
{
  "id": "grammar-xxx",
  "modeId": "grammar_drill",
  "prompt": "题目句子___。",
  "choices": ["选项A", "选项B", "选项C", "选项D"],
  "answer": 0,
  "explanation": "解析说明。",
  "choiceInsights": ["A解析", "B解析", "C解析", "D解析"],
  "reviewNote": "复习提示。",
  "tags": ["文法", "句型名", "考点"],
  "source": "N2 文法迷你题组 X"
}
```
`modeId` 只能为 `"grammar_drill"` 或 `"vocab_drill"`。

### 3. 读解文章（reading）
编辑 `seed/reading_passages.json`，追加符合 `ReadingPassage` 类型的对象。
每篇文章包含 `paragraphs`（段落数组）和 `questions`（题目数组）。

### 4. 听力案例（listening）
编辑 `seed/listening_cases.json`。

> **特别注意：音频资源的处理**
> React Native 的打包器要求 `require()` 必须是静态字符串字面量，不能动态拼接路径。
> 因此 JSON 里**不存放** `require()` 结果，而是存放 `audioKey` 字符串：
> ```json
> { "audioKey": "N2M1Q2", ... }
> ```
> 对应的 `require()` 静态映射在 `listeningCases.ts` 的 `AUDIO_ASSETS` 对象中维护。
> **每次新增听力音频文件，必须同时在 `AUDIO_ASSETS` 里添加对应的 key-require 对。**

`audioKey` 命名规范：使用音频文件名（不含扩展名），例如 `N2M1Q2`、`N2M2Q2`。

### 5. 官方词卡 deck（official vocab decks）
编辑 `seed/official_vocab_decks.json`。

> **特别注意：source 字段的处理**
> JSON 里存放 `sourceSection` 而非 `source`，值为 `"vocabulary"` / `"grammar"` / `"reading"` / `"listening"` 之一。
> `source` 字符串在 `officialVocabDecks.ts` 加载时通过 `getResourceLabel(sourceSection)` 自动 resolve。

### 6. 文法学习包条目（grammar study items）
编辑 `seed/grammar_study_items.json`，追加符合 `StudyPackItem` 类型的对象。

---

## TS 加载文件的编写规范

TS 文件**只允许**包含以下内容，不得内联任何内容数据：

```typescript
// ✅ 允许的内容
import type { SomeType } from '../../domain/models/trainingContent';
import data from './some_data.json';           // JSON import
import { SOME_DEPENDENCY } from './other';     // 依赖 import

const DATA: SomeType[] = data as SomeType[];  // 类型转换

// 查询 / 转换函数
export const getXxxByMode = (...) => ...;
export const getXxxForSession = (...) => ...;
```

```typescript
// ❌ 禁止的内容
const DATA: SomeType[] = [
  { id: 'xxx', term: '...', ... },  // 内联数据数组
];
```

---

## JSON 文件的格式要求

- 使用 2 空格缩进
- 所有字段名使用 camelCase
- 数组最后一项不加逗号（标准 JSON）
- 文件以换行符结尾
- 多行字符串（如长文章段落）使用单个 JSON 字符串，不要拆行

---

## 类型参考

所有数据类型定义在 `src/domain/models/trainingContent.ts`，添加内容前请先确认字段类型。

| 数据类型 | TypeScript 类型名 |
|---|---|
| 词汇条目 | `OfficialVocabMemoryItem` |
| 刷题题目 | `DrillQuestion` |
| 读解文章 | `ReadingPassage` |
| 听力案例 | `ListeningCase`（JSON 用 `ListeningCaseRaw`） |
| 官方词卡 | `OfficialVocabDeck` |
| 学习包条目 | `StudyPackItem` |

## AI RAG 数据约定

`AI-M0` 复用 `drill_questions.json` 中已经校对的 `explanation`、`choiceInsights`、`reviewNote`、`tags` 和 `source` 字段，由 `seed/aiKnowledge.ts` 生成以下结构：

```text
questionId -> testedPointId -> AiKnowledgeEntry
```

当前映射覆盖 300 道文法题和 500 道词汇题。维护题目时必须保证：

- `id` 全局唯一，作为错题和知识映射的稳定主键。
- `tags[1]` 是本题主要考点，例如语法表达或目标词汇。
- `explanation` 和每一项 `choiceInsights` 能独立说明判断依据。
- `source` 必须填写可展示给用户的来源标签。

进入 `AI-M1` 后，如需补充跨题知识、相似表达和评估数据，再新增独立 JSON：

| 计划 JSON 文件 | 内容说明 |
|---|---|
| `seed/ai_grammar_knowledge.json` | 跨题语法知识、接续、例句和相似表达 |
| `seed/ai_vocab_knowledge.json` | 跨题词汇释义、搭配和近义词 |
| `seed/ai_eval_cases.json` | 验证检索命中与讲解质量的固定评估集 |
