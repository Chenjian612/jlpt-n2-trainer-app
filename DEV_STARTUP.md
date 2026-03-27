# 开发环境启动说明

这份文档只写日常开发真正需要的启动步骤。

## 一条原则

日常开发默认使用：

```bash
npm run dev
```

不要用 `npm run start` 代替它。`npm run start` 只启动 Expo，不会启动 Claude 代理，AI 解释功能会失败。

> **当前 AI 提供商：DeepSeek**（支持浏览器直接调用，本地开发无需代理也能用 AI 功能）

---

## 启动前准备

### 1. 进入项目根目录

```bash
cd C:\chenjian\workspace\code\jlpt-n2-trainer-app
```

### 2. 首次启动或依赖变更后先装依赖

```bash
npm install
```

### 3. 确认 `.env.local`

项目根目录需要有 `.env.local`，内容如下：

```env
EXPO_PUBLIC_AI_API_KEY=<你的 DeepSeek API Key>
EXPO_PUBLIC_AI_PROVIDER=deepseek
EXPO_PUBLIC_DEEPSEEK_PROXY_URL=http://localhost:9876
```

- `.env.local` 不提交 git，每台机器单独配置。
- 使用 DeepSeek 时，`EXPO_PUBLIC_DEEPSEEK_PROXY_URL` 本地开发无需设置，仅 Claude 模式下需要。

---

## 场景一：本地开发

```bash
npm run dev
```

同时启动 AI 代理（port 9876）和 Expo（port 8081）。

浏览器访问 `http://localhost:8081`。

停止：`Ctrl+C`

> 使用 DeepSeek 时代理不会被调用（DeepSeek 支持浏览器直连），但启动 `npm run dev` 仍是推荐方式，切换 AI 提供商时无需改启动命令。

---

## 场景二：分享给别人用（本地开着电脑 + 隧道）

**前提：你的电脑必须一直开着。** 别人通过隧道地址访问你本地跑的服务。

### 第一步：启动 app

```bash
npm run dev
```

等出现 `Waiting on http://localhost:8081` 说明启动好了。

### 第二步：打开隧道

新开一个终端，运行：

```bash
npx cloudflared tunnel --url http://localhost:8081
```

等几秒，会出现一个 `https://xxxx.trycloudflare.com` 的地址，把这个地址发给别人就能访问了。

> 每次重启隧道地址会变，这是正常的。

### AI 功能说明

当前使用 DeepSeek，浏览器可以直接调用 DeepSeek API，**不需要额外配置**，AI 功能对本地和外网用户都正常。

---

## 场景三：永久部署（Cloudflare Pages，关电脑也能访问）

这个方案是把 app 的文件上传到 Cloudflare 的服务器上，你关电脑后别人依然可以访问。

### 先理解一个问题：AI Key 在哪？

app 里的代码在构建（build）时会被打包成一堆 JS 文件，你的 DeepSeek Key 也会被打进去。任何人打开浏览器的开发者工具都能看到这个 Key，然后用你的 Key 调用 DeepSeek，产生费用。

**解决办法：用 Cloudflare Workers 来保管 Key。**

### 什么是 Cloudflare Workers？

Workers 是 Cloudflare 提供的一种"小型服务器函数"，免费可用。你把 Key 存在 Workers 里（不在 app 代码里），app 调用 AI 时先请求 Workers，Workers 再带着 Key 去请求 DeepSeek，这样 Key 就不会暴露给用户了。

```
用户浏览器 → Cloudflare Workers（Key 在这里，用户看不到）→ DeepSeek API
```

### 部署步骤

> 以下步骤在你决定切换到场景三时执行，目前不需要操作。

**第一步：在 Cloudflare 创建一个 Worker**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左侧菜单点 **Workers & Pages** → **Create** → **Create Worker**
3. 给 Worker 随便起个名字（如 `jlpt-ai-proxy`），点部署
4. 点 **Edit Code**，把代码全部替换为：

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
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body,
    });
    const result = await resp.text();
    return new Response(result, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
```

5. 点右上角 **Deploy** 部署
6. 记下 Worker 的地址，格式类似：`https://jlpt-ai-proxy.你的账号.workers.dev`

**第二步：把 DeepSeek Key 存进 Worker**

1. 进入刚创建的 Worker → **Settings** → **Variables and Secrets**
2. 点 **Add** → 类型选 **Secret**，名称填 `DEEPSEEK_API_KEY`，值填你的 DeepSeek Key
3. 点 **Deploy** 保存

**第三步：更新代码，让 app 通过 Worker 调用 AI**

告诉我你要开始部署了，我来修改 `aiCoachClient.ts`，把 DeepSeek 的请求地址改为 Worker 地址，并去掉前端的 Key。

**第四步：部署 app 到 Cloudflare Pages**

1. 先在本地运行构建（命令待定，届时告知）
2. 把构建产物上传到 Cloudflare Pages，或连接 GitHub 仓库自动构建
3. 在 Cloudflare Pages 的环境变量里填：
   ```
   EXPO_PUBLIC_AI_PROVIDER=deepseek
   EXPO_PUBLIC_AI_API_KEY=not-used
   EXPO_PUBLIC_DEEPSEEK_PROXY_URL=https://jlpt-ai-proxy.你的账号.workers.dev
   ```

---

## 常见问题

### AI 解释报"获取解释失败"

- 代理没启动：本地用 `npm run dev`
- `.env.local` 改完但 Expo 没重启：重启 Expo 加 `--clear`

### 页面白屏

- 等 Metro 编译完（首次 `--clear` 约 1 分钟）
- 按 F12 看 Console 报错

### 端口被占用（EADDRINUSE）

```bash
netstat -ano | findstr :8081   # 找 Expo 进程
netstat -ano | findstr :9876   # 找代理进程
```

找到 PID 后在任务管理器里结束，再重启。
