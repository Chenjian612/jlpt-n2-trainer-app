# 开发环境启动说明

这份文档只写日常开发真正需要的启动步骤。

## 一条原则

日常开发默认使用：

```bash
npm run dev
```

不要用 `npm run start` 代替它。`npm run start` 只启动 Expo，不会启动 Claude 代理，AI 解释功能会失败。

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
EXPO_PUBLIC_AI_API_KEY=<你的 Claude API Key>
EXPO_PUBLIC_AI_PROVIDER=claude
EXPO_PUBLIC_CLAUDE_PROXY_URL=http://localhost:9876
```

- `.env.local` 不提交 git，每台机器单独配置。
- 本地开发时，`EXPO_PUBLIC_CLAUDE_PROXY_URL` 必须是 `http://localhost:9876`。

---

## 场景一：本地开发

```bash
npm run dev
```

同时启动 Claude 代理（port 9876）和 Expo（port 8081）。

浏览器访问 `http://localhost:8081`。

停止：`Ctrl+C`

---

## 场景二：外网访问（手机或其他设备）

**使用合并服务器**，app 和代理同一个端口同一个域名，彻底避免 CORS 问题。只需开两个终端。

### 终端 1：启动 Expo

```bash
npx expo start
```

等待出现：

```
Waiting on http://localhost:8081
```

### 终端 2：启动合并服务器

```bash
npm run combined
```

等待出现：

```
[combined-server] listening on http://localhost:8082
```

合并服务器会把 `/v1/messages` 转发给 Claude API，其他请求转发给 Expo。

### 更新 `.env.local`

把代理地址改为合并服务器：

```env
EXPO_PUBLIC_CLAUDE_PROXY_URL=http://localhost:8082
```

### 重启 Expo（让新地址生效）

停掉终端 1 的 Expo，重新运行：

```bash
npx expo start --clear
```

`--clear` 只需这一次，之后恢复 `npx expo start`。

### 终端 3：开隧道

```bash
ssh -o StrictHostKeyChecking=no -R 80:localhost:8082 serveo.net
```

记下输出的地址，发给手机打开即可。第一次访问有 serveo 提示页，点 "Click to Continue" 跳过。

---

## 结束外网访问后恢复本地

把 `.env.local` 改回：

```env
EXPO_PUBLIC_CLAUDE_PROXY_URL=http://localhost:9876
```

然后：

```bash
npm run dev
```

---

## 常见问题

### AI 解释报"获取解释失败"

- 代理没启动：本地用 `npm run dev`，外网用 `npm run combined`
- `.env.local` 改完但 Expo 没重启：重启 Expo 加 `--clear`

### 页面 502

- Expo 还没启动完，等待 `Waiting on http://localhost:8081` 出现后再访问
- 合并服务器没启动：运行 `npm run combined`

### 页面白屏

- 等 Metro 编译完（首次 `--clear` 约 1 分钟）
- 按 F12 看 Console 报错

### 端口被占用（EADDRINUSE）

```bash
netstat -ano | findstr :8081   # 找 Expo 进程
netstat -ano | findstr :8082   # 找合并服务器进程
netstat -ano | findstr :9876   # 找代理进程
```

找到 PID 后在任务管理器里结束，再重启。

### serveo 地址每次都变

serveo 免费版每次重启地址都变，但合并服务器方案不需要更新 `.env.local`（代理地址始终是 `http://localhost:8082`），只需重开隧道即可。
