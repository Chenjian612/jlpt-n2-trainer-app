# 项目历史

本文档记录 `jlpt-n2-trainer-app` 的关键版本节点，重点说明每一轮功能落点、结构调整和用户可感知变化。

## Unreleased

### 2026-03-11 `未提交` `产品化升级、错题回收修复与 Web 体验清理`

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
