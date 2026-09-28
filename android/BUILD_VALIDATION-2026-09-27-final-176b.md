# Android Debug 包最终构建审计（2026-09-27）

本记录只对应基线 `master` / `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d` 加构建时未提交视觉改动生成的 **176B APK**。未重置、提交或推送；原脏工作区保留。先前 [A9C0 候选包](BUILD_VALIDATION-2026-09-27-final.md) 的独立模拟器合成帧数约 22.8fps，因此在 `hd2d.js` 的 30fps 帧限比较中增加 1ms 容差后重建本包。

| 项目 | 实测结果 |
| --- | --- |
| 构建命令 | 仓库外 SDK、Gradle 8.13 和 JDK 17；`gradle.bat --no-daemon --console plain --project-cache-dir <临时目录> :app:assembleDebug`，退出码 **0**，`BUILD SUCCESSFUL in 18s`，34 项中 4 执行、30 复用缓存。 |
| APK | [app-debug.apk](app/build/outputs/apk/debug/app-debug.apk)，**60,457,319** 字节，写入时间 UTC `2026-09-26T18:46:53.0855480Z`。 |
| SHA-256 | `176B34893EF19DFB77686F0941443529D7F22A012CC4E2CB8A22841C56406EFC`。之后如果继续重建，输出路径会被覆盖，须以哈希辨认此包。 |
| 运行资源 | 按 `syncGameAssets` 同步白名单枚举：源码 530、生成目录 530、APK `assets/` 530。源码→生成目录、生成目录→APK 的逐路径 SHA-256 比对均为缺失 0、额外 0、内容差异 0；审计命令退出码 **0**。 |
| 网络权限 | `aapt dump permissions` 退出码 **0**，只输出 `package: com.mahochyan.idleempire`；没有 `android.permission.INTERNET`。 |
| 安装 | `adb install -r` 返回 `Success`，再强停启动以排除 WebView 旧脚本；未执行 `pm clear` 或卸载，`rts_save.v=32` 继续读取。 |
| 设备 | 只有 Android 15 / API 35 模拟器 `emulator-5554`；物理手机未提供。[同包离线与触控记录](validation/emulator-android35-offline-final-176b-20260927/README.md)单独列出模拟器证据和边界。 |

Gradle 输出 SDK XML 与 Gradle 9 弃用提示，但成功编译。运行文件白名单取根目录 `index.html`、根目录 `*.js` / `*.css`、`assets/`、`image/`、`vendor/`、`renderer/`；排除 `210(unpacked_tmp).js`、`assets/art/source/**`、`assets/art/models/source/**`、`assets/art/preview.html` 和 `assets/art/README.md`。APK ZIP 中未标 UTF-8 的中文路径先按 CP437 字节解回 UTF-8，再逐文件对比 SHA-256。45 张兵种特效 PNG 与九时代主城图均包含在这 530 个文件内。

当前包的游戏运行仍完全离线。WebView HTTPS asset origin 与旧 `file://` 存档 origin 不同；跨来源迁移先从旧版导出原档。本包不改 `rts_save` 结构。若需退回 A9C0 或更旧视觉包，先在游戏内导出主档、保存独立备份，再安装已核对哈希的 APK；不要卸载清数据或重置整个脏工作区。
