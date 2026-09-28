# Android Debug 包最终构建快照（2026-09-26）

本记录对应当前工作树的运行资源快照；基线为 `master` 的 `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d` 加未提交改动。此后若修改任何运行资源，必须重新构建和验包。旧 [构建验证记录](BUILD_VALIDATION-2026-09-26.md) 中的 APK 属于历史快照。此前的 `0FF0AB8EE276CD0517B758A2E4CEF0026FEFF97AB5173ECCCC6059FC18F19EA5` 和 `4055A8D4B0BDF98E5D754E3874F2624E1251728D68663AC93221690C5D89633B` 均为候选包；后者在 Android 15 夜间模式下状态栏出现白底白字。本包将系统栏背后的原生根容器同步涂成夜间色，并按立绘不透明轮廓把深红血线贴近头顶。

## 本次结果

| 项目 | 实测结果 |
| --- | --- |
| 构建命令 | `gradle.bat --no-daemon --console plain --project-cache-dir <临时目录> :app:assembleDebug`，退出码 **0**；34 个任务中 7 个执行、27 个复用缓存，约 24 秒。 |
| APK | [app-debug.apk](app/build/outputs/apk/debug/app-debug.apk)，**60,391,271 字节**；写入时间 UTC `2026-09-26T14:49:51.8642042Z`。 |
| SHA-256 | `3F4D0A31CF1BA7DC574D73BCA0AAF7AD7569CF7D46605E5C54AC0D48AEC2DDE4`。 |
| 运行资源 | 按 `android/app/build.gradle` 的同步白名单枚举，当前工作树 **530** 个文件；构建前后文件清单及 SHA-256 无变化。生成目录 **530** 个，APK `assets/` **530** 个；路径缺失、额外文件和逐文件字节差异均为 **0**。 |
| 攻击特效 | APK 内 `assets/art/vfx/units/` 有 **45** 张 PNG、`assets/art/vfx/hires/` 有 **9** 张 PNG，且包含 `unit-vfx-profiles.js` 与 `unit-vfx-profiles.json`。JSON 与 JS 各定义 45 个兵种配置，键和值一致；45 个 PNG 名与配置键一一对应。上述文件逐个纳入全资源 SHA-256 对比。 |
| 权限 | `aapt dump permissions` 退出码 **0**，仅输出 `package: com.mahochyan.idleempire`；APK 没有 `android.permission.INTERNET`。 |
| 设备 | 本次 `adb devices -l` 只列出 `emulator-5554`；未接入物理 Android 手机。[最终模拟器离线复验](validation/emulator-android35-offline-final-3f4d-20260926/README.md)记录同一 APK 连续前台运行 10 分 23.603 秒、日夜原生系统栏、战斗画面及重启存档；不能代替真机触控、发热和帧率验收。 |

构建使用仓库外 `C:\Users\lapyin\AppData\Local\Temp\codex-idle-android-20260926` 下的 Android SDK、JDK 17 和 Gradle 8.13。Gradle 输出 SDK XML 版本及弃用功能提示，但 `BUILD SUCCESSFUL`。本次编译了 `MainActivity` 中仅改变系统栏及其背景颜色的本地 WebView 主题桥接；APK 没有网络权限。

## 复核要点

```powershell
$toolRoot = 'C:\Users\lapyin\AppData\Local\Temp\codex-idle-android-20260926'
$env:ANDROID_HOME = "$toolRoot\sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = "$toolRoot\gradle-home"
Set-Location 'E:\AIprogram\idlgame\android'
& "$toolRoot\gradle-8.13\bin\gradle.bat" --no-daemon --console plain --project-cache-dir "$toolRoot\project-cache" :app:assembleDebug
Get-FileHash -Algorithm SHA256 'app\build\outputs\apk\debug\app-debug.apk'
& "$toolRoot\sdk\build-tools\35.0.0\aapt.exe" dump permissions 'app\build\outputs\apk\debug\app-debug.apk'
```

逐文件审计以 `syncGameAssets` 的输入范围为准：根目录 `index.html`、根目录 `*.js` / `*.css`、`assets/`、`image/`、`vendor/`、`renderer/`；排除可编辑美术源文件、`assets/art/preview.html`、`assets/art/README.md` 和旧反编译脚本。对工作树、`app/build/generated/game-assets` 与 APK ZIP `assets/` 下每个相对路径计算 SHA-256，并比较路径集合；ZIP 中未标 UTF-8 的中文文件名先按 CP437 字节解回 UTF-8。APK 中不存在运行资源以外的 `assets/` 文件。本次 530 个文件路径与内容均一致，不能仅凭文件时间或同名判断一致。
