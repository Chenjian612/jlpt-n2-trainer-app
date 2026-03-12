# 项目历史

本文档记录 `jlpt-n2-trainer-app` 的关键版本节点，重点说明每一轮功能落点、结构调整和用户可感知变化。

## Unreleased

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
