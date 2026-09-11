# 用 JLPT N2 Trainer 零基础入门 AI 应用开发

> 适合谁：会一点点 JavaScript、TypeScript 或 Python，但对大模型、RAG、Embedding、Prompt 等概念不熟悉的人。
>
> 学习目标：不是从零训练一个大模型，而是学会把现成的大模型可靠地接入真实产品。完成本指南后，你应该能用自己的话解释并修改本项目的 AI 主链路。

## 先明确：你在这个项目里学的是哪一种 AI

“学习 AI”常常混合了三条不同路线：

1. **AI 应用开发**：调用现成大模型，把它接进产品，并处理知识、数据、校验、缓存、评估和失败回退。
2. **机器学习 / 深度学习**：用数据训练分类、预测或生成模型，需要更多数学、算法和训练框架知识。
3. **AI 研究**：设计新模型、新训练方法或新推理算法，通常要求更系统的数学和论文基础。

这个项目主要属于第一条：**AI 应用开发（AI Engineering）**。

你暂时不需要先学微积分、线性代数、PyTorch 或自己训练模型。先学会以下完整闭环更实际：

```text
用户问题
  → 程序查找可信资料
  → 程序组织 Prompt
  → 调用大模型
  → 程序校验模型输出
  → 展示结果
  → 记录效果和失败情况
```

## 一句话理解这个项目

用户做错一道日语题后，程序先从题库中找到正确答案和证据，再让大模型把这些证据讲得更容易理解，最后由程序检查模型有没有乱改事实。

请先记住项目最重要的一句话：

```text
知识库决定事实，模型负责表达，程序负责校验。
```

例如：

- “正确答案是哪一个”由题库决定。
- “怎样给学生解释得更清楚”可以交给大模型。
- “模型是否返回了合法 JSON、有没有伪造字段”由程序检查。

这已经包含了真实 AI 产品最核心的思想：**不要把所有事情都交给模型。**

## 你需要的最少基础

开始前只需理解下面四件事，不熟也可以边做边学：

- 变量：给数据起名字，例如 `wrongCount = 3`。
- 函数：输入一些数据，经过处理后返回结果。
- JSON：前端、后端和模型之间传递数据的格式。
- HTTP API：一个程序通过 URL 请求另一个程序做事。

本项目使用两种主要语言：

- TypeScript：App 前端及本地业务逻辑。
- Python：FastAPI AI 服务、检索和模型调用。

你不需要同时精通它们。第一遍重点是看懂“数据怎样流动”，而不是记住每个语法细节。

## 开始前：先让项目在纯本地模式跑起来

在项目根目录执行：

```bash
npm test
npm run test:ai
```

这两组测试不要求真实模型 API Key。它们能证明：题库、检索、字段锁定、回退和评估等核心逻辑在本地就能运行。

启动 AI 服务：

```bash
npm run ai:dev
```

另开一个终端检查服务：

```bash
curl http://127.0.0.1:8000/health
```

你应该看到一段 JSON。先不用理解全部字段，只看：

- `status` 应为 `ok`。
- `knowledgeEntries` 表示可精确讲解的题目数量。
- `searchEntries` 表示可搜索的知识文档数量。
- 没配置模型时，`llmConfigured` 为 `false` 是正常的。

如果你只想启动整个开发环境，也可以运行：

```bash
npm run dev
```

## 推荐学习方式

不要只阅读。每一课都按这个循环进行：

```text
先猜结果 → 运行代码 → 看实际结果 → 改一个小地方 → 再运行测试 → 用自己的话复述
```

每天 45～90 分钟即可。建议先完成前 6 课，再回头阅读 `AI-INTERVIEW-GUIDE.md`。

---

## 第 1 课：先认识“数据”，暂时不碰大模型

### 目标

理解 AI 系统不是凭空回答，它需要明确的输入、事实和输出。

### 阅读代码

先打开：

- `src/data/seed/drill_questions.json`
- `ai-service/app/knowledge_service.py`
- `ai-service/app/schemas.py`

在题库中找一条题目。重点观察：

- `id`：题目的唯一编号。
- `prompt`：题干。
- `choices`：选项。
- `answer`：正确选项的数组下标，从 0 开始。
- `choiceInsights`：每个选项的解释。
- `tags`：题型和考点标签。
- `source`：来源。

`build_grounded_explanation()` 会根据 `questionId` 查到题目，再用普通 Python 代码组装讲解。这里**没有调用 AI**。

### 动手验证

服务启动后，先从题库复制一个真实的文法或词汇题目 ID，然后执行：

```bash
curl -X POST http://127.0.0.1:8000/explain-wrong-answer \
  -H 'Content-Type: application/json' \
  -d '{"questionId":"替换成真实题目ID","selectedChoice":1,"wrongCount":1}'
```

如果 `selectedChoice` 超出该题选项范围，请换成 `0`、`1`、`2` 或 `3` 中合法的值。

### 你应该理解

这里的“可信讲解”首先是一个普通的数据工程问题：

```text
questionId → 查题库 → 读取事实 → 组装 JSON
```

### 小练习

把一个不存在的 `questionId` 发给接口，观察它为什么返回 404。然后阅读 `main.py` 中的 `/explain-wrong-answer` 路由，找到拒答代码。

完成标准：你能解释为什么“查不到就拒答”比“让模型猜一个答案”更可靠。

---

## 第 2 课：理解前端、后端和 API

### 目标

看懂一次错题讲解请求怎样从 App 走到 Python 服务，再返回 App。

### 阅读顺序

1. `src/services/aiCoachClient.ts` 中的 `getWrongAnswerExplanation()`。
2. 同文件中的 `requestFastApiExplanation()`。
3. `ai-service/app/main.py` 中的 `explain_wrong_answer()`。
4. `ai-service/app/knowledge_service.py` 中的 `build_grounded_explanation()`。
5. `ai-service/app/schemas.py` 中的 `WrongAnswerExplanation`。

完整路径是：

```text
App 错题数据
  → fetch 发送 HTTP POST
  → FastAPI 接收 JSON
  → Pydantic 检查输入
  → Python 查题库并构造讲解
  → Pydantic 检查输出
  → FastAPI 返回 JSON
  → App 展示
```

### 四个词的白话解释

- **前端**：用户看到和点击的 App。
- **后端**：接收请求并处理业务的服务。
- **API**：前端和后端约定好的“通信窗口”。
- **Schema**：双方约定的数据形状和规则。

### 小练习

把请求中的 `wrongCount` 改成 `0`。`schemas.py` 规定它必须 `ge=1`，因此你会看到输入校验错误。

完成标准：你能说出 HTTP 请求中的 URL、请求 JSON 和响应 JSON 分别是什么。

---

## 第 3 课：第一次真正认识大模型和 Prompt

### 目标

理解大模型调用本质上也是一次带有输入和输出的 API 请求。

### 白话概念

- **LLM（大语言模型）**：根据前文预测并生成后续文本的模型。
- **Prompt**：发送给模型的指令和上下文。
- **System message**：告诉模型角色、边界和最高层任务要求。
- **User message**：本次具体问题和证据。
- **Temperature**：控制生成的随机程度；越低通常越稳定，但不代表一定正确。
- **Token**：模型读取和生成文本时使用的计量单位，也常用于计费。

### 阅读代码

打开 `ai-service/app/llm_gateway.py`，先只看：

- `get_llm_config()`：读取模型地址、Key 和模型名。
- `_build_request()`：构造 HTTP 请求。
- `enrich_with_llm()`：组织 Prompt、调用模型、解析结果。

不要第一遍就研究文件中的所有异常处理。

### 最重要的观察

程序发送给模型的并不只有“请解释这道题”，而是：

```text
角色与规则 + 允许使用的证据 + 输出格式 + 字段长度等限制
```

模型返回的也不是直接显示的一段随意文本，而是约定好的 JSON。

### 可选：接入真实模型

只有你已经有 OpenAI-compatible 服务的 API Key 时，才在 `.env.local` 中配置：

```bash
AI_LLM_BASE_URL=你的服务地址
AI_LLM_API_KEY=你的密钥
AI_LLM_MODEL=你的模型名
```

不要把真实 Key 写进 Git、截图、聊天记录或前端源码。配置后重启 AI 服务，再运行：

```bash
curl http://127.0.0.1:8000/health/ai
```

`reachable: true` 表示真实模型连接成功。没有 Key 也不影响继续学习后面的本地部分。

### 小练习

阅读 `enrich_with_llm()` 的 Prompt，分别找出：

1. 模型扮演什么角色。
2. 模型不能修改什么。
3. 模型必须返回哪些字段。
4. 模型输出有多长。

完成标准：你能解释“Prompt 是给模型的文本指令，但不是绝对安全规则”。

---

## 第 4 课：理解幻觉，以及为什么要锁定事实

### 目标

理解大模型为什么会“说得像真的，但实际不对”，以及本项目怎样降低这个风险。

### 什么是幻觉

大模型擅长生成语言，不等于它天然拥有可靠数据库。证据不足时，它仍可能生成流畅答案。这种无依据或错误内容通常称为**幻觉**。

本项目用三层办法控制它：

1. Prompt 告诉模型不能修改事实。
2. 模型只被要求生成五个文本字段。
3. 程序只合并白名单中的五个字段，其他字段即使返回也被忽略。

### 阅读代码

- Python：`ai-service/app/llm_gateway.py` 中的 `TEXT_FIELDS` 和 `enrich_with_llm()`。
- TypeScript：`src/services/aiCoachClient.ts` 中的 `WRONG_ANSWER_TEXT_FIELDS` 和 `mergeWrongAnswerAiText()`。
- 测试：`ai-service/tests/test_llm_gateway.py` 中的 `test_updates_only_allowed_text_fields`。

### 软约束与硬约束

```text
“请不要改答案”               → Prompt 软约束
程序根本不读取模型返回的答案   → 代码硬约束
```

模型可能不听话，所以可靠系统必须用普通代码守住边界。

### 小练习

阅读 `test_updates_only_allowed_text_fields`，找到测试中模型伪造的字段，再看最终结果为什么仍保留知识库事实。

然后运行：

```bash
cd ai-service
.venv/bin/python -m unittest tests.test_llm_gateway.LlmGatewayTest.test_updates_only_allowed_text_fields -v
```

完成标准：你能用一句话解释“模型负责软内容，程序控制硬事实”。

---

## 第 5 课：理解结构化输出、JSON 和 Pydantic

### 目标

理解真实应用为什么通常要求模型返回结构化数据，而不是一大段自由文本。

个性化辅导要求模型返回：

- 错误诊断。
- 正好三步判断路径。
- 易混点对比。
- 1～3 个复习动作。
- 一道含 2～4 个选项的迁移题。

如果让模型随便写一段文字，前端很难稳定地把这些内容放进不同卡片，也很难自动判断缺了什么。

### 阅读代码

- `ai-service/app/schemas.py` 中的 `PersonalizedTutorExplanation`。
- `ai-service/app/llm_gateway.py` 中的 `generate_personalized_tutor_with_metrics()`。
- `src/services/aiCoachClient.ts` 中的 `mergePersonalizedTutorResponse()`。

重点看这些校验：

- `reasoningSteps` 必须正好三项。
- 迁移题选项必须为 2～4 个。
- 答案下标必须落在选项范围内。
- 选项不能重复。

### 小练习

假设模型返回：

```json
{
  "reasoningSteps": ["第一步", "第二步"],
  "transferQuestion": {
    "choices": ["A", "B"],
    "answer": 5
  }
}
```

先不用运行，试着指出至少两个错误，再到代码中找到对应的检查。

完成标准：你能解释 Schema 就像“数据合同”，不符合合同的结果不能进入产品。

---

## 第 6 课：理解 RAG——先查资料，再让模型回答

### 目标

真正理解 RAG，而不是只背缩写。

RAG 是 **Retrieval-Augmented Generation**，中文常译为“检索增强生成”。白话就是：

```text
先从可信资料中找相关内容，再把找到的内容交给模型回答。
```

它通常分成两步：

1. **Retrieval（检索）**：找到与问题有关的资料。
2. **Generation（生成）**：模型基于资料组织答案。

本项目里有两条容易混淆的链路：

- 错题讲解：按 `questionId` 精确查找，更像“精确知识映射 + grounded generation”。
- 知识搜索：根据自然语言找 Top-K 相关文档，这才是完整的混合检索链路。

### 先运行一次搜索

```bash
curl -X POST http://127.0.0.1:8000/knowledge/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"表示不能做某事","modeId":"grammar_drill","limit":3}'
```

观察响应中的：

- `hits`：搜索命中的资料。
- `score`：最终相关性分数。
- `scores`：不同检索方法各自的分数。
- `matchReasons`：为什么命中。

### 阅读代码

按顺序只看这些函数：

1. `tokenize()`：把文字拆成可比较的词项。
2. `build_retrieval_index()`：提前整理所有资料。
3. `_bm25_score()`：计算关键词相关性。
4. `_cosine_similarity()`：计算 TF-IDF 向量方向的相似程度。
5. `_rerank_bonus()`：根据考点、标签和完整短语加分。
6. `search_knowledge()`：融合分数并返回 Top-K。

它们都位于 `ai-service/app/retrieval_service.py`。

### 暂时怎样理解 BM25 和 TF-IDF

第一遍不需要推公式，只记直觉：

- **BM25**：查询中的重要词在某篇资料里出现，而且不是所有资料里都常见，这篇资料就更相关；同时会处理文档长短和词频过高的问题。
- **TF-IDF**：一个词在当前资料中常见、在所有资料中少见，它更能代表这篇资料。
- **Cosine Similarity**：比较两组词语特征指向是否相近，越接近通常越相关。
- **Rerank（重排）**：初步找出候选后，再按业务规则重新排序。

### 小练习

分别搜索：

```text
に伴って
表示不能做某事
完全不存在的随机字符串
```

比较三次响应中的 `hits`、`scores` 和 `matchReasons`。

完成标准：你能清楚区分“检索”和“生成”，并知道 RAG 不等于向量数据库。

---

## 第 7 课：理解向量和 Embedding，但先不钻数学

### 目标

理解为什么关键词不一样的两句话也可能意思相近。

**Embedding** 会把文字转换成一串数字，也就是向量。含义相近的文字，其向量通常也更接近。

可以先把它想成一个“语义地图”：

```text
“不能做” ──距离近── “不允许”
“不能做” ─────────距离远───────── “天气晴朗”
```

本项目把 Embedding 设计成可选增强：

- 没有 Embedding：BM25 + TF-IDF 仍能搜索。
- 有有效向量缓存：再加入语义相似度。
- 服务失败或缓存失效：自动退回本地检索。

### 阅读代码

- `ai-service/app/embedding_service.py`
- `ai-service/scripts/build_embedding_index.py`
- `ai-service/tests/test_embedding_service.py`

先关注概念，不要急着接入付费服务：

- 为什么需要批量建立文档向量索引。
- 为什么普通查询只发送一条查询文本。
- 为什么缓存要记录模型名、文档指纹和向量维度。

### 小练习

运行 Embedding 的本地模拟测试：

```bash
cd ai-service
.venv/bin/python -m unittest tests.test_embedding_service -v
```

这些测试会模拟服务响应，不要求真实 API Key。

完成标准：你能解释 Embedding 是“文字的数字化语义表示”，并说明它为什么只是本项目的增强项。

---

## 第 8 课：理解个性化、状态与缓存

### 目标

理解“个性化 AI”不只是把用户名放进 Prompt。

本项目给模型的学习上下文包括：

- 用户这次选错了什么。
- 这道题累计错了几次。
- 当前弱点类型。
- 最近有多少同类错误。
- 最近的同类考点。

阅读：

- `src/domain/services/personalizedTutorService.ts`
- `src/services/aiCoachClient.ts` 中的 `getPersonalizedTutorExplanation()`。
- `ai-service/app/llm_gateway.py` 中的 `generate_personalized_tutor_with_metrics()`。

### 为什么缓存键不能只有 questionId

同一道题第一次做错和第四次做错，辅导内容应该不同。因此缓存键是：

```text
questionId + contextVersion
```

`contextVersion` 会随错误次数、误选项、同类错误数量和迁移题结果变化。

### 小练习

阅读 `buildTutorLearningContext()`，手算以下两次上下文版本是否相同：

- 第一次：错 1 次，误选 2，同类错题 0，未做迁移题。
- 第二次：错 2 次，误选 2，同类错题 0，未做迁移题。

完成标准：你能解释“个性化数据变化后，旧回答为什么不能继续复用”。

---

## 第 9 课：理解失败回退——AI 不可用，产品仍要能用

### 目标

建立生产级 AI 应用最重要的意识之一：模型调用一定会失败。

可能的失败包括：

- 没有配置 API Key。
- 网络超时。
- 模型服务报错。
- 返回的不是 JSON。
- 字段缺失或类型错误。
- 模型生成了非法迁移题。

本项目的普通错题讲解顺序是：

```text
先构造本地讲解
  → 尝试 FastAPI 模型润色
  → 失败则尝试代理
  → 再失败则返回本地讲解
```

阅读 `src/services/aiCoachClient.ts` 中的 `getWrongAnswerExplanation()`，找到每个 `try/catch` 和最终的 `return localExplanation`。

### 小练习

不配置模型，调用 `/explain-wrong-answer`。观察 `generationMode` 为什么是 `local_knowledge`，同时讲解仍然可用。

完成标准：你能解释“降级不是报错处理的小细节，而是 AI 产品架构的一部分”。

---

## 第 10 课：理解 AI 评估——不能只凭“看起来不错”

### 目标

理解 AI 输出有随机性，因此必须用固定案例和指标持续检查。

阅读：

- `ai-service/evaluation/fixed_set.json`
- `ai-service/app/evaluation.py`
- `ai-service/tests/test_evaluation.py`

项目评估的内容包括：

- 模型成功率和回退率。
- JSON 结构校验失败率。
- 锁定事实是否正确。
- 回答是否使用真实个性化信息。
- 响应延迟。
- Prompt / Completion Token。
- 估算成本。
- 迁移题质量。

### 三类指标

- **正确性**：有没有改错事实、引用是否真实。
- **可用性**：结构是否合法、失败时能否回退。
- **效率**：延迟、Token 和成本是否可接受。

### 小练习

先运行不依赖真实模型的评估器测试：

```bash
cd ai-service
.venv/bin/python -m unittest tests.test_evaluation -v
```

如果以后配置了真实模型，再用少量案例检查连通性：

```bash
npm run ai:evaluate -- --limit 2
```

完整 40 案例运行可能产生 API 费用，不要在不清楚模型价格时直接运行。

完成标准：你能提出至少一个“正确性指标”和一个“效率指标”。

---

## 第 11 课：最后再学受控 Web RAG 和安全边界

### 目标

理解“让 AI 上网”为什么不只是加一个搜索按钮。

网页可能存在：

- 错误或互相冲突的资料。
- Prompt Injection（网页中的文字诱导模型忽略原规则）。
- 恶意 URL、私网地址和危险重定向。
- 版权、超时和内容随时变化的问题。

本项目没有在用户请求时开放搜索整个互联网，而是：

```text
审批来源 → 手动同步 → 清洗 → 哈希与过期检查 → 本地缓存搜索
```

阅读：

- `ai-service/web_sources.json`
- `ai-service/app/controlled_web_service.py`
- `ai-service/app/research_service.py`
- `ai-service/tests/test_controlled_web_service.py`

### 小练习

运行：

```bash
cd ai-service
.venv/bin/python -m unittest tests.test_controlled_web_service -v
```

找到拒绝 HTTP、非白名单主机、私网地址、过期缓存和被篡改缓存的测试。

完成标准：你能解释为什么网络资料只能补充本地事实，不能覆盖本地答案。

---

## 一条适合零基础的 14 天路线

每天不需要完成很多，能复述比“看完”更重要。

| 天数 | 学习内容 | 当天成果 |
|---|---|---|
| 第 1 天 | JSON、题库字段、第 1 课 | 能找到一道题的输入和正确答案 |
| 第 2 天 | 函数、`knowledge_service.py` | 能讲清本地讲解怎样生成 |
| 第 3 天 | HTTP、FastAPI、第 2 课 | 能用 curl 调用接口 |
| 第 4 天 | LLM、Prompt、第 3 课 | 能在代码中找到 Prompt 的四部分 |
| 第 5 天 | 幻觉、事实锁定、第 4 课 | 能解释软约束和硬约束 |
| 第 6 天 | JSON 输出、Schema、第 5 课 | 能指出非法模型输出 |
| 第 7 天 | 复习并画主链路 | 不看文档画出错题讲解流程 |
| 第 8 天 | RAG、第 6 课 | 能区分检索和生成 |
| 第 9 天 | BM25、TF-IDF、重排 | 能解释三者各自作用 |
| 第 10 天 | Embedding、第 7 课 | 能解释语义向量和缓存 |
| 第 11 天 | 个性化与缓存、第 8 课 | 能解释 contextVersion |
| 第 12 天 | 回退、第 9 课 | 能列出三种模型失败情况 |
| 第 13 天 | 评估、第 10 课 | 能设计两个 AI 质量指标 |
| 第 14 天 | Web RAG 与总复习 | 能做 3 分钟项目讲解 |

## 建议完成的 5 个代码小改动

按从简单到困难排列。每次只改一件事，并运行相关测试。

### 练习 1：修改本地回退提示

在 `knowledge_service.py` 中找到默认复习提示，修改一句文案。理解：这是确定性代码，不是 AI 生成。

### 练习 2：给输入增加一个简单限制

在 `schemas.py` 中调整某个字符串或数字字段的限制，并编写一个失败测试。理解：Schema 如何保护接口。

### 练习 3：新增一个检索命中原因

在 `_rerank_bonus()` 中为某种明确业务条件增加原因，并写测试。理解：业务规则如何影响 AI 检索。

### 练习 4：增加一个模型输出校验

例如限制迁移题题干不能为空，并补充测试。理解：不能信任模型输出。

### 练习 5：增加一个评估指标

例如统计回答中是否提到真实误选项。理解：怎样把“感觉不错”变成可重复检查的数据。

## 零基础术语表

| 术语 | 白话解释 | 本项目位置 |
|---|---|---|
| LLM | 能理解和生成文字的大语言模型 | `llm_gateway.py` |
| Prompt | 发给模型的任务指令和资料 | `enrich_with_llm()` |
| RAG | 先检索可信资料，再基于资料生成 | `retrieval_service.py` + `llm_gateway.py` |
| Knowledge Base | 保存题目、答案、解析和来源的知识库 | `src/data/seed/` |
| Grounding | 让生成内容以给定证据为依据 | `build_grounded_explanation()` |
| Hallucination | 模型生成了无依据或错误内容 | 字段白名单和拒答机制用于降低它 |
| Schema | 输入输出必须遵守的数据合同 | `schemas.py` |
| BM25 | 偏重关键词相关性的排序方法 | `_bm25_score()` |
| TF-IDF | 衡量词对一篇资料有多大代表性 | `build_retrieval_index()` |
| Cosine Similarity | 比较两个向量方向是否接近 | `_cosine_similarity()` |
| Embedding | 把文字转换为表达语义的数字向量 | `embedding_service.py` |
| Rerank | 对初步候选再次排序 | `_rerank_bonus()` |
| Top-K | 只取分数最高的 K 条结果 | `search_knowledge()` |
| Cache | 保存结果，避免重复计算或调用模型 | `personalizedTutorService.ts` |
| Fallback | AI 失败时退回仍可用的确定性功能 | `getWrongAnswerExplanation()` |
| Token | 模型处理文本的计量单位 | `evaluation.py` |
| Temperature | 控制生成随机程度的参数 | `llm_gateway.py` |
| Prompt Injection | 不可信内容试图诱导模型违反原指令 | `controlled_web_service.py` |

## 学完后，请用这 10 个问题自测

如果不能回答，就回到对应课程，不需要死记答案。

1. 这个项目为什么不让 LLM 决定正确答案？
2. 普通错题讲解中，哪些内容来自知识库，哪些内容可以由模型生成？
3. Prompt 为什么只是软约束？
4. Pydantic Schema 解决了什么问题？
5. RAG 的检索和生成分别发生在哪里？
6. BM25、TF-IDF 和 Embedding 的直觉区别是什么？
7. 为什么当前 886 条数据不一定需要向量数据库？
8. 为什么个性化缓存键不能只有 `questionId`？
9. 模型超时或返回非法 JSON 时，产品怎样处理？
10. 如何证明 AI 功能质量，而不是只展示一两个漂亮回答？

## 学习完成标准

当你可以不看文档讲清下面这段话，就已经完成了 AI 应用开发的第一轮入门：

> 这个项目先用普通程序从本地题库获得正确答案、考点和来源，再把这些证据放进 Prompt 调用大模型。模型只负责生成教学表达，返回结果必须符合 JSON Schema；程序通过字段白名单重新锁定事实。自然语言知识搜索使用 BM25、TF-IDF、可选 Embedding 和业务重排。模型或网络不可用时退回本地能力，并通过固定案例评估正确性、结构、延迟、Token 和成本。

然后再阅读：

1. `AI-INTERVIEW-GUIDE.md`：把知识串成面试表达。
2. `AI-PERSONALIZED-TUTOR-DESIGN.md`：深入个性化与迁移题设计。
3. `ai-service/README.md`：了解服务配置和完整接口。

## 最后提醒

- 不要因为暂时看不懂公式就认为自己不适合 AI。AI 应用开发首先需要的是清晰的数据流、边界意识和实验能力。
- 不要一开始追求所有热门名词。先真正理解这个项目的一条端到端链路。
- 每学一个概念，都在项目中找到对应代码、测试和实际响应。
- 面试时只讲自己真正理解和验证过的内容，不把规则统计说成机器学习，也不把精确查表说成向量检索。
