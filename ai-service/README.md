# AI Service

第一阶段的 FastAPI 错题讲解服务。服务按 `questionId` 精确检索本地文法/词汇知识，返回带来源的结构化讲解；未命中时返回 404，不让模型猜答案。

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

## 可选模型润色

服务默认不依赖模型也能工作。配置以下环境变量后，会调用 OpenAI-compatible API；模型只能润色检索结果中的讲解字段，答案、考点和来源仍由本地知识库锁定。

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

Codex 不能在没有逐项授权目标和数据的情况下，代替用户把本地真实题目发送给第三方模型。这是开发工具的数据外发安全限制，不是 App 的运行限制。展示前先用 `/health/ai` 验证网络和模型，再由使用者在 App 中点击“使用 AI 重新讲解”完成真实业务验证。

Web 对外展示时，访客不能访问你电脑上的 `127.0.0.1:8000`。项目在 DeepSeek 模式下支持展示降级：优先访问 FastAPI；FastAPI 不可达或只返回本地讲解时，浏览器改用 `EXPO_PUBLIC_DEEPSEEK_PROXY_URL` 润色 App 内置知识库结果。两条链路都只合并五个讲解字段，不接受模型改写考点、答案分析和来源。

完整讲解比 `/health/ai` 的短探针耗时更长。服务端生成超时为 45 秒，Web 端等待上限为 55 秒；展示时按钮会保持加载状态，不要在生成过程中重复点击。

服务使用 `certifi` 的 CA 证书库验证模型 API 的 HTTPS 证书。不要通过关闭 SSL 校验来处理本地证书链问题。
