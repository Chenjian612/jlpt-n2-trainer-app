# 项目历史

本文档记录 `jlpt-n2-trainer-app` 的关键版本节点，重点说明每一轮功能落点、结构调整和用户可感知变化。

## Unreleased

### 2026-03-16 `500 词 N2 核心库达成与架构重构`

### 核心变更
- **词库大扩容**：将 N2 核心词库从 130 词正式扩展至 **500 词**，覆盖动词、形容词、副词、复合动词、外来语及 N2 读解高频抽象词。
- **单数据源架构 (JSON-First)**：
    - 引入 `src/data/seed/n2_vocab_base.json` 作为唯一核心数据库。
    - 重构 `extendedVocabLibrary.ts` 动态导入 JSON，极大优化了代码体积和编译速度。
- **动态学习分阶段 (Staging) 系统**：
    - 在 `studyPacks.ts` 中实现动态分片，每 70 个词为一个 Stage（共 8 个阶段）。
    - UI (`StudyPackScreen`) 引入 `sessionCount` 联动逻辑，用户每学习一轮，下一轮会自动进入新的阶段。

### 技术提升
- 每个词条均具备高质量元数据：核心用法、短例句、记忆锚点及来源提示。
- 修复了在大数据量下的 JSON 解析与类型转换一致性问题。

---

## 2026-03-16 `新增官方词卡记忆模式，并按题型拆分官方资源词包`

本轮新增的是一个独立功能，不是继续在原有词汇记忆包上补文案。

已完成：

- 新增 `official_vocab_memory` 训练模式，使用独立页面和独立数据源。
- 新模式改成“资源库 -> 开卡记忆 -> 完成页”三段式，不和原有学习包混在一起。
- 词卡库按题型拆分为：
  - 文字・语彙
  - 听力
  - 读解
- 当前已接入两包可直接使用的官方来源词卡：
  - 听力公开样题词卡 A
  - 听力公开样题词卡 B
- 这两包词卡都整理自仓库里已有的官方公开音频资源：
  - `assets/audio/official/N2M1Q2.mp3`
  - `assets/audio/official/N2M2Q2.mp3`
  - `assets/audio/official/N2M3Q1.mp3`
  - `assets/audio/official/N2M4Q1.mp3`
- `文字・语彙` 与 `读解` 词卡入口先保留为 `待导入`，因为仓库当前没有对应的官方下载文件，不伪造来源。
- 首页模式总览、模式详情页、推荐顺序和训练文案已同步支持新模式。

本轮资源边界：

- 官方 FAQ 明确说明 2010 年改版以后不再公布完整词汇表。
- 因此这次没有伪造所谓“官方 N2 词表”，而是把功能限制在“官方公开可下载资源整理出的词卡”。

本轮实际验证通过的内容：

- `npx.cmd tsc --noEmit`
- 浏览器回归：
  - 首页进入“官方词卡记忆”
  - 进入词卡库
  - 打开“听力公开样题词卡 A”
  - 连续翻完 8 张词卡
  - 进入“本轮官方词卡完成”结果页

涉及的核心文件：

- `src/domain/models/training.ts`
- `src/domain/models/trainingContent.ts`
- `src/domain/services/progressService.ts`
- `src/domain/services/dashboardService.ts`
- `src/data/seed/trainingModes.ts`
- `src/data/seed/officialVocabDecks.ts`
- `src/features/official-vocab-memory/*`
- `src/app/navigation/AppNavigator.tsx`
- `src/features/dashboard/*`
- `src/features/mode-detail/*`

### 2026-03-13 `跨模式薄弱点追踪扩展到读解与听力，并补充首页教练聚合`

本轮重点不是继续堆 UI，而是把“薄弱点系统”从文法/词汇刷题错题扩展成真正跨模式可用的本地教练层。

已完成：

- 新增 `weaknessSignals` 持久化结构，用来记录读解与听力的题级弱点。
- 保留原有 `wrongAnswers` 机制，继续服务文法/词汇错题回收，不和读解/听力弱点混在同一条队列里。
- 读解接入 3 类错误类型：
  - 读解证据定位
  - 读解主旨判断
  - 读解干扰项排除
- 听力接入 4 类错误类型：
  - 听力转折漏听
  - 听力信息追踪
  - 听力最终结论
  - 听力主任务判断
- 首页“薄弱点摘要”现在会统一聚合：
  - 文法/词汇刷题错题
  - 读解 weakness signal
  - 听力 weakness signal
- 首页攻克计划会根据弱点来源自动推荐回到读解实战或听力要点拆解，而不是只推荐错题回收模式。
- 读解/听力页面在整轮结束时会把题级对错折成 weakness signal，用于后续首页推荐与攻克建议。

本轮实际验证通过的内容：

- `npx tsc --noEmit`
- 浏览器读解整轮回归：错误会影响首页“薄弱点摘要”
- 浏览器听力首题闭环：播放 -> 选项 -> 提交 -> 进入讲解态
- 服务层教练聚合校验：
  - listening weakness signal 会生成“当前最该先补：听力最终结论”
  - reading weakness signal 会生成“当前最该先补：读解主旨判断”
  - 正确重做后，对应弱点会被清除

涉及的核心文件：

- `src/app/providers/ProgressProvider.tsx`
- `src/domain/models/progress.ts`
- `src/domain/models/trainingContent.ts`
- `src/domain/services/progressService.ts`
- `src/domain/services/wrongAnswerClassifier.ts`
- `src/domain/services/coachService.ts`
- `src/features/reading-session/*`
- `src/features/listening-session/*`

### 2026-03-12 `主训练链路 UI 升级、刷题页重构与浏览器回归修正`

本轮继续把“首页点进去之后真正长时间停留的页面”做成统一的产品化体验。

已完成：

- 首页改成更明确的纸感视觉与任务导向结构，模式区按“快速提分 / 稳态积累 / 薄弱点回收”分组。
- 记忆包页升级了 Hero、学习提示区、结果反馈和宽屏布局。
- 读解页升级了阅读区 / 题目区布局，并补了“今日主线”“这一题先想什么”等提示块。
- 听力页升级了材料概览、控制区、题目前提示和结果反馈，和首页语气保持一致。
- 刷题页升级为响应式双栏结构，新增侧边节奏卡、轮次概览和更完整的结果页回顾。
- 修复刷题结果页的计数 bug：浏览器回归中发现顶部“今日累计”会多算 1 轮，现已按真实写入结果显示。

本轮实际验证通过的路径：

- 首页推荐与模式进入
- 文法刷题 -> 连续答题 -> 结果页展示 -> 返回首页建议
- 文法刷题 -> 生成错题 -> 错题回收 -> 返回首页
- 文法记忆包进入与翻卡
- 读解进入与提交
- 听力音频加载、播放与提交前解锁逻辑

涉及的核心文件：

- `src/components/common/AppBackground.tsx`
- `src/theme/tokens.ts`
- `src/features/dashboard/*`
- `src/features/drill-session/*`
- `src/features/study-pack/*`
- `src/features/reading-session/*`
- `src/features/listening-session/*`
- `src/features/training-session/*`

### 2026-03-11 `产品化升级、错题回收修复与 Web 体验清理`

本轮主要围绕“更像正式产品”和“把主训练链路跑顺”展开。

已完成：

- 首页文案、层级和状态提示整体产品化。
- 首页增加推荐判断逻辑，会根据今日完成情况与错题积压推荐下一步。
- 模式详情页、结果页、错题回收页的中文文案统一成同一套产品语气。
- 错题回收加入优先级排序，优先处理高频错误、待首次回收和该复习题目。
- 修复首页推荐 bug：无错题积压时，不再把错题回收排在最前。
- 修复错题回收结果页 bug：回收完成后会显示“本轮回收完成”，不再被空队列状态覆盖。
- 清理 Web 端开发警告：
  - `shadow*` 弃用警告
  - `useNativeDriver` 在 web 的回退警告
- 用户可见的 `session` 英文文案改为中文表达，如“累计轮次”“训练记录”“回收轮次”。

本轮实际验证通过的路径：

- 首页推荐与模式进入
- 文法刷题 -> 生成错题 -> 错题回收 -> 返回首页
- 文法记忆包进入与翻卡
- 读解进入与提交
- 听力音频加载、播放与提交前解锁逻辑

涉及的核心文件：

- `src/domain/services/dashboardService.ts`
- `src/domain/services/progressService.ts`
- `src/features/dashboard/*`
- `src/features/drill-session/*`
- `src/features/study-pack/*`
- `src/features/reading-session/*`
- `src/features/listening-session/*`
- `src/features/wrong-review/*`
- `src/theme/tokens.ts`

## 已提交历史

### 2026-03-04 `98afc5a` `新增读解与官方听力训练流程，并补充路线图`

- 新增 `reading_drill` 读解流程。
- 新增 `listening_analyze` 听力流程，并接入官方公开示例音频改编材料。
- 增补读解、听力对应的数据结构与页面。
- 更新路线图文档。

### 2026-03-04 `81f3763` `新增刷题、记忆包与错题回收流程，并补充项目历史文档`

- 新增刷题、记忆包、错题回收三类核心训练流程。
- 引入本地错题记录与回收机制。
- 完成训练进度、本地状态和模式基础数据的第一轮闭环。
- 增加项目历史文档。

### 2026-03-04 `bb96253` `Configure Expo native setup and add README`

- 完成 Expo 原生运行所需配置。
- 新增 README，补齐基本运行说明。

### 2026-03-04 `b8aab27` `refactor trainer app architecture`

- 重构目录结构，按 `app / features / domain / data / components / theme` 分层。
- 收敛进度状态、训练模式、数据 seed 与视图层职责。

### 2026-03-04 `58ea489` `ignore local debug artifacts`

- 忽略本地调试与临时产物，保持仓库提交干净。
