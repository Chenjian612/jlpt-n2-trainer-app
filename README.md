# JLPT N2 Trainer App

一个基于 Expo / React Native 的 JLPT N2 本地训练应用。它不是单页题库 Demo，而是把首页推荐、训练执行、错题回收、薄弱点聚合和本地进度追踪串成一条能持续复用的训练闭环。

相关文档：

- [开发环境启动说明](./DEV_STARTUP.md)
- [部署说明](./DEPLOYMENT.md)
- [题库扩充指令包](./CODEX-INSTRUCTIONS.md)
- [内容扩充进度](./CONTENT-PROGRESS.md)
- [项目历史](./PROJECT_HISTORY.md)
- [路线图](./ROADMAP.md)
- [AI 功能设计方案](./DESIGN-AI.md)

## 当前状态

- 纯前端、本地持久化应用，没有后端依赖。
- 使用 `AsyncStorage` 保存训练状态，存储 key 为 `jlpt-n2-trainer-state-v1`。
- 当前已落地 9 个训练模式，首页会根据错题、薄弱点和今日进度动态推荐下一步。
- 错题回收页支持可选的 AI 错因分析，并会把结果缓存到本地状态。

技术栈：

- Expo 54
- React 19
- React Native 0.81
- TypeScript
- `@react-native-async-storage/async-storage`
- `expo-audio`
- Playwright（Web 冒烟测试）

## 训练闭环

### 首页推荐不是静态菜单

首页会统一消费以下信号：

- 今日完成轮次
- 周目标完成度
- 文法 / 词汇错题 backlog
- 读解 / 听力薄弱点
- 学习包里标记为“不稳”的内容

当前默认节奏：

- 每日目标：3 轮
- 每周目标：14 轮
- 周目标可调范围：6 到 28

### 九种训练模式

| 模式 | `modeId` | 处理页面 | 当前行为 |
| --- | --- | --- | --- |
| 文法闯关 | `grammar_drill` | `DrillSessionScreen` | 每轮随机抽 5 题，错题进入文法回收队列 |
| 文法记忆包 | `grammar_study` | `StudyPackScreen` | 每轮 3 个学习项，标记不稳项 |
| 词汇刷题 | `vocab_drill` | `DrillSessionScreen` | 每轮随机抽 5 题，错题进入词汇回收队列 |
| 词汇记忆包 | `vocab_study` | `StudyPackScreen` | 当前按 70 词分段轮换，记录不稳项 |
| 官方词卡记忆 | `official_vocab_memory` | `OfficialVocabMemoryScreen` | 按卡组学习，支持 `known / fuzzy / hard` 标记 |
| 读解实战 | `reading_drill` | `ReadingSessionScreen` | 按篇训练，错误写入 `weaknessSignals` |
| 听力要点拆解 | `listening_analyze` | `ListeningSessionScreen` | 按案例训练，错误写入 `weaknessSignals` |
| 文法错题回收 | `review_wrong` | `WrongReviewScreen` | 每轮回收 5 题，支持 AI 错因分析 |
| 词汇错题回收 | `vocab_review_wrong` | `WrongReviewScreen` | 每轮回收 5 题，支持 AI 错因分析 |

### 三类薄弱点会汇总到首页

- `wrongAnswers`
  - 来源：文法 / 词汇刷题
  - 作用：进入错题回收队列并参与首页推荐
- `weaknessSignals`
  - 来源：读解 / 听力
  - 作用：记录题级薄弱点，在首页生成“薄弱点摘要”和“今天怎么攻克”
- `studyWeaknesses`
  - 来源：文法 / 词汇记忆包
  - 作用：将标记为不稳的学习项推回后续学习优先级

另外还有一层本地缓存：

- `aiExplanationCache`
  - 来源：错题回收页的 AI 错因分析
  - 作用：避免同一题重复请求 AI

## 当前内容规模

下面的数字来自当前仓库 seed 数据：

| 内容 | 当前量 | 说明 |
| --- | --- | --- |
| 文法刷题 | 300 题 | `grammar_drill` |
| 词汇刷题 | 500 题 | `vocab_drill` |
| 刷题总量 | 800 题 | `drill_questions.json` 总量 |
| 文法学习项 | 90 项 | `grammar_study_items.json` |
| 词汇库 | 540 词 | `n2_vocab_base.json` |
| 官方词卡卡组 | 6 组 | 全部为 `ready` |
| 官方词卡条目 | 48 张 | 6 组卡组总计 |
| 读解文章 | 10 篇 | 共 40 道题 |
| 听力案例 | 8 组 | 共 8 道题 |
| 本地听力 MP3 | 5 个 | 静态映射在 `listeningCases.ts` |

当前题库扩充进度请看 [CONTENT-PROGRESS.md](./CONTENT-PROGRESS.md)。

## 架构概览

入口链路：

```text
App.tsx
  -> src/app/AppRoot.tsx
  -> ProgressProvider
  -> AppNavigator
  -> 各 feature screen
```

核心特点：

- 没有引入 `react-navigation`，使用 `AppNavigator` 手写轻量路由。
- `ProgressProvider` 是唯一全局状态入口，负责 hydration 和保存。
- 训练内容以 JSON 为单一数据源，TypeScript 文件只做适配和查询。
- 主题 token 集中在 `src/theme/tokens.ts`。

关键目录：

- `src/app`
  - 根节点、Provider、导航
- `src/features`
  - 首页、刷题、记忆包、官方词卡、读解、听力、错题回收
- `src/domain`
  - 类型定义、进度服务、推荐逻辑、薄弱点聚合
- `src/data`
  - 本地题库、词库、官方词卡、读解 / 听力素材、仓储封装
- `src/services`
  - AI 错题分析客户端
- `tests`
  - Node 侧逻辑测试与 Playwright Web 冒烟脚本

## 本地运行

安装依赖：

```bash
npm install
```

常用命令：

```bash
npm run dev
npm run start
npm run proxy
npm run web
npm run android
npm run ios
```

说明：

- `npm run dev`
  - 同时启动 Expo dev server 和本地代理脚本
- `npm run start`
  - 只启动 Expo，不启动代理
- `npm run proxy`
  - 只启动本地代理
- `npm run web`
  - 启动 Web 目标

### `.env.local`

复制 `.env.example` 为 `.env.local`，按需填写：

```env
EXPO_PUBLIC_AI_API_KEY=<your_api_key>
EXPO_PUBLIC_AI_PROVIDER=openai
# 可选：Claude on Web 必填；DeepSeek / OpenAI 走自建代理时也可填写
EXPO_PUBLIC_DEEPSEEK_PROXY_URL=http://localhost:9876
```

当前代码支持的 provider：

- `openai`
- `deepseek`
- `claude`

默认值：

- 如果未设置 `EXPO_PUBLIC_AI_PROVIDER`，默认使用 `openai`

注意：

- `EXPO_PUBLIC_DEEPSEEK_PROXY_URL` 这个变量名历史上只给 DeepSeek 用，但当前实现里它实际承担“通用代理 base URL”的角色。
- 在浏览器里直连第三方模型会暴露 API Key。要分享给别人用或做正式部署，应该改成服务端代理或 Worker 保管密钥。

## 测试与验证

当前仓库已经配置了可直接运行的测试脚本：

```bash
npm test
npx tsc --noEmit
npm run test:web:components
npm run test:web:e2e
```

说明：

- `npm test`
  - 运行 `tests/*.test.js`，当前共 38 个逻辑测试
- `npm run test:web:components`
  - 运行 Playwright 组件流测试
- `npm run test:web:e2e`
  - 运行首页到错题回收的 Web 冒烟链路
- Playwright 默认访问 `http://127.0.0.1:19006`，可通过 `BASE_URL` 覆盖

## 当前边界

- 仍是本地优先架构，没有账号体系、云同步和后端题库服务。
- 自定义导航已经够当前体量使用，但复杂度继续上升时更适合迁移到正式导航方案。
- AI 功能仍依赖前端环境变量和可选代理，正式部署前必须收口密钥暴露问题。
- 词汇记忆包当前按 70 词切片轮换，适合总量推进，但后续仍可继续优化为更细颗粒度的节奏控制。
