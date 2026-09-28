# Android Debug A9C0 候选包构建与资源审计（2026-09-27）

本记录只对应 `master` / `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d` 加构建时未提交改动生成的 **A9C0 候选 APK**。原有工作区改动保留；未重置、提交、推送。此前 [3F4D 包](BUILD_VALIDATION-2026-09-26-final.md)与 6BE2 候选包是更早快照。APK 输出路径在后续重建时会被覆盖，辨认此包以本记录的 SHA-256 为准。

| 项目 | 结果 |
| --- | --- |
| 构建 | 仓库外 Android SDK、Gradle 8.13 和 JDK 17；`gradle.bat --no-daemon --console plain --project-cache-dir <临时目录> :app:assembleDebug`，退出码 **0**，`BUILD SUCCESSFUL in 19s`，34 个任务中 4 个执行、30 个复用缓存。 |
| APK | [app-debug.apk](app/build/outputs/apk/debug/app-debug.apk)，**60,424,595** 字节，写入时间 UTC `2026-09-26T18:14:02.8018236Z`。 |
| SHA-256 | `A9C018BE264F079D05CEA8E1C477A640399092BEE013D215D7D584A4FDD05419`。 |
| 资源一致性 | 按 `syncGameAssets` 白名单枚举源码 **530** 个、生成目录 **530** 个、APK `assets/` **530** 个；两次逐路径 SHA-256 比对均为缺失 0、额外 0、字节差异 0；审计命令退出码 **0**。 |
| 可见美术 | APK 中 `assets/art/vfx/units/` 有 **45** 张兵种特效 PNG，`assets/art/scene/town-*.png` 有 **10** 张（九时代图加日间底图），高清兵种立绘和本地 Three.js 运行文件均包含在逐字节比对中。 |
| 网络权限 | `aapt dump permissions` 退出码 **0**，只输出包名；APK 没有 `android.permission.INTERNET`。 |
| 设备 | `adb devices -l` 只列出 Android 15 / API 35 模拟器 `emulator-5554`，没有物理手机。模拟器验收与约 22.8 UI 帧/秒的性能限制见 [候选包离线记录](validation/emulator-android35-offline-final-a9c0-20260927/README.md)。 |

构建期间 Gradle 输出 SDK XML 版本与 Gradle 9 弃用功能提示，但成功产出 APK。`adb install -r` 返回 `Success`，随后 `am force-stop` / `am start`；未调用 `pm clear` 或卸载，旧 `rts_save` 仍以 `v=32` 读取。安装后 320 CSS px 的主城状态条实际显示“工人：”，说明 WebView 已加载新 UI 源码而非旧缓存。

审计取根目录 `index.html`、根目录 `*.js` / `*.css` 与 `assets/`、`image/`、`vendor/`、`renderer/`，排除 `210(unpacked_tmp).js`、`assets/art/source/**`、`assets/art/models/source/**`、`assets/art/preview.html` 与 `assets/art/README.md`；与 `android/app/build.gradle` 同步规则一致。每个路径均比较源码、`app/build/generated/game-assets` 和 APK ZIP 内 `assets/` 文件的 SHA-256；对 ZIP 中未标 UTF-8 的中文路径按 CP437 字节恢复 UTF-8 后比较。

物理 Android 手机尚无法提供；模拟器截图、触控注入和 JS 帧回调不能证明真机发热、GPU 帧率或稳定 30 FPS。运行资源若再改，应重建 APK 并重新记录哈希及设备结果。存档在 WebView `localStorage` 的 `rts_save`，换 APK 用 `install -r`；跨来源迁移前仍需在旧版导出原档。回退时先导出存档，再安装此前已核对哈希的包；不能以卸载当作安全回退。
