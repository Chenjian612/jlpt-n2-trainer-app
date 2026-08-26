# 部署说明

这份文档只讲“怎么把当前仓库部署出去”。本地开发和日常启动命令见 `DEV_STARTUP.md`。

## 先说结论

对这个仓库，当前最稳的部署方式是：

1. 把 Expo Web 导出成静态文件
2. 部署 `dist/` 到静态托管平台
3. 不把真实模型 API Key 暴露到前端
4. AI 错题辅导可部署现有 FastAPI `ai-service`；若只使用外部模型润色，也可继续用 Worker 代理保管密钥

原因很直接：

- 当前仓库包含可选的 FastAPI AI 服务，但训练主流程仍是本地优先，未启动 AI 服务也能使用本地结构化讲解
- 当前 Web 产物可以导出为静态站点
- 当前 AI 功能如果直接使用 `EXPO_PUBLIC_AI_API_KEY`，密钥会进入前端构建产物

## 当前仓库的部署特征

- Expo Web 项目
- 当前 `app.json` 没有额外声明 `expo.web.output`，按 Expo 文档属于默认 `single` 输出
- 当前仓库没有 Expo Router API routes，也没有服务端渲染需求
- 当前已经存在 `dist/` 产物，说明静态导出链路是通的

这意味着：

- 你可以把它当成静态网站来部署
- 如果保留 AI 功能，AI 请求必须改走代理

## 推荐方案

### 方案 A：静态托管 + FastAPI AI 服务（功能最完整）

适合需要保留混合检索、个性化辅导、质量遥测和受控 Web RAG 的部署。

```text
浏览器
  -> 静态站点（Cloudflare Pages / Netlify / Vercel）
  -> FastAPI ai-service
  -> 本地知识库 / 可选 Embedding / 可选模型 API / 受控 Web 缓存
```

前端通过 `EXPO_PUBLIC_AI_SERVICE_URL` 指向服务地址。模型密钥、Embedding 配置和 Web RAG 缓存均留在服务端，具体变量与启动方式见 [AI Service README](./ai-service/README.md)。

### 方案 B：静态托管 + 模型代理

适合只需要静态应用和基础模型润色的轻量部署，复杂度最低，但不包含完整 FastAPI RAG 能力。

部署结构：

```text
浏览器
  -> 静态站点（Cloudflare Pages / Netlify / Vercel 静态托管）
  -> AI 代理（Cloudflare Worker / 你的服务端）
  -> OpenAI / DeepSeek / Claude
```

### 第一步：准备构建环境变量

如果你要上线且保留 AI 功能，不要把真实密钥直接放进前端公开变量。

推荐构建配置：

```env
EXPO_PUBLIC_AI_PROVIDER=deepseek
EXPO_PUBLIC_AI_API_KEY=not-used
EXPO_PUBLIC_DEEPSEEK_PROXY_URL=https://your-worker.workers.dev
```

说明：

- `EXPO_PUBLIC_AI_PROVIDER` 也可以换成 `openai` 或 `claude`
- `EXPO_PUBLIC_DEEPSEEK_PROXY_URL` 这个名字是历史遗留，但当前代码会把它当通用代理地址用
- 如果你暂时不需要 AI 功能，也可以不给代理地址，只是“为什么我错了？”会不可用

### 第二步：导出 Web 静态产物

根据 Expo 官方文档，Web 构建导出命令是：

```bash
npx expo export -p web
```

导出后产物在：

```text
dist/
```

本地用生产方式快速验包：

```bash
npx expo serve
```

### 第三步：把 `dist/` 部署到静态托管平台

任何能托管静态目录的平台都可以，关键是把输出目录指向 `dist`。

如果你使用 Git 集成托管，核心配置通常就是：

- Build command: `npx expo export -p web`
- Output directory: `dist`

当前仓库更适合的候选：

- Cloudflare Pages
- Netlify
- Vercel（按静态站点方式）
- Firebase Hosting

### 第四步：配置 AI 代理

如果你保留 AI 错题分析，建议单独部署一个 Worker。

下面是 DeepSeek 代理示例：

```javascript
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'content-type, Authorization',
        },
      });
    }

    const body = await request.text();
    const upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body,
    });

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
```

如果你切换到：

- OpenAI：把上游地址换成 `https://api.openai.com/v1/chat/completions`
- Claude：把上游地址换成 `https://api.anthropic.com/v1/messages`，并改成 Claude 需要的 header 形式

### 第五步：上线后验证

至少检查这些点：

- 首页能正常打开
- 进入 9 个训练模式不会白屏
- 完成一轮训练后本地进度能写入
- 错题回收队列正常出现
- 如果启用了 AI，点击“为什么我错了？”能拿到结果

## Cloudflare Pages 建议

如果你继续用 Cloudflare 体系，当前仓库最顺手的组合是：

- Cloudflare Pages 托管 `dist/`
- Cloudflare Worker 保管模型密钥

推荐做法：

1. Pages 只托管静态文件
2. AI 请求使用现有 Worker：`https://jlpt-ai-proxy.08075921888chenjian.workers.dev`
3. Worker 必须允许 Pages 站点的 `POST` 和 `OPTIONS` 跨域请求，并允许 `content-type`、`authorization` 请求头
4. Web 端已内置该 Worker 地址；也可以用 `EXPO_PUBLIC_DEEPSEEK_PROXY_URL` 覆盖

可选变量：

- Worker Secret：模型 API Key（名称必须与 Worker 代码读取的 binding 一致）
- Worker 上游地址：`https://api.deepseek.com/v1/chat/completions`
- 前端请求地址：`https://jlpt-ai-proxy.08075921888chenjian.workers.dev/v1/chat/completions`

部署后先验证代理配置是否生效。未配置密钥时接口会返回 503（不会泄露配置细节）：

```bash
curl -i -X POST https://jlpt-ai-proxy.08075921888chenjian.workers.dev/v1/chat/completions \
  -H 'content-type: application/json' \
  --data '{"messages":[{"role":"user","content":"Reply with only: ok"}]}'
```

这样 Pages 不接触密钥，Worker 统一负责 CORS、鉴权和模型转发。

## 可选方案：EAS Hosting

如果你后面希望把 Web 部署流程也纳入 Expo / EAS 体系，可以考虑 EAS Hosting。

根据 Expo 官方文档，基本流程是：

```bash
npx expo export --platform web
eas deploy
```

生产发布：

```bash
eas deploy --prod
```

这个方案的前提是：

- 你已经安装并登录 EAS CLI
- 你愿意把 Web 部署也放进 Expo 的平台体系

对当前仓库来说，它不是必须的。就现状看，静态托管 + 代理已经足够。

## 不推荐的做法

### 不推荐 1：把真实 API Key 直接写进前端公开环境变量

这样构建后的 JS 里会带上密钥，任何人都可以拿去调用。

### 不推荐 2：把部署说明继续塞回启动文档

启动说明解决的是“我本地怎么跑”；部署说明解决的是“别人怎么访问、密钥怎么保管”。这两个问题不该继续混在一个文件里。

### 不推荐 3：未验包就直接上线

至少先跑一次：

```bash
npx expo export -p web
npx expo serve
```

确认静态产物本身是正常的，再交给托管平台。

## 参考

- Expo 文档：`npx expo export -p web` 导出到 `dist/`
- Expo 文档：Web 默认可部署到 EAS Hosting 或第三方静态托管
