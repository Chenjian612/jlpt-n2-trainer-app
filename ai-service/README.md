# AI Service

FastAPI 错题讲解与轻量 RAG 检索服务。讲解链路按 `questionId` 精确读取本地文法/词汇知识，返回带来源的结构化证据；自然语言检索链路使用 BM25 + 本地 TF-IDF 向量混合召回和规则重排。两条链路都不会让模型改写答案或来源。

## 启动

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 8000 --env-file ../.env.local
```

App 配置：

```bash
EXPO_PUBLIC_AI_SERVICE_URL=http://localhost:8000
```

未配置服务地址或服务暂时不可用时，App 会使用相同规则从本地知识库生成讲解。

## 当前能力：可选模型润色

服务默认不依赖模型也能工作。配置以下环境变量后，会调用 OpenAI-compatible API；模型只能润色检索结果中的讲解字段，答案、考点和来源仍由本地知识库锁定。

除受控润色外，服务已提供 `POST /tutor/wrong-answer` 个性化辅导接口。它结合误选项、累计错误和近期同类错误，生成诊断、三步判断路径、复习动作和迁移题。设计与实现边界见 [个性化 AI 错题辅导设计](../AI-PERSONALIZED-TUTOR-DESIGN.md)。

```bash
AI_LLM_BASE_URL=https://api.deepseek.com/v1
AI_LLM_API_KEY=your_server_side_key
AI_LLM_MODEL=deepseek-chat
```

启动后先做两级检查：

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/health/ai
```

- `/health` 只检查 FastAPI、知识库和模型配置，不访问外网。
- `/health/ai` 会向模型发送固定的 `Reply with only: ok` 探针，不包含题库、错题或学习记录。`reachable: true` 才表示外部模型真实可访问。
- `/explain-wrong-answer` 响应中的 `generationMode` 为 `ai_service` 表示模型润色成功；为 `local_knowledge` 表示模型调用失败，服务已自动回退到本地知识库讲解。
- `/tutor/wrong-answer` 只在模型成功且结构校验通过时返回 `generationMode: ai_tutor`；模型不可用或迁移题结构无效时返回 503，前端继续保留知识库事实讲解。

## AI-M3 轻量知识检索

`POST /knowledge/search` 支持按中文学习意图、日语考点、题目线索、读解原文或听力信号检索 886 条知识文档，包括 800 道文法/词汇题、60 道读解题和 26 道听力题。服务使用适合中日混合文本的字符二元分词，同时执行 BM25 召回和本地稀疏 TF-IDF 向量召回，再按完整短语、考点和标签命中进行确定性重排，不依赖外部模型。

```bash
curl -X POST http://127.0.0.1:8000/knowledge/search \
  -H 'Content-Type: application/json' \
  -d '{"query":"表示不能或不可以做某事","modeId":"grammar_drill","limit":5}'
```

响应中的 `score` 是归一化后的混合排序分数，`scores` 分别保留 BM25、TF-IDF、可选语义 Embedding 和规则重排分数；`matchReasons` 解释命中依据，`sourceLabel` 保留原始资料来源。纯本地模式没有任何词项命中时返回空 `hits`，不会调用模型补写结果；显式启用且缓存有效时，语义召回可以补充关键词不重合的候选。

读解结果的 `contentType` 为 `reading_question`，并额外返回 `evidenceLocation`：文章 ID、标题、1 开始的段落编号、真实段落原文、题库证据引用和引用片段。定位以引用内容反查原文为主，不只相信人工填写的段号；当前 60 道读解题均通过可追溯性测试。

听力结果的 `contentType` 为 `listening_question`，并返回 `listeningEvidence`：案例、场景、对话、作答依据、关键信号、陷阱和听题清单。`evidenceType` 明确区分 `audio_transcript`（官方音频转写片段）、`dialogue_quote`（文字对话原句）、`stimulus_response`（即时应答刺激与回应）和 `pedagogical_summary`（教学性中日转换依据），不会把模拟对话或翻译依据标成逐字音频转写。

### 可选语义 Embedding

语义召回默认关闭，未配置时接口保持 `hybrid_tfidf_rerank`。如需启用 OpenAI-compatible Embedding 服务，使用独立的服务端环境变量：

```bash
AI_EMBEDDING_ENABLED=true
AI_EMBEDDING_BASE_URL=https://api.openai.com/v1
AI_EMBEDDING_API_KEY=your_server_side_key
AI_EMBEDDING_MODEL=text-embedding-3-small
```

配置后显式构建索引：

```bash
npm run ai:embeddings
```

该命令会把 886 条题库检索文本发送给所配置的第三方 Embedding 服务，并将向量写入被 Git 忽略的 `ai-service/.cache/embedding-index.json`。仅在确认服务条款、数据授权和费用后运行。普通搜索不会自动批量外发题库；缓存存在且题库指纹、模型完全匹配时，才会发送单条查询文本并启用 `hybrid_semantic_rerank`。缓存失效、服务超时或响应异常时自动回退到本地 BM25 + TF-IDF 检索。

`/health` 的 `embeddingConfigured` 与 `embeddingIndexReady` 分别表示配置是否完整、缓存是否可用；`retrievalMode` 显示当前实际模式。语义模式的 `scores.semantic` 和“语义 Embedding 相似”命中原因可用于解释排序。

## AI-M4 受控 Web RAG

Web RAG 默认关闭，不使用开放搜索引擎，也不会在用户请求期间临时爬网。仓库内的 `web_sources.json` 是审批来源目录，默认只包含 JLPT 官方普通 HTML 页面。同步器拒绝 HTTP、带凭据 URL、非白名单主机、私网解析地址、跨白名单重定向、非 HTML 内容和超过 1 MB 的响应；脚本、样式及常见提示注入文本会在入库前清除。

启用并显式同步：

```bash
AI_WEB_RAG_ENABLED=true
AI_WEB_RAG_ALLOWED_HOSTS=jlpt.jp,www.jlpt.jp,samplequestions.jlpt.jp,jpf.go.jp,www.jpf.go.jp
npm run ai:web-sync
```

同步结果写入被 Git 忽略的 `ai-service/.cache/web-sources.json`，包含 URL、UTC 访问时间和内容哈希。默认有效期为 168 小时，可通过 `AI_WEB_RAG_MAX_AGE_HOURS` 调整。来源从审批目录移除、URL 改变、内容哈希不符或缓存过期后，缓存会被拒绝使用。

出于版权边界，同步器只读取审批页面的 HTML 说明文本，不自动下载或解析官方页面链接的 PDF、ZIP、PPT、MP3，也不把网页缓存提交到仓库。JLPT 官方页面提示部分 N2 读解题和听力音频包含第三方著作权内容，使用者仍需遵守页面版权说明。

`POST /knowledge/search` 只有同时满足以下条件才返回网络补充：

1. 请求显式传入 `allowWeb: true`；
2. 本地 BM25、TF-IDF 或语义证据未达到充分阈值；
3. Web RAG 已启用且存在未过期的审批缓存；
4. 查询与缓存内容确有匹配。

网络结果单独位于 `webSources`，不会混入本地 `hits`。每条来源包含 `sourceType`、URL、访问时间、内容哈希，并固定返回 `usagePolicy: supplemental_only` 与 `canOverrideLocalFacts: false`。`webFallbackReason` 会区分本地证据充分、未请求、功能关闭、无缓存、无匹配和本地证据不足。

`POST /knowledge/research` 在同一检索边界上提供受控回答。模型只能返回服务端锁定的来源 ID；伪造引用、结构错误或模型不可用时，会降级为摘录式回答。若本地与受控网络缓存都没有证据，接口返回 404，不让模型自行补全。

```bash
curl -X POST http://127.0.0.1:8000/knowledge/research \
  -H 'Content-Type: application/json' \
  -d '{"query":"N2 各题型主要考查什么","allowWeb":true,"webLimit":3}'
```

`/health` 通过 `webRagEnabled` 与 `webCacheEntries` 显示受控 Web RAG 的运行状态。同步失败不会清空仍然有效的旧缓存，普通检索也始终保留纯本地回退。

`generationMode` 是客户端判断缓存和降级状态的接口字段，不是页面标题。前端在 `ai_service` 成功时不显示额外徽标，在 `local_knowledge` 或旧缓存状态下分别显示“本地知识库”或“历史缓存”；个性化辅导使用“智能辅导”。

Codex 不能在没有逐项授权目标和数据的情况下，代替用户把本地真实题目发送给第三方模型。这是开发工具的数据外发安全限制，不是 App 的运行限制。展示前先用 `/health/ai` 验证网络和模型，再由使用者在 App 中点击“使用 AI 重新讲解”完成真实业务验证。

Web 对外展示时，访客不能访问你电脑上的 `127.0.0.1:8000`。项目在 DeepSeek 模式下支持展示降级：优先访问 FastAPI；FastAPI 不可达或只返回本地讲解时，浏览器改用 `EXPO_PUBLIC_DEEPSEEK_PROXY_URL` 润色 App 内置知识库结果。两条链路都只合并五个讲解字段，不接受模型改写考点、答案分析和来源。

完整讲解比 `/health/ai` 的短探针耗时更长。服务端生成超时为 45 秒，Web 端等待上限为 55 秒；展示时按钮会保持加载状态，不要在生成过程中重复点击。

服务使用 `certifi` 的 CA 证书库验证模型 API 的 HTTPS 证书。不要通过关闭 SSL 校验来处理本地证书链问题。

## AI-M2 固定质量评估

`evaluation/fixed_set.json` 提供 40 个固定案例，文法与词汇各 20 个，并为同一道题覆盖首次错误和第 4 次重复错误两种学习上下文。评估器会统计成功/回退、结构校验失败、锁定字段、个性化依据、响应耗时、迁移题质量和模型 token 成本。

先配置服务端模型，再显式运行：

```bash
AI_LLM_INPUT_COST_PER_MILLION=1 \
AI_LLM_OUTPUT_COST_PER_MILLION=2 \
npm run ai:evaluate -- --output ai-service/evaluation/latest-report.json
```

单价单位是美元/百万 token，应填写当前所用模型的实际价格。未配置单价时仍统计 token，成本显示为 `0`。开发时可用 `--limit 2` 做小规模连通检查；完整质量报告必须运行全部 40 个案例。

迁移题质量分由六项可复现规则组成：考点保持、题干不是原题复制、选项不重复、答案索引合法、解释非空、题干或解释包含考点锚点。报告同时保留逐案例失败原因，便于区分模型不可用（回退）与结构校验失败。
