# 项目历史

本文档记录 `jlpt-n2-trainer-app` 的关键版本节点，重点说明每一轮功能落点、结构调整和用户可感知变化。

## Unreleased

### 2026-03-19 `评审驱动修复：Codex + Claude Code 联合落地评审建议`

基于当日 PM + 技术评审报告（`REVIEW-2026-03-19.md`），由 Codex 完成初轮改动，Claude Code 完成补充修复与质量验收。

**Codex 完成的改动：**

- **B1 官方词卡隐藏 pending 分类**：`OfficialVocabMemoryScreen` 仅展示 `status === 'ready'` 的词卡，filter tab 也只展示有内容的分类，消除了"待导入"入口对新用户的负面体验。
- **B2 错题回收加重新作答验证**：`WrongReviewScreen` 新增 `selectedChoice` + `hasCheckedAnswer` 状态；用户必须先选题再提交，提交后才解锁"掌握 / 保留"决策。答对/答错有独立颜色反馈卡片，弱点清零不再是自我声明。
- **B3 学习包弱项最短复现间隔**：`getActiveStudyWeaknesses` 引入 `diffInHours` 时间过滤，`APP_CONFIG.STUDY_REAPPEAR_HOURS = 4`，同一天内多次刷学习包时，不稳项不会在 4 小时内重复出现。
- **C1 核心 service 层单元测试**：新增自定义 Node.js 测试框架（`tests/run-tests.js` + `sucrase`），共 34 个测试用例，覆盖 `progressService`、`dashboardService`、`coachService`、`wrongAnswerClassifier` 全部核心逻辑。
- **常量中心化**（补全 APP_CONFIG）：`REVIEW_BATCH_SIZE`、`STUDY_REAPPEAR_HOURS`、`DAILY_RECOMMENDATION_LIMIT`、`PRIORITY_WEIGHT_*` 等所有算法参数统一进 `src/config/constants.ts`。
- **内容扩充（第三波）**：`drillQuestions` +569 行，`readingPassages` +342 行，`listeningCases` +188 行。

**Claude Code 完成的补充修复：**

- **Bug：OfficialVocabMemoryScreen 编码乱码**：Codex 引入的二进制编码损坏（`复习\uFFFD\uFFFD{...}`）通过字节级替换修复为正确的 `复习：${activeDeck?.title ?? ''}`。
- **Bug：REVIEW_BATCH_SIZE 定义但未使用**：`WrongReviewScreen` 第 54 行 `slice(0, 5)` 改为 `slice(0, APP_CONFIG.REVIEW_BATCH_SIZE)`，常量生效。
- **C3 aggregateWeaknesses 重构**：将 `coachService` 中三段结构重复的循环提取为 `accumulateEntries` 通用函数；新增弱点来源只需追加一次调用，不再需要复制整段逻辑。
- **C2 WrongReviewScreen StyleSheet 提取**：内联样式迁移至 `src/features/wrong-review/screens/wrongReviewStyles.ts`，主文件从 757 行降至 418 行，逻辑与样式分离。

**本轮验证：**

- `npm test` 全部 34 个测试通过，无回归。
- 编码修复后 `OfficialVocabMemoryScreen` 复习标题恢复正常渲染。

**仍未完成（已记录，待下轮规划）：**

- B4：弱点消退趋势展示（需新增数据模型 + Dashboard UI）
- C4：Seed 数据 JSON 化（架构级改动，需专项排期）

### 2026-03-19 `架构加固与稳定性升级：消除潜在崩溃与数据风险`

在完成核心功能后，本轮进行了系统性的架构重构与稳定性优化，对标 `M2：可信` 阶梯。

已完成：

- **全局配置中心化**：
  - 新增 `src/config/constants.ts`，统一管理历史天数 (45)、每日目标 (3)、周目标范围 (6-28) 及算法权重等魔法数字。
- **日期工具归一化**：
  - 提取 `src/utils/dateUtils.ts`，消除了 `progressService` 与 `dashboardService` 之间重复的日期计算逻辑，确保全系统 DayKey 格式统一。
- **稳定性与安全性防御**：
  - **崩溃防护**：修复了 `coachService` 在弱点数据为空时可能出现的数组越界访问崩溃；增加了对元数据不存在时的 null 检查。
  - **能力分类重构**：将能力分布统计从“前缀匹配”升级为“显式映射映射表”，彻底避免了未来新增模式时统计静默失效的风险。
  - **数据完整性校验**：在错题回收中增加了“掌握”验证逻辑，禁止在答错的情况下标记掌握，防止用户产生虚假进度感。
- **业务算法优化**：
  - **记忆包间隔复习 (SR)**：在 `getActiveStudyWeaknesses` 中引入了基于时间的过滤逻辑（默认 2 天内不重复出现不稳项），避免无效的高频机械重复。
  - **周目标动态调整**：修复了周目标被静默截断的问题，使其严格遵循配置范围。
- **代码质量提升**：
  - 大幅精简了 `useDashboardViewModel` 的 `useMemo` 使用，移除非必要的缓存，降低了维护心智负担。
  - 修复了 `DashboardScreen` 中由于类型推断不严谨导致的索引错误。

本轮验证：
- `npx tsc --noEmit` 全量类型检查通过。
- 确认了首页教练、任务编排、能力分布在极端情况（全空数据/旧版脏数据）下的表现均稳定。

### 2026-03-19 `题库与素材库第二轮扩容：大幅增补文法、词汇、读解与听力实战内容`

本轮深度推进了路线图中的“P4：补题库和内容量”，通过高质量的原创素材，显著提升了系统的训练深度和耐刷度。

已完成：

- **文法/词汇刷题库（第二波）**：
  - 新增 10 道题目，累计题库量持续增长。
  - 重点覆盖：`にほかならない`（强调）、`にもかかわらず`（转折）、`〜ことだ`（建议）、`実現`、`抽象的`、`確保` 等 N2 核心词汇与表达。
- **读解实战素材库（第二波）**：
  - 新增《デジタル時代の「深読み」の価値》（社会文化类）：训练在碎片化信息时代保持深度思考的能力。
  - 新增《プラスチックごみ問題と「循環型社会」》（环境科学类）：引入“循环经济”概念，训练对专业术语定义及逻辑推导的理解。
  - 两篇文章均配有细节题、定义题、主旨题等全方位题型。
- **听力要点拆解库（第二波）**：
  - 新增《接客時のマナー指導》：模拟职场培训场景，训练对“强调表达”和“优先顺序”的抓取。
  - 新增《飛行機の遅延アナウンス》：模拟公共广播场景，训练在干扰信息中提取“核心原因”和“后续安排”。

本轮验证：
- `npx tsc --noEmit` 通过。
- 确认所有新增素材的 `tags` 与现有的薄弱点教练系统（P1-P3）完美契合，能够自动触发针对性的复盘建议。

### 2026-03-19 `题库与素材库第一轮扩容：增补文法、词汇、读解与听力原创素材`

本轮推进了路线图中的“P4：补题库和内容量”，通过增补原创和改编素材，延长了用户在主模式下的有效训练时长。

已完成：

- **文法/词汇刷题扩容**：
  - 在 `DRILL_QUESTIONS` 中新增了 10 道 N2 文法/词汇题。
  - 覆盖了 `に限らず`、`に際して`、`に基づいて`、`おそれがある` 等高频句型。
  - 补齐了 `分析`、`柔軟`、`深刻`、`妥協`、`慎重` 等 N2 核心词汇搭配。
  - 所有新增题目均配有完整的 `choiceInsights`（干扰项分析）和 `reviewNote`（复盘要点）。
- **读解实战扩容**：
  - 新增了一篇关于“职场中『聞く』与『聴く』的区别”的深度读解材料。
  - 包含 4 道配套题目，涵盖细节对比、因果逻辑、态度判断和主旨总结。
- **听力要点拆解扩容**：
  - 新增了一则关于“新商品目标客户讨论”的商务策划会议听力素材。
  - 重点训练“多人讨论中的结论收束”和“转折词（ただ、しかし）后的决定性信息”。

本轮验证：
- `npx tsc --noEmit` 通过。
- 确认新增内容在各自的 Session 页面中能正确加载和显示。

### 2026-03-19 `首页升级为智能训练调度中心：引入战斗状态与能力分布可视化`

本轮完成了路线图中的“P3：首页升级为更强的训练调度”，将首页从简单的“进度展示”升级为能够主动引导用户节奏的“作战指挥部”。

已完成：

- **HeroCard 战斗状态系统**：
  - 新增 `HeroBattleState` 逻辑，首页 Hero 区现在能智能识别当前处于哪个阶段：
    - `今日首战`：唤起起跑动力。
    - `回收战`：当有错题或记忆不稳项积压时，自动切换至黄色预警态，强制聚焦“清债”。
    - `达标冲刺`：今日已起步但未到达标线（3轮），强化进度条视觉。
    - `超额加成`：达标后的成就感回馈。
  - 不同状态对应不同的引导话术、动态颜色和任务标签。
- **本周能力板块分布可视化**：
  - 在 `WeeklyRhythmCard` 中新增了四大能力（文法、词汇、读解、听力）的训练分布条。
  - 自动回溯过去 7 天的训练记录，帮助用户一眼洞察“偏科”情况（例如：是否这周只做了词汇而忽略了听力）。
- **首页快速回收入口**：
  - 升级了 `WeaknessCoachCard`（薄弱点摘要），新增“快速启动”按钮。
  - 用户看到教练关于“文法记忆不稳”的建议后，可以直接点击一键开启对应的记忆包，大幅缩短了从“发现弱点”到“开始回收”的操作路径。
- **底层指标增强**：
  - 在 `dashboardService` 中实现了 `CapabilityDistribution` 的聚合计算。
  - 在 `DashboardInsight` 中集成了 `battleState` 判断。

本轮验证：
- `npx tsc --noEmit` 通过。
- 确认了首页各卡片在不同训练量（0轮、1轮、3轮、有错题/无错题）下的状态切换逻辑正确。

### 2026-03-19 `学习包接入长期复习系统：实现“不稳项”追踪与动态置顶`

本轮完成了路线图中的“P2：让学习包进入长期复习系统”，解决了学习包“看完即过”的问题，建立了记忆弱项的持续追踪与回收机制。

已完成：

- **记忆弱项持久化**：
  - 在 `ProgressState` 中引入 `studyWeaknesses` 字段，专门记录在学习包自查阶段被标记为“还不稳”的项目。
  - 记录了不稳次数 (`unstableCount`)、首次/最后不稳时间，为后续引入间隔重复算法预留了数据基础。
- **动态复习队列（置顶机制）**：
  - 重构了 `StudyPackScreen` 的内容生成逻辑。
  - 每次进入学习包时，系统会自动从持久化状态中提取该模式对应的“活跃不稳项”，并将其置顶在当前阶段的新内容之前。
  - 实现“先清旧账，再学新课”，确保薄弱点得到高频重复。
- **首页教练与任务调度集成**：
  - `coachService` 现在能聚合 `studyWeaknesses`，在“薄弱点摘要”中展示“文法记忆不稳”或“词汇记忆不稳”的具体项数。
  - `dashboardService` 的任务推荐权重已更新：如果学习包中有积压的不稳项，首页会优先推荐该模式，并给出“重点攻克不稳项”的战术建议。
- **底层架构对齐**：
  - 统一了 `ProgressProvider` 里的 `recordStudySession` 接口。
  - 更新了 `wrongAnswerClassifier`，为记忆弱项补齐了专用的 `WEAKNESS_ERROR_META`（含针对性 coachPoint 和后续建议）。

本轮验证：
- `npx tsc --noEmit` 通过。
- 确认了置顶逻辑能正确去重（即如果一个项既是不稳项又是当前阶段原有的项，只显示一次并标记为待巩固）。

### 2026-03-19 `结果页升级为模式内教练：补齐各类训练的薄弱点反馈`

本轮重点推进了路线图中的“P1：把结果页做成真正的模式内教练”，让每轮训练后的结果反馈变得更具体、更具指导性。

已完成：

- **刷题结果页（文法/词汇）**：
  - 在整轮作答完成后，自动推算本轮错题中最主要的错误类型。
  - 在结果页“下一步建议”区，明确展示“主要错误”（如：文法结论归纳、词汇语境判断），并提供具有针对性的复盘和下一步练习建议。
- **读解结果页**：
  - 汇总整轮答错题目的弱点标签，推算核心读解薄弱点。
  - 在结果页新增“主要薄弱点”（如：读解证据定位、读解主旨判断），并结合具体做错的题号，给出诸如“优先回看第 X 题的证据句，再复述为什么其他选项不成立”的精准建议。
- **听力结果页**：
  - 汇总答错题目的听力分析标签，推算核心漏听或陷阱类型。
  - 在结果页新增“主要漏听类型”（如：听力转折漏听、听力最终结论），结合错题号提示“重点区分题干问的是什么”，避免停留在空泛的对错层面上。
- **底层架构支撑**：
  - 复用 `wrongAnswerClassifier` 里的 `inferWrongAnswerErrorTypes`、`inferReadingWeaknessErrorTypes` 等逻辑，从 `tags` 中提取推算对应的 `WEAKNESS_ERROR_META` 并将其可视化。

本轮验证通过的内容：
- `npx tsc --noEmit` 通过，无类型错误。
- 保证了没有答错题时，依然提供保持题感或推进新内容的平滑过度建议。

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
