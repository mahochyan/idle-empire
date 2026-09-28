# Android Debug 包 850C 修改前基线审计（2026-09-27）

本记录对应基础提交 `master` / `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d` 加**构建时**本地未提交 HD-2D 视觉改动。构建没有重置、清理、提交或推送用户工作区。包内游戏逻辑继续使用 `S/B`、`battleEpoch` 与 `rts_save`，这次 Android 打包没有修改存档字段或游戏数值。随后开始了举剑血线头部锚点的 `hd2d.js` 改动，故 850C 是修改前基线；当前源码再次执行 parity 会报告源码与旧 APK 不一致，不能把此包称为新改动的验收。

| 项目 | 实测 |
| --- | --- |
| 构建 | 仓库外 Android SDK 35、Gradle 8.13、JDK 17；在 `android/` 执行 `gradle.bat --no-daemon --console plain --project-cache-dir <临时目录> :app:assembleDebug`，退出码 **0**，`BUILD SUCCESSFUL in 17s`，34 项中 4 执行、30 项 up-to-date。SDK XML 与 Gradle 9 弃用提示没有阻止构建。 |
| APK | [app-debug.apk](app/build/outputs/apk/debug/app-debug.apk)，**65,375,011 字节**，SHA-256 `850C498AD43B91C8598216F024C1A2515770143ACADFF630A8AF86B5537A1D4E`。后续构建会覆盖该路径，必须用哈希识别。 |
| 资源 | [逐文件审计](validation/emulator-android35-action-final-20260927/apk-parity.json)退出码 **0**：源码白名单 537、Gradle 同步目录 537、APK `assets/` 537，缺失、额外及内容哈希差异均为 0。包含步兵和星际兵六张四帧动作 PNG、对应 manifest、六张新的人类兵种特效 PNG、`hd2d.js` 与 `visual.css`。未接入的 `assets/art/models/candidates/` 已在 `app/build.gradle` 中排除。 |
| 网络权限 | `aapt dump permissions` 退出码 **0**，只输出包名；无 `INTERNET` 权限。离线页面经 `WebViewAssetLoader` 加载。 |
| 安装 | Android 15 模拟器 `adb install -r` 返回 `Success`；未清数据，旧 `rts_save.v=32` 继续读取，暗色手动选择仍在。 |
| 设备 | 仅 `emulator-5554`，Android 15 / API 35、WebView 124.0.6367.219。详见[独立模拟器记录](validation/emulator-android35-action-final-20260927/README.md)。**没有物理 Android 手机**，不能把模拟器帧率与触控当成真机验收。 |
| 混合满编离线 | 含步兵、星际兵的 12v12 视觉样板连续运行 600.036 秒，两兵种动作图集在贴图缓存中解码就绪；`gfxinfo` 600.299 秒 / 18,030 Android UI 帧，约 30.035 帧/秒，同 PID，前后 WebGL 上下文未丢失。此状态不证明六张图集均已上传 GPU，详见[十分钟证据](validation/emulator-android35-action-final-20260927/README.md)。 |

本次只收窄 Android 打包白名单，排除未审定的候选模型；WebView 资源加载路径没有改变。旧版 `file://` 或其他来源的 localStorage 与当前 HTTPS asset origin 不自动合并。要退回旧视觉包，先从游戏内导出并独立保存完整存档，再安装已核对哈希的旧 APK；不可用卸载清数据或回退整个脏工作区代替保存备份。
