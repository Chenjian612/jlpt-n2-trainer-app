# 开发环境启动说明

这份文档只写当前仓库真实可用的启动方式和 AI 配置，不保留旧方案口径。正式部署流程见 `DEPLOYMENT.md`。

## 日常开发默认命令

```bash
npm run dev
```

它会同时启动：

- Expo dev server
- 本地代理脚本 `scripts/claude-proxy.js`

如果你只是想单独跑某一部分，也可以用：

```bash
npm run start   # 只启动 Expo
npm run proxy   # 只启动本地代理
npm run web     # 启动 Web 目标
```

## `.env.local`

项目根目录需要 `.env.local`。推荐从 `.env.example` 复制一份再修改。

最小配置：

```env
EXPO_PUBLIC_AI_API_KEY=<your_api_key>
EXPO_PUBLIC_AI_PROVIDER=openai
```

如果你要在 Web 端使用 Claude，或者希望 DeepSeek / OpenAI 也走自建代理，再加：

```env
EXPO_PUBLIC_DEEPSEEK_PROXY_URL=http://localhost:9876
```

当前代码支持的 provider：

- `openai`
- `deepseek`
- `claude`

默认行为：

- 未设置 `EXPO_PUBLIC_AI_PROVIDER` 时，默认使用 `openai`
- `EXPO_PUBLIC_DEEPSEEK_PROXY_URL` 虽然变量名保留了 `DEEPSEEK`，但现在实际是通用代理地址

## 推荐工作流

### 1. 安装依赖

```bash
npm install
```

### 2. 启动日常开发环境

```bash
npm run dev
```

### 3. 需要 Web 时启动 Web 目标

```bash
npm run web
```

Playwright Web 测试默认访问：

```text
http://127.0.0.1:19006
```

如果你的 Expo Web 跑在别的地址，运行测试前先设置 `BASE_URL`。

## AI 功能说明

当前 AI 功能只用于错题回收页的“为什么我错了？”分析，不影响核心训练闭环。

不同 provider 的调用方式：

- `openai`
  - 默认直连 `https://api.openai.com/v1/chat/completions`
- `deepseek`
  - 未配置代理时直连 `https://api.deepseek.com/v1/chat/completions`
  - 配置 `EXPO_PUBLIC_DEEPSEEK_PROXY_URL` 后改走代理
- `claude`
  - 未配置代理时直连 `https://api.anthropic.com/v1/messages`
  - Web 场景通常需要代理来处理 CORS，因此建议设置 `EXPO_PUBLIC_DEEPSEEK_PROXY_URL=http://localhost:9876`

## 测试命令

```bash
npm test
npx tsc --noEmit
npm run test:web:components
npm run test:web:e2e
```

说明：

- `npm test` 运行仓库内的 Node 侧逻辑测试
- 两个 `test:web:*` 脚本依赖你先把 Web 端跑起来

## 常见问题

### AI 分析按钮报错

优先检查：

- `.env.local` 是否存在
- `EXPO_PUBLIC_AI_API_KEY` 是否已填写
- `EXPO_PUBLIC_AI_PROVIDER` 是否和你准备使用的模型一致
- Claude on Web 是否已经配置代理地址

### Web 测试连不上页面

优先检查：

- `npm run web` 是否已经启动
- `BASE_URL` 是否和实际地址一致

### 启动后页面仍然拿旧环境变量

改完 `.env.local` 后重启 Expo；必要时清缓存：

```bash
npx expo start --clear
```

## 部署提醒

如果直接把前端构建产物公开出去，而又把真实模型 API Key 放在 `EXPO_PUBLIC_*` 环境变量里，Key 会暴露给客户端。

要分享或部署时，应该改成：

- 服务端代理
- Cloudflare Worker
- 其他能保管密钥的中间层
