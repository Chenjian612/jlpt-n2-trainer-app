# 移动端构建与验收

当前移动端阶段的目标是先生成可安装的 Android 预览包完成真机验收，再准备商店包。iOS 使用相同应用标识和生产配置，但签名与真机分发需要对应的 Apple 开发者凭据。

跨阶段的整体优先级、14 天实测、真实 AI、数据备份与商店准备见 [下一阶段完善清单](./NEXT-STEPS.md)。

## 已完成的仓库配置

- 应用显示名：`JLPT N2 Trainer`
- iOS Bundle ID：`com.chenjian612.jlptn2trainer`
- Android Application ID：`com.chenjian612.jlptn2trainer`
- `preview`：内部测试；Android 明确生成可直接安装的 APK
- `production`：商店构建；构建号由 EAS 自动递增
- 音频只用于播放；iOS 和 Android 均不声明麦克风录音权限

配置来源：[Expo EAS 构建档案](https://docs.expo.dev/build/eas-json/)、[Android APK 构建](https://docs.expo.dev/build-reference/apk/)、[Expo Audio 配置](https://docs.expo.dev/versions/v54.0.0/sdk/audio/)。

## 首次 Android 真机包

构建前先运行仓库内的移动配置验收，确认应用标识、版本、权限、图标资源和 EAS 档案没有发生回归：

```bash
npm run test:mobile-config
```

这个检查已接入 GitHub Actions。首次完成 EAS 项目关联前，它会提示 `PENDING EAS project link`；关联后则会同时校验并显示 `projectId`。

首次执行前需要登录 Expo 账号。仓库配置与本地验证完成后，再运行：

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

如果这是仓库首次使用 EAS，CLI 会要求关联或创建 Expo 项目，并把项目 ID 写入应用配置。完成关联后应先提交该项目 ID，再保留云端构建链接供后续验收追踪。

### EAS 不可用时的 GitHub Actions 备用构建

如果本机无法稳定下载 EAS CLI，仓库提供 `Android Preview APK` 工作流。它使用 GitHub 托管环境中的 Java 17 和 Android SDK，执行 Expo Prebuild 与 Gradle `assembleRelease`，不需要 Expo 登录或 EAS Token。

- 修改并推送 `.github/workflows/android-preview.yml` 时会触发一次构建。
- 后续可在 GitHub Actions 页面手动运行 `Android Preview APK`。
- 成功后从该次运行的 Artifacts 下载 `jlpt-n2-trainer-android-preview-<commit>`。
- 产物使用自动生成的内部测试签名，只用于真机预览，不作为 Google Play 正式签名包。
- Artifact 保留 14 天；应同时记录构建链接和 Git 提交。

这个备用方案只替代“生成内部测试 APK”，不会完成 EAS 项目关联，也不能代替未来的正式商店签名流程。

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
