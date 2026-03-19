# JLPT N2 Trainer App

一个基于 Expo / React Native 的 JLPT N2 训练应用，目标不是做单一题库页，而是把日常练习、首页推荐、错题回收、薄弱点聚合和本地进度追踪串成一个可连续使用的训练器。

当前代码已经形成一条完整主链路：

- 首页根据今日完成情况、错题 backlog、记忆不稳项和读解 / 听力薄弱点，动态给出推荐训练。
- 训练完成后会写入本地进度。
- 文法 / 词汇错题会进入回收队列。
- 读解 / 听力错误会沉淀为 `weaknessSignals`。
- 记忆包中标记为“不稳”的内容会进入 `studyWeaknesses`。
- 首页“薄弱点摘要”和“今天怎么攻克”会统一消费这些信号。

相关文档：

- [项目历史](./PROJECT_HISTORY.md)
- [路线图](./ROADMAP.md)

## 项目概况

这是一个纯前端、本地持久化的移动训练应用，目前没有后端依赖。

技术栈：

- Expo 54
- React 19
- React Native 0.81
- TypeScript
- AsyncStorage
- expo-audio
- Playwright（用于本地 Web 冒烟验证）

运行形态：

- 入口为 `App.tsx -> src/app/AppRoot.tsx`
- 使用 `ProgressProvider` 管理全局训练状态
- 使用轻量级自定义路由切换页面，没有引入 `react-navigation`
- 所有训练数据当前都来自本地 seed 文件

## 当前已实现能力

### 1. 九种训练模式

当前支持 9 个模式：

- 文法闯关 `grammar_drill`
- 文法记忆包 `grammar_study`
- 词汇刷题 `vocab_drill`
- 词汇记忆包 `vocab_study`
- 官方词卡记忆 `official_vocab_memory`
- 读解实战 `reading_drill`
- 听力要点拆解 `listening_analyze`
- 文法错题回收 `review_wrong`
- 词汇错题回收 `vocab_review_wrong`

不同模式对应不同页面和记录逻辑：

- 刷题模式使用 `DrillSessionScreen`
- 记忆包使用 `StudyPackScreen`
- 官方词卡使用 `OfficialVocabMemoryScreen`
- 读解使用 `ReadingSessionScreen`
- 听力使用 `ListeningSessionScreen`
- 错题回收使用 `WrongReviewScreen`

### 2. 首页推荐与训练节奏

首页不是静态菜单，而是一个带推荐逻辑的 dashboard：

- 今日目标默认 3 轮训练
- 每周目标默认 14 轮，可调整
- 推荐逻辑会优先考虑错题回收 backlog
- 如果记忆包里存在“不稳”项，会优先推对应学习模式
- 如果没有 backlog，再根据模式优先级推荐新训练
- 首页同时展示今日进度、近 7 天节奏、能力分布和薄弱点摘要

相关逻辑主要在：

- `src/domain/services/dashboardService.ts`
- `src/domain/services/coachService.ts`
- `src/features/dashboard/hooks/useDashboardViewModel.ts`

### 3. 错题、薄弱点与复盘系统

目前代码里已经形成 3 套不同但互相关联的复盘数据：

- `wrongAnswers`
  - 来自文法 / 词汇刷题
  - 记录错题内容、错误次数、最近误选、是否已掌握
- `weaknessSignals`
  - 来自读解 / 听力
  - 记录题级弱点、错误次数、是否仍 active
- `studyWeaknesses`
  - 来自文法 / 词汇记忆包
  - 记录哪些学习项被标记为“不稳”

系统会对这些数据做优先级排序，并在首页聚合成最多 3 个当前最该先补的焦点项。

当前已经覆盖的弱点类型包括：

- 文法：限制、判断、结论、并列、让步
- 词汇：搭配、语境、词义细差
- 读解：证据定位、主旨判断、干扰项排除
- 听力：转折漏听、信息追踪、最终结论、主任务判断
- 学习包：文法记忆不稳、词汇记忆不稳

### 4. 题库与学习内容

当前本地内容大致包括：

- 文法 / 词汇刷题题库
- 文法记忆包
- 词汇记忆包
  - 由扩展词库按阶段切片生成，每轮默认取一段内容
- 官方词卡 3 组
  - 文字・语汇
  - 听力
  - 读解
- 读解材料 4 篇
- 听力案例 8 组
  - 其中包含官方公开音频改编内容，也有复用音频的占位训练案例

### 5. 官方词卡模式

`official_vocab_memory` 是独立流程，不复用普通记忆包：

- 先按题型筛选词卡包
- 进入单包后逐张翻卡
- 每张卡标记为 `known / fuzzy / hard`
- 完成后生成结果页
- 可以只对本轮 `hard` 项再开一轮复习
- 仅完整学习整包时记录一次正式 session，复习轮不重复记入完成次数

### 6. 本地进度持久化

所有进度保存在 AsyncStorage，本地 key 为：

- `jlpt-n2-trainer-state-v1`

状态结构定义在 `src/domain/models/progress.ts`，核心字段包括：

- `weeklyGoal`
- `sessionsByDay`
- `wrongAnswers`
- `weaknessSignals`
- `studyWeaknesses`

当前规则：

- 最多保留 45 天历史
- 学习包中“不稳”项默认至少隔 2 天再重新出现
- 错题 / 弱点会按频次、近期性、是否待复习等信号排序

## 目录结构

- `src/app`
  - 应用根节点、Provider、导航
- `src/features`
  - 首页、模式详情、刷题、记忆包、官方词卡、读解、听力、错题回收等页面
- `src/domain`
  - 领域模型、进度服务、首页推荐、薄弱点教练逻辑
- `src/data`
  - 本地 seed 数据、题库、官方词卡、读解 / 听力材料、仓储封装
- `src/components`
  - 通用 UI 组件
- `src/theme`
  - 设计 token
- `assets/audio/official`
  - 已接入的官方公开听力音频资源

## 关键数据流

### 刷题

`DrillSessionScreen -> recordDrillSession -> wrongAnswers -> Dashboard / WrongReview`

- 做完一轮刷题后记录 session
- 错题进入 `wrongAnswers`
- 首页和错题回收页都会读取这些数据

### 读解 / 听力

`ReadingSessionScreen | ListeningSessionScreen -> recordSession(...weaknessSignals) -> weaknessSignals -> Dashboard`

- 这两类模式不会进入文法 / 词汇错题回收队列
- 而是写入独立的 `weaknessSignals`

### 记忆包

`StudyPackScreen -> recordStudySession -> studyWeaknesses -> Dashboard`

- 学习项如果被标记为不稳，会写入 `studyWeaknesses`
- 首页推荐会优先考虑这些待补强项

## 本地运行

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run start
```

其他目标：

```bash
npm run web
npm run android
npm run ios
```

## 当前更适合怎么理解这个项目

用现在这版代码来定义，这个项目更接近：

- 一个本地优先的 N2 训练工作台
- 一个把“训练 -> 记录 -> 发现弱点 -> 再推荐”闭环做起来的学习应用原型

而不是：

- 只有静态题目展示的 Demo
- 只做单次练习、不保留训练记忆的练习页集合

## 后续可继续补强的方向

从当前代码看，下一步最自然的演进方向是：

- 扩充题库与官方资源导入流程
- 补更细的间隔复习规则
- 增加更稳定的自动化测试覆盖
- 把当前自定义导航升级到更完整的导航方案
- 处理部分 seed 文本与资源整理流程，降低内容维护成本
