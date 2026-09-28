# 放置帝国 Android 离线容器

这是一个独立的原生 Android WebView 壳。它不改动游戏逻辑：页面和贴图从 APK 内的 `assets/` 加载，`rts_save` 仍由游戏写入 WebView `localStorage`。

## 构建

安装 Android Studio、Android SDK 36、JDK 17 和 Gradle 8.13，在 Android Studio 中打开此 `android/` 目录，或在该目录运行：

```text
gradle :app:assembleDebug
```

首次构建需要下载 Android Gradle Plugin 8.13.2 和 AndroidX WebKit 1.17.1；完成依赖缓存后，APK 内的游戏运行无需网络。输出位于 `app/build/outputs/apk/debug/`。本仓库当前未附 Gradle Wrapper，因此命令要求本机安装对应版本的 Gradle。

`syncGameAssets` 会在 `mergeDebugAssets`、`mergeReleaseAssets` 前自动运行，将仓库根目录的 `index.html`、根目录 `*.js` / `*.css`、`assets/`、`image/`、`vendor/` 和 `renderer/` 同步至生成的 APK 资源目录。它不复制测试、报告、文档、美术可编辑源文件和旧反编译脚本 `210(unpacked_tmp).js`。新增运行时资源若放在其他目录，先将该目录加入 `app/build.gradle` 的同步白名单。

## 运行与存档

入口为 `https://appassets.androidplatform.net/assets/index.html`，由 `WebViewAssetLoader` 映射到 APK 资源，不请求外网。应用没有 `INTERNET` 权限；外部 URL 与非 `/assets/` 请求被拦截。启用 JavaScript、DOM Storage 与硬件加速，以运行现有游戏和 WebGL。禁用 `file://` 与跨源文件读取。

新容器的 HTTPS origin 与旧版 `file://` 或其他域名不同；两者的 `localStorage` **不会自动合并**。若已有旧版存档，先用旧版游戏的导出功能保存完整存档文本，再在新容器的设置页导入，并确认进度无误。不要卸载旧版后才尝试导出。

## 设备验收

在 320、360、390、430 CSS px 的 Android 设备或模拟器上打开主页、建筑、科技和战斗；验证 WebGL 场景、关闭网络后的资源加载、重启后 `rts_save` 仍在、确认弹窗可用，以及无 WebGL 时游戏回退。浏览器和模拟器结果应单独记录，不能代替真机验收。

连接开启 USB 调试的 Android 手机后，在仓库的 `android/` 目录执行以下命令。首次构建需联网获取构建依赖；安装完成后再关闭手机网络，连续使用至少十分钟。每次测试记录机型、Android/WebView 版本、实际 CSS 视口宽度、战斗编队规模、是否出现丢帧或上下文丢失，并留存日志。不同 CSS 宽度需要分别验收；桌面浏览器调整窗口大小不算真机宽度验收。

```powershell
adb devices -l
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
gradle :app:assembleDebug
adb install -r .\app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.mahochyan.idleempire/.MainActivity
adb shell dumpsys gfxinfo com.mahochyan.idleempire reset
# 在手机上关闭 Wi-Fi/移动网络，打开主页、科技、建筑及满编战斗，持续操作十分钟。
adb shell dumpsys gfxinfo com.mahochyan.idleempire framestats > device-framestats.txt
adb logcat -d -s AndroidRuntime:E chromium:E > device-errors.txt
```

Debug APK 会启用 WebView 远程调试，连接设备后可从桌面 Chrome 的 `chrome://inspect` 查看页面、控制台、CSS 视口宽度与帧时间。Release APK 不启用此入口。`gfxinfo` 和调试器的帧时间只是性能证据的一部分，还需结合手机上实际画面检查；应记录十分钟内各场景的帧率，并核查中端机能否稳定达到 30 FPS。

2026-09-27 已使用仓库外的临时 Android SDK 与 Gradle 8.13 构建 850C Debug 基线包（65,375,011 字节；SHA-256 `850C498AD43B91C8598216F024C1A2515770143ACADFF630A8AF86B5537A1D4E`）。**构建时**源码、生成目录与 APK 的全部 537 个运行资源逐文件 SHA-256 一致，包含两兵种六张高清动作图集和六张新增专属攻击特效；APK 没有 `INTERNET` 权限。构建审计见 [850C 构建记录](BUILD_VALIDATION-2026-09-27-action-850c.md)。同包 [Android 35 模拟器复验](validation/emulator-android35-action-final-20260927/README.md)覆盖 320/360 CSS px 站位、攻击动作和包含两套动作图集的离线混合满编 600.036 秒；Android UI 帧统计约 30.035 帧/秒，WebGL 上下文与进程保持。此后已开始血线头部锚点代码改动，850C 结果仅作修改前基线，不能代替新包验收。此前 [176B 包](BUILD_VALIDATION-2026-09-27-final-176b.md)属于历史快照。尚无物理手机，真机离线十分钟、触控、发热与帧率验收未执行。

同日的[深红贴头血线包](validation/bloodline-deep-close-20260927/README.md)是当前视觉修正的离线模拟器验收结果：APK SHA-256 `9CCBD100CB409323BBCE452C63CE0A7558C1C82D31AC99B84DE5D77CDC87F04A`，603/603 运行资源一致，320/390 CSS px 各 34/34 检查通过，视觉夹具前后原始存档 SHA 一致。它仍缺物理手机的十分钟性能与触控验收。

同包另做了[离线满编 600 秒持续攻击长测](validation/bloodline-deep-longrun-20260927/README.md)：12 对 12 立绘持续可见，场景累计 17,985 帧、平均 29.88 fps，709 次视觉攻击均接受并显示，进程与 WebGL 上下文未中断。第十分钟 Android 窗口提交下降到 38.25 fps，末尾约四秒实测为 30 Hz；原因未定位，不能称窗口帧率全程稳定。此 APK 之后的工作区 UI 调整不在这个冻结包中，后续包需重新核对资源和窄屏布局。用户暂时无法提供实体手机，因此实机离线十分钟、触控与发热仍未验收。

此前的[科研卡片与深红血线包](validation/tech-science-ui-20260927/README.md) SHA-256 为 `B410E5B11A3F5D3B7B44162F89E627FA3C1156A13927EE7E4CA6F1994FFB7252`。构建时的 603 个运行资源从源码到 APK 逐项一致，未打包三维/清图候选；Android 15 离线模拟器 320px 检查 26/26、390px 检查 24/24，真实战斗中 WebGL 丢失后二维单位卡仍可见（12/12）。构建后并行玩法工作更新了 `config.js`、`garrison.js`、`math.js`，此冻结包未包含后续改动，见[源码漂移复查](validation/tech-science-ui-20260927/source-drift-after-build.json)。该旧 APK 没有单独执行 600 秒性能长测，也没有物理手机验收；旧包性能数值不可直接套用。

后续的[贴头血线与科技分层最终模拟器包](validation/bloodline-head-tech-final-20260927/README.md) SHA-256 为 `B24FA45041A04CE7BF6AFD4D0FC5DC99A98F1DCCD5680512E4C3212FA8C7542F`，603 个冻结运行资源与 APK 一致。Android 15 离线模拟器通过 320px 44/44、390px 42/42 WebView 检查，各宽度触摸事件检查 18/18、真实战斗 WebGL→2D 回退 12/12。同包满编 600.261 秒长测中，Three 场景平均 29.927 FPS、708/708 视觉攻击可见、无上下文丢失；Android 窗口从第 4 分钟转为约 30Hz 提交，原因未定。构建后并行玩法更新使当前 `config.js`、`math.js`、`ui.js` 与冻结包有差异，见报告；实体手机触控、发热和中端设备稳定 30 FPS 仍未验收。

四兵种样板的历史 Debug 包为 69,813,872 字节，SHA-256 `15DA2AF33C8FDB56FFDA60A0F78DA27386B87AC80C0AC92D65F1616D0B68E8B3`；其 543 个运行文件哈希及 Android 15 模拟器离线 600 秒结果见[历史验收记录](BUILD_VALIDATION-2026-09-27-four-atlas-15da.md)。

当前视觉候选 Debug 包为 83,772,033 字节，SHA-256 `ED60E5B9C59201DAE1DDFF97F508D31383152339E09D14653802F530F7650B07`；**构建时** 568 个运行文件从源码到生成目录和 APK 的哈希一致，包含昼夜战场、六兵种完整及紧凑动作图集、45 个独立兵种特效。构建后工作区的 `config.js` 与 `math.js` 有并行玩法改动；它们与冻结 APK 不一致，尚未打入这个视觉候选包。Android 15 模拟器离线 320/360 CSS px 冒烟已通过；最终包的 600.93 秒夜间满编性能样本**仅 8.455 fps，未达到 30 fps 目标**，恢复安装后的安静环境 91.41 秒短测仍仅 12.253 fps。原始数据、System UI ANR 和诊断包对照在[当前验证目录](validation/emulator-android35-current-20260927/)。暂无物理手机，真机触控、发热、离线十分钟与稳定 30 fps 未验证。
