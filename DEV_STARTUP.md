# 开发环境启动说明

这份文档只写日常开发真正需要的启动步骤。

## 一条原则

日常开发默认使用：

```bash
npm run dev
```

不要用 `npm run start` 代替它。`npm run start` 只启动 Expo，不会启动 AI 代理，AI 解释功能会失败。

---

## 启动前准备

### 1. 进入项目根目录

```bash
cd /Users/chenjian/jlpt-n2-trainer-app
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
EXPO_PUBLIC_CLAUDE_PROXY_URL=http://localhost:9876
```

- `.env.local` 不提交 git，每台机器单独配置。

---

## 场景一：本地开发

开一个终端：

```bash
npm run dev
```

同时启动 AI 代理（port 9876）和 Expo（port 8081）。

浏览器访问 `http://localhost:8081`。

停止：`Ctrl+C`

---

## 场景二：外网访问（手机或其他设备）

开两个终端。

### 终端 1：启动本地服务

```bash
npm run dev
```

等待出现：

```
› Web is waiting on http://localhost:8081
```

### 终端 2：开 cloudflared 隧道

```bash
npx cloudflared tunnel --url http://localhost:8081
```

等待输出类似：

```
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://xxxxxx.trycloudflare.com
```

把这个 `https://` 地址发给手机或其他设备直接打开即可。

> **注意**：
> - 隧道地址每次重启都会变，重新发给别人即可。
> - AI 代理运行在本机 9876 端口，外网访问时 AI 解释功能正常（代理走本机，不走隧道）。
> - 停止时两个终端都 `Ctrl+C`。

---

## 常见问题

### AI 解释报"获取解释失败"

- 代理没启动：确认用的是 `npm run dev` 而不是 `npm run start`
- `.env.local` 改完但 Expo 没重启：重启并加 `--clear`

```bash
npm run dev -- --clear
```

### 页面白屏

- 等 Metro 编译完（首次约 1 分钟）
- 按 F12 看 Console 报错

### 端口被占用（EADDRINUSE）

```bash
lsof -i :8081   # 找 Expo 进程
lsof -i :9876   # 找 AI 代理进程
```

找到 PID 后：

```bash
kill -9 <PID>
```

### cloudflared 未安装

```bash
npm install -g cloudflared
```

或直接用 `npx cloudflared`（无需全局安装）。
