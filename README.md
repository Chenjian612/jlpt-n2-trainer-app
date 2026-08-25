# JLPT N2 Trainer App

一个面向 JLPT N2 备考的 Expo / React Native 应用，提供文法、词汇、读解、听力、错题回收与官方词卡记忆等训练模式。

当前规划方向是在现有训练闭环上扩展轻量级 AI RAG 能力：知识库负责锁定答案、考点和来源，AI 层逐步从受控讲解润色升级为基于误选项、错误历史和迁移验证的个性化辅导。总体方案见 [AI RAG 学习平台方案](./AI-RAG-LEARNING-PLAN.md)，下一阶段见 [个性化 AI 错题辅导设计](./AI-PERSONALIZED-TUTOR-DESIGN.md)。

## 主要功能

- 文法刷题与学习包
- 词汇刷题、学习包与官方词卡记忆
- 读解训练与弱点回收
- 听力训练与弱点回收
- 错题复习与 AI 讲解
- 首页根据薄弱点推荐下一步训练
- 已完成 AI-M0：文法/词汇题目精确映射、结构化错题讲解、来源引用、缓存与资料不足拒答
- 已完成 AI-M1 与基础 AI-M2：个性化错误诊断、三步判断路径、易混点对比、复习动作和 AI 迁移题记录
- 已完成 AI-M3：BM25 + TF-IDF + 可选语义 Embedding 混合检索、读解原文定位、听力证据分类和跨模块薄弱点总结
- 已完成 AI-M4：审批来源目录、显式 HTML 同步、缓存完整性/时效校验、受控网络补充、锁定引用生成和失败回退

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

常用验证和 AI 服务命令：

```bash
npm test
npm run test:ai
npm run ai:evaluate
npm run ai:dev
```

错题讲解默认使用 App 内置的本地结构化知识库，不配置 API Key 也能运行。需要通过 FastAPI 服务调用时，在 `.env.local` 中设置：

```bash
EXPO_PUBLIC_AI_SERVICE_URL=http://localhost:8000
```

服务端模型配置见 [AI Service README](./ai-service/README.md)。现有错题页将知识库事实讲解与 AI 个性化辅导分开：知识库锁定答案、考点和来源，AI 根据误选项、错误次数和近期同类错误生成诊断、三步判断路径、复习动作与迁移题；迁移结果会写入本地进度并触发上下文缓存换版。

页面展示约定：模型讲解成功时不显示额外来源徽标；降级时显示“本地知识库”或“历史缓存”；个性化模块使用“智能辅导”标识。技术枚举 `ai_service` 和英文 `AI TUTOR` 不直接作为用户标题。

- 只修改 `src/data/seed/*.json`，不要直接改对应的 `.ts` 加载文件。
- 更新 seed 后，要检查 JSON 是否能正常解析。
- 注意总数、重复 `id`、题目数量、选项数量等基础校验。
- 读解默认是 1 篇 4 题。
- 听力默认是 1 案例 1 题。
- 借用官方资源时，要在 `source` 或 `sourceHint` 中写清来源。

## 相关文档

- [开发启动](./DEV_STARTUP.md)
- [CLI 代理启动](./CLI_PROXY_STARTUP.md)
- [部署说明](./DEPLOYMENT.md)
- [Codex 指令](./CODEX-INSTRUCTIONS.md)
- [内容进度](./CONTENT-PROGRESS.md)
- [项目历史](./PROJECT_HISTORY.md)
- [路线图](./ROADMAP.md)
- [AI RAG 学习平台方案](./AI-RAG-LEARNING-PLAN.md)
- [个性化 AI 错题辅导设计](./AI-PERSONALIZED-TUTOR-DESIGN.md)
- [AI 说明](./DESIGN-AI.md)
