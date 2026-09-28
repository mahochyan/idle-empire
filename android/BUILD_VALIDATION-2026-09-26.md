# Android Debug 包构建验证（2026-09-26）

> **历史快照**：本报告的 APK SHA-256 `4C05545580E717B1D4060329053515175C25714BC42C8C0AC62844F2DFCA0431` 已由 [最终构建快照](BUILD_VALIDATION-2026-09-26-final.md) 取代；下方数据只描述当时的包，不代表当前工作树。

## 范围与结果

工作树基线：`master`，`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，含未提交的视觉重构。工具链安装在 `C:\Users\lapyin\AppData\Local\Temp\codex-idle-android-20260926`，没有修改系统 PATH。APK 是构建时工作树的快照；后续资源改动需要重新构建。

| 项目 | 实测结果 |
| --- | --- |
| JDK | Microsoft OpenJDK 17.0.11 |
| Gradle | 8.13，官方 binary ZIP；SHA-256 与官方校验文件一致 |
| Android 命令行工具 | Windows `15859902`，`sdkmanager` 22.0；SHA-256 与 Android 官网一致 |
| SDK 包 | `platforms;android-36`、`build-tools;35.0.0`、`platform-tools`，共约 427.7 MiB |
| `:app:assembleDebug` | **通过**，退出码 0；最终视觉修改后重建约 16 秒，34 个任务中 4 个执行、30 个复用缓存。首次构建约 51 秒。 |
| 当时的 Debug APK | `app/build/outputs/apk/debug/app-debug.apk`，53,289,977 字节（50.82 MiB），SHA-256 `4C05545580E717B1D4060329053515175C25714BC42C8C0AC62844F2DFCA0431` |
| 离线资源包审计 | 当时重建后 `syncGameAssets` 输出 463 文件；APK 内 `assets/` 下对应 463 文件，缺失 0、额外 0。使用 ZIP UTF-8 路径读取，包含中文文件名。核对了入口、Three.js、视觉 CSS 与新增兵种立绘。 |
| APK 权限 | `aapt dump permissions` 没有 `android.permission.INTERNET`；Debug Manifest 显示 `debuggable=true` 与硬件加速。 |
| 已连接设备 | `adb devices -l` 只显示表头，没有设备。 |
| 真机离线运行 / 十分钟帧率 | **未运行**：没有连接的 Android 手机。构建通过和资源包审计不能证明设备运行或 30 FPS。 |

构建期间出现 SDK XML 版本提示与 Java 废弃 API 提示，均没有阻止构建。根目录运行时 HTML、CSS、JavaScript 中没有外部 HTTP 资源请求；`hd2d.js` 的模型 `fetch` 由相对本地路径生成，并检查同源。该静态检查不等于真机网络关闭测试。

## 来源与复现命令

下载来源：[Android 命令行工具](https://developer.android.com/studio)、[Gradle 8.13 发行包](https://services.gradle.org/distributions/gradle-8.13-bin.zip)。ZIP 尺寸与校验值：

| ZIP | 字节 | SHA-256 |
| --- | ---: | --- |
| `commandlinetools-win-15859902_latest.zip` | 155,655,386 | `90AE805D20434428BFFCB699C290860F19BB5F66A67E6B330067E3DE801FB04A` |
| `gradle-8.13-bin.zip` | 136,983,045 | `20F1B1176237254A6FC204D8434196FA11A4CFB387567519C61556E8710AED78` |

在 PowerShell 中执行；下载 ZIP 后应先用 `Get-FileHash -Algorithm SHA256` 核对上表：

```powershell
$toolRoot = 'C:\Users\lapyin\AppData\Local\Temp\codex-idle-android-20260926'
New-Item -ItemType Directory -Path $toolRoot -Force | Out-Null
curl.exe -fL --retry 3 -o "$toolRoot\commandlinetools-win-15859902_latest.zip" 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip'
curl.exe -fL --retry 3 -o "$toolRoot\gradle-8.13-bin.zip" 'https://services.gradle.org/distributions/gradle-8.13-bin.zip'
Get-FileHash -Algorithm SHA256 "$toolRoot\commandlinetools-win-15859902_latest.zip"
Get-FileHash -Algorithm SHA256 "$toolRoot\gradle-8.13-bin.zip"
Expand-Archive -LiteralPath "$toolRoot\gradle-8.13-bin.zip" -DestinationPath $toolRoot
Expand-Archive -LiteralPath "$toolRoot\commandlinetools-win-15859902_latest.zip" -DestinationPath "$toolRoot\cmdline-extract"
New-Item -ItemType Directory -Path "$toolRoot\sdk\cmdline-tools" -Force | Out-Null
Move-Item -LiteralPath "$toolRoot\cmdline-extract\cmdline-tools" -Destination "$toolRoot\sdk\cmdline-tools\latest"
$env:ANDROID_HOME = "$toolRoot\sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
(@('y') * 60) | & "$toolRoot\sdk\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root=$env:ANDROID_HOME 'platforms;android-36' 'build-tools;35.0.0' 'platform-tools'
$env:GRADLE_USER_HOME = "$toolRoot\gradle-home"
Set-Location 'E:\AIprogram\idlgame\android'
& "$toolRoot\gradle-8.13\bin\gradle.bat" --no-daemon --console plain --project-cache-dir "$toolRoot\project-cache" :app:assembleDebug
& "$toolRoot\sdk\platform-tools\adb.exe" devices -l
```

资源包对比使用 .NET `System.IO.Compression.ZipFile` 读取 APK 条目，与 `app/build/generated/game-assets` 的相对路径逐一比较；`jar tf` 在当前 Windows 终端会把中文文件名解码为乱码，不能用于这个对比。复现离线包审计：

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$apk = 'E:\AIprogram\idlgame\android\app\build\outputs\apk\debug\app-debug.apk'
$generated = 'E:\AIprogram\idlgame\android\app\build\generated\game-assets'
$zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
try {
    $actual = @($zip.Entries | Where-Object { $_.FullName.StartsWith('assets/') -and -not $_.FullName.EndsWith('/') } | ForEach-Object { $_.FullName })
    $expected = @(Get-ChildItem -LiteralPath $generated -Recurse -File | ForEach-Object { 'assets/' + $_.FullName.Substring($generated.Length + 1).Replace('\', '/') })
    "Expected=$($expected.Count) InApk=$($actual.Count) Missing=$( @($expected | Where-Object { $_ -notin $actual }).Count ) Extra=$( @($actual | Where-Object { $_ -notin $expected }).Count )"
} finally { $zip.Dispose() }
& "$toolRoot\sdk\build-tools\35.0.0\aapt.exe" dump permissions $apk
```

设备可用后，按 [README 的设备验收步骤](README.md#设备验收)继续测试。
