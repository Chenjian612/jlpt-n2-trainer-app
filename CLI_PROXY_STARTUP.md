# Claude Code / Codex CLI 代理启动说明

这份文档只说明当前这台 macOS 机器上，如何让终端里的 `claude` 和 `codex` 通过代理正常工作。

## 结论先说

- `Codex CLI` 可以直接使用当前终端代理。
- `Claude Code` 不支持 SOCKS 代理，只支持 `HTTP_PROXY` / `HTTPS_PROXY`。
- 当前机器已经配置成两层代理：
  - `ssh -D 8888` 提供本地 SOCKS 代理
  - `privoxy` 把 `127.0.0.1:8888` 转成 `http://127.0.0.1:8118`

因此，新终端里的实际环境变量应当是：

```bash
ALL_PROXY=socks5h://127.0.0.1:8888
HTTP_PROXY=http://127.0.0.1:8118
HTTPS_PROXY=http://127.0.0.1:8118
```

## 每次开机后的启动顺序

### 1. 启动 SSH SOCKS 代理

如果你还没有启动本地 `8888` 代理，先执行：

```bash
ssh -D 8888 -C -N -f <your_ssh_target>
```

说明：

- `<your_ssh_target>` 需要替换成你自己的代理跳板机。
- 如果你沿用当前机器的配置，也可以直接使用 `~/.zshrc` 里已经写好的 `PROXY_SSH_TARGET`，后面直接执行 `proxy_start` 即可。

### 2. 打开 VS Code 终端并加载 shell 配置

```bash
source ~/.zshrc
```

### 3. 启动并检查本地 HTTP 代理桥

```bash
proxy_start
proxy_status
```

正常情况下，`proxy_status` 应该看到：

```text
socks proxy 127.0.0.1:8888 is listening
http proxy bridge 127.0.0.1:8118 is listening
```

### 4. 启动 CLI

Claude Code：

```bash
claude
```

Codex CLI：

```bash
codex
```

注意：

- 命令必须是全小写的 `claude` 和 `codex`。
- 不要写成 `Claude`。

## 最短可用流程

如果你只想记最少的命令，日常流程就是：

```bash
source ~/.zshrc
proxy_start
claude
```

如果 `8888` 的 SSH 隧道还没开，再先执行一遍：

```bash
ssh -D 8888 -C -N -f <your_ssh_target>
```

## 已配置的辅助命令

当前 `~/.zshrc` 里已经有这些命令：

```bash
proxy_start
proxy_status
proxy_on
proxy_off
proxy_http_bridge_start
proxy_test_jp
```

它们的用途分别是：

- `proxy_start`
  - 如果 `8888` 的 SOCKS 代理没起来，会尝试按 `PROXY_SSH_TARGET` 启动
  - 如果 `8118` 的 HTTP 代理桥没起来，会启动 `privoxy`
  - 最后自动导出终端所需的代理环境变量
- `proxy_status`
  - 检查环境变量、`8888` SOCKS 监听状态、`8118` HTTP 桥监听状态
- `proxy_on`
  - 只导出当前终端代理变量，不负责拉起后台服务
- `proxy_off`
  - 取消当前终端代理变量
- `proxy_http_bridge_start`
  - 单独启动本地 `privoxy` HTTP 代理桥
- `proxy_test_jp`
  - 测试终端是否能通过代理访问日本站点

## 验证命令

### 验证终端代理

```bash
proxy_status
proxy_test_jp
```

### 验证 Claude Code

```bash
claude -p "Reply with OK only"
```

正常应返回：

```text
OK
```

### 验证 Codex CLI

```bash
codex login status
codex exec --skip-git-repo-check --sandbox read-only "Reply with OK only"
```

## 相关本地配置文件

- 终端代理和辅助命令：`~/.zshrc`
- HTTP 代理桥配置：`~/.privoxy/config`
- Codex CLI 配置：`~/.codex/config.toml`

其中 `~/.codex/config.toml` 当前有：

```toml
[features]
apps = false
```

这表示禁用了 `codex_apps`，用于避免启动时出现 `MCP startup incomplete (failed: codex_apps)` 之类的连接器握手报错。

## 常见问题

### `claude` 启动后一直卡住

优先检查：

```bash
proxy_status
claude -p "Reply with OK only"
```

如果 `8118` 没起来，执行：

```bash
proxy_http_bridge_start
```

如果 `8888` 没起来，重新拉起 SSH SOCKS：

```bash
ssh -D 8888 -C -N -f <your_ssh_target>
```

### `codex` 能用，但启动时有黄字

当前配置已经把 `apps` 关闭。若你手动改回去了，可以再检查：

```bash
codex features list | rg '^apps\\s'
```

### 只网页能走代理，终端不走

这是两回事。macOS 图形界面的系统代理不等于终端代理。

终端必须显式加载：

```bash
source ~/.zshrc
proxy_start
```

## 一句话版

下次开机后，最稳妥的顺序是：

```bash
ssh -D 8888 -C -N -f <your_ssh_target>
source ~/.zshrc
proxy_start
claude
```
