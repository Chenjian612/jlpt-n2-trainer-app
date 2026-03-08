# 项目演进记录

本文整理了 `jlpt-n2-trainer-app` 从初始化到当前阶段的主要演进过程，便于后续快速回顾项目是怎样一步步搭起来的。

## 1. 初始建项阶段

### `2026-03-04 14:27 JST` `d7ecc46` `Initial commit`

这是项目的脚手架初始化提交，由 `create-expo-app 3.5.3` 生成。

这一阶段的特点是：

- 建好了 Expo 基础工程
- 加入了 `App.tsx`、`package.json`、`app.json` 等起步文件
- 补齐了图标、启动图等基础资源

当时项目还只是一个空白的 Expo App，没有 JLPT N2 训练产品本身的业务逻辑。

## 2. 第一版训练原型落地

### `2026-03-04 15:44 JST` `076f72b` `init`

这是项目第一次从“空壳”变成“有业务内容的原型”。

这一版主要做了这些事：

- 在 `App.tsx` 中直接实现了大部分界面和交互
- 新增早期训练模式数据 `src/data/trainingModes.ts`
- 新增早期训练状态逻辑 `src/lib/trainingState.ts`

这一阶段的项目形态可以理解为：

- 已经有了 JLPT N2 训练 App 的第一版产品雏形
- 但代码还是偏单体式实现，很多逻辑集中在一个大文件里

## 3. 工程整理阶段

### `2026-03-04 16:28 JST` `58ea489` `ignore local debug artifacts`

这是一次小型但必要的工程整理提交。

这一版主要更新了 `.gitignore`，把本地调试产物排除掉，避免把无关文件带进仓库。

这一步不改变产品功能，但说明项目开始从一次性原型走向持续开发。

## 4. 架构重构阶段

### `2026-03-04 17:50 JST` `b8aab27` `refactor trainer app architecture`

这是当前历史里最关键的一次改造，项目从“单体原型”升级成“可扩展前端架构”。

这次重构主要完成了以下拆分：

- `src/app`：应用根、导航、Provider
- `src/domain`：领域模型和纯逻辑服务
- `src/data`：仓储、seed 数据、存储封装
- `src/features`：按功能拆分页面与组件
- `src/components`：公共组件
- `src/theme`：视觉 token

这一版的意义是：

- 把原来集中在 `App.tsx` 的大量逻辑拆开
- 建立了更清晰的职责边界
- 为后续继续补题库、错题、推荐逻辑和页面能力打下基础

从这里开始，这个仓库已经不只是一个能跑的 demo，而是一个可以持续扩展的项目底座。

## 5. Expo 配置和项目文档补齐

### `2026-03-04 23:10 JST` `bb96253` `Configure Expo native setup and add README`

这一阶段重点不在新功能，而在让项目变得更完整、更可交付。

主要做了两件事：

- 调整 Expo 原生配置
- 补充较完整的 `README.md`

这一版的价值在于：

- 让项目的定位、结构和当前实现状态更清楚
- 让仓库更像一个正式维护中的项目，而不是本地实验代码

## 6. 当前工作区中的未提交升级

除了上述 5 次正式提交，当前工作区里还有一批尚未提交的改动。这一轮改动代表项目正在从“训练骨架”继续升级到“真实训练流”。

当前未提交改动主要集中在以下方向：

### 6.1 真实内容接入

- 新增 `src/data/seed/drillQuestions.ts`
- 新增 `src/data/seed/studyPacks.ts`
- 新增 `src/domain/models/trainingContent.ts`

这说明项目已经不再只是展示训练模式说明，而是在接入真实题目、学习包和训练内容模型。

### 6.2 新训练页面拆分

新增了多个专门的功能页面目录：

- `src/features/drill-session/`
- `src/features/study-pack/`
- `src/features/training-session/`
- `src/features/wrong-review/`

这意味着项目开始按训练类型分别设计真实流程，而不是所有模式都共用同一种泛化页面。

### 6.3 进度和错题闭环增强

当前未提交改动还重点增强了这些核心文件：

- `src/app/navigation/AppNavigator.tsx`
- `src/app/providers/ProgressProvider.tsx`
- `src/domain/models/progress.ts`
- `src/domain/models/training.ts`
- `src/domain/services/dashboardService.ts`
- `src/domain/services/progressService.ts`

这一轮增强的核心方向是：

- 更完整的 session 记录
- 错题入队与回收
- 首页统计与推荐信息补强
- 不同训练模式进入不同真实训练流

## 7. 到目前为止的整体演进脉络

如果把整个项目的发展过程压缩成一句话，可以概括为：

1. 先搭起 Expo 空项目
2. 再快速做出第一版 JLPT N2 训练原型
3. 然后把单体实现重构成清晰分层架构
4. 再补齐 Expo 配置和项目说明文档
5. 现在继续往真实训练内容、错题回收和训练闭环方向推进

## 8. 当前阶段的判断

截至目前，这个项目已经不是一个纯展示型原型，但也还不是完整成品。

它现在更准确的定位是：

- 一个已经完成基础产品骨架的 JLPT N2 训练 App
- 一个拥有首页、模式详情、训练记录和部分真实内容流的前端底座
- 一个适合继续往读解、听力、更多题库和复习调度能力上扩展的项目
