# JLPT N2 Trainer App

一个面向 JLPT N2 备考的 Expo / React Native 应用，提供文法、词汇、读解、听力、错题回收与官方词卡记忆等训练模式。

## 主要功能

- 文法刷题与学习包
- 词汇刷题、学习包与官方词卡记忆
- 读解训练与弱点回收
- 听力训练与弱点回收
- 错题复习与 AI 讲解
- 首页根据薄弱点推荐下一步训练

## 技术栈

- Expo 54
- React 19
- React Native 0.81
- TypeScript
- `@react-native-async-storage/async-storage`
- `expo-audio`
- Playwright

## 数据与模式

应用使用本地 `seed` 数据作为训练内容来源，核心模式包括：

| 模式 | `modeId` | 页面 | 说明 |
| --- | --- | --- | --- |
| 文法刷题 | `grammar_drill` | `DrillSessionScreen` | 按题训练文法点 |
| 文法学习包 | `grammar_study` | `StudyPackScreen` | 按主题学习文法 |
| 词汇刷题 | `vocab_drill` | `DrillSessionScreen` | 按题训练词汇 |
| 词汇学习包 | `vocab_study` | `StudyPackScreen` | 按主题学习词汇 |
| 官方词卡记忆 | `official_vocab_memory` | `OfficialVocabMemoryScreen` | 记忆官方公开资源词卡 |
| 读解训练 | `reading_drill` | `ReadingSessionScreen` | 训练读解与逻辑判断 |
| 听力分析 | `listening_analyze` | `ListeningSessionScreen` | 训练听力理解与陷阱识别 |
| 错题回收 | `review_wrong` | `WrongReviewScreen` | 回收文法错题 |
| 词汇错题回收 | `vocab_review_wrong` | `WrongReviewScreen` | 回收词汇错题 |

## 当前内容规模

- 文法题库：300 题
- 词汇题库：500 题
- 读解素材：15 篇，共 60 题
- 听力案例：15 条，共 15 题
- 官方词卡：120 张

## 维护说明

- 只修改 `src/data/seed/*.json`，不要直接改对应的 `.ts` 加载文件。
- 更新 seed 后，要检查 JSON 是否能正常解析。
- 注意总数、重复 `id`、题目数量、选项数量等基础校验。
- 读解默认是 1 篇 4 题。
- 听力默认是 1 案例 1 题。
- 借用官方资源时，要在 `source` 或 `sourceHint` 中写清来源。

## 相关文档

- [开发启动](./DEV_STARTUP.md)
- [部署说明](./DEPLOYMENT.md)
- [Codex 指令](./CODEX-INSTRUCTIONS.md)
- [内容进度](./CONTENT-PROGRESS.md)
- [项目历史](./PROJECT_HISTORY.md)
- [路线图](./ROADMAP.md)
- [AI 说明](./DESIGN-AI.md)
