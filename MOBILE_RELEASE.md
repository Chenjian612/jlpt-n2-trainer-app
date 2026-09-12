# 移动端构建与验收

当前移动端阶段的目标是先生成可安装的 Android 预览包完成真机验收，再准备商店包。iOS 使用相同应用标识和生产配置，但签名与真机分发需要对应的 Apple 开发者凭据。

## 已完成的仓库配置

- 应用显示名：`JLPT N2 Trainer`
- iOS Bundle ID：`com.chenjian612.jlptn2trainer`
- Android Application ID：`com.chenjian612.jlptn2trainer`
- `preview`：内部测试；Android 明确生成可直接安装的 APK
- `production`：商店构建；构建号由 EAS 自动递增
- 音频只用于播放；iOS 和 Android 均不声明麦克风录音权限

配置来源：[Expo EAS 构建档案](https://docs.expo.dev/build/eas-json/)、[Android APK 构建](https://docs.expo.dev/build-reference/apk/)、[Expo Audio 配置](https://docs.expo.dev/versions/v54.0.0/sdk/audio/)。

## 首次 Android 真机包

首次执行前需要登录 Expo 账号。仓库配置与本地验证完成后，再运行：

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

如果这是仓库首次使用 EAS，CLI 会要求关联或创建 Expo 项目，并把项目 ID 写入应用配置。完成关联后应先提交该项目 ID，再保留云端构建链接供后续验收追踪。

构建完成后安装生成的 APK，按下面顺序验收：

1. 冷启动和返回前台正常，首页没有白屏或布局溢出。
2. 完成一轮文法、词汇、读解和听力训练，关闭应用后重新打开，进度仍存在。
3. 播放 5 个已配官方音频的听力案例，检查外放、耳机、暂停和重复播放。
4. 制造一条错题和一个学习项“不稳”，确认首页推荐和到期回收路径可进入。
5. 检查系统应用权限，确认没有请求麦克风。
6. 在弱网或断网下完成本地训练；AI 不可用时仍能显示本地结构化讲解。

## 商店构建前仍需准备

- Android：Google Play 开发者账号、商店文案、截图、隐私政策 URL 和内容分级。
- iOS：Apple Developer 账号、签名凭据、App Store Connect 条目、截图和隐私信息。
- 两端：完成上面的真机清单，确认正式 AI 代理可用且客户端包内没有模型密钥。

生产包命令：

```bash
npx eas-cli build --platform all --profile production
```

生成生产包不等于自动上架；提交商店应在真机验收和商店资料齐全后单独执行。
