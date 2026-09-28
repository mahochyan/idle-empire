# 当前亮暗战场与兵种特效：Android 15 模拟器验收

## 范围与基线

- 工作区：`master`，HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；既有未提交改动全部保留。以当前工作区为实施基线，未回退到 2026-09-18 参考快照。
- 读过 `AGENTS.md`、`CLAUDE.md`、`index.html`；游戏脚本加载顺序仍为 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js`。本轮 Android 验收脚本不修改游戏逻辑、数值、`S/B` 或存档结构。
- 设备是 Android 15/API 35 **模拟器** `sdk_gphone64_x86_64`，WebView 124.0.6367.219，软件 GLES 为 Android Emulator OpenGL ES Translator / Google SwiftShader，启动参数含 `-gpu swiftshader_indirect`。用户暂时无法提供物理手机。
- 测试时飞行模式 1、Wi-Fi 0、IP 路由为空；APK 不含 `INTERNET` 权限。WebView 页面为 `https://appassets.androidplatform.net/assets/index.html`。

## 构建与资源审计

| 项目 | 实际结果 |
| --- | --- |
| 当前视觉候选 Debug APK | 83,772,033 字节，SHA-256 `ED60E5B9C59201DAE1DDFF97F508D31383152339E09D14653802F530F7650B07` |
| 离线构建 | Gradle `:app:assembleDebug --offline`，退出码 0；[日志](validation/emulator-android35-current-20260927/gradle-final-175gap.log) |
| 源码→生成目录→APK | **ED60 构建时** 568/568 个运行资源 SHA-256 一致，退出码 0；[构建时审计](validation/emulator-android35-current-20260927/apk-parity-final-175gap.json) |
| 本轮重点资源 | 昼夜战场背景、10 张主城全景、48 张高清立绘、六兵种 × 三动作 × 普通/紧凑共 36 图、45 张不同哈希且独立 ID 的兵种特效 PNG；候选 GLB 未进运行包 |
| 安装与数据 | `adb install -r`，未卸载、未 `pm clear`；视觉夹具前后 `B` 为空、`battleEpoch=0`、`rts_save` 版本 32 |

图层与血线源代码在构建时的目标为世界血线 `#a80018`、夜间轨道 `#2f1117`、角色可见顶部约 1.75 CSS px。包内审计包括最新 `visual.css` 和 `hd2d.js`。

诊断完成后，`hd2d.js`、`visual.css` 已从逐字节备份恢复，SHA-256 分别为 `9CC48852C5CF5282513993D92A1BC0273DB89E28D1D5F4EABB34001CB57E51B2`、`937DFE0792AE7B58ADAF36853364C3178AF5E1A09B89DAEA081B52EFF764372E`；离线重建使 APK SHA 精确回到 ED60，模拟器随后用 `adb install -r` 装回该包。当前工作区又有并行的玩法编辑：`config.js` 一行离线点位注释、`math.js` 离线发展点产量/时钟三处代码晚于这次构建。因此[恢复后重审](validation/emulator-android35-current-20260927/apk-parity-restored-ed60.json)退出码 **1**，准确报出 `source/generated mismatch: config.js` 与 `math.js`；APK 内 568 个文件及 ED60 包自身仍保持构建时内容。本轮视觉任务未擅自把后续玩法修改打进包。

## 离线界面与动作

- 320、360 CSS px [离线冒烟](validation/emulator-android35-current-20260927/)均退出 0：45/45 特效 PNG 可解码；暗色偏好重载后保留，战场背景随主题切换；1 对 2、6 对 6、12 对 12 均无站位溢出，满编 24/24 高清立绘、24 个独立槽位、双方朝向正确、六兵种 256px 紧凑动作图加载完毕。`runtimeErrors=[]`，WebGL 上下文未丢失。
- 稳态血线与立绘可见顶部间距：320px 的稀疏、中编、满编合并范围 1.28–2.24 CSS px；360px 合并范围 1.22–2.41 CSS px。六兵种攻击动作帧均约 1.75 CSS px。夜间 HUD 前景 `rgb(168, 0, 24)`、轨道 `rgb(47, 17, 23)`。
- 真实应用进程冷启到脚本可用 13.249 秒；挂载 6 对 6 后 12/12 高清立绘齐备耗时 7.218 秒；从应用启动到夹具全就绪 24.156 秒。前述 15 秒门槛针对**立绘挂载后的就绪时间**，该项通过；冷启全流程不是 15 秒以内。[原始结果](validation/emulator-android35-current-20260927/cold-start-medium.json)无 Runtime 异常。
- 当前 ED60 包的六兵种 × 攻击/受击/死亡 18/18 视觉事件通过，[动作记录](validation/emulator-android35-current-20260927/stress-all-actions.json)；九个高阶兵种 9/9 攻击事件各使用自身 ID PNG，`assetReady=true`、`visible=true`、未越界，[特效记录](validation/emulator-android35-current-20260927/final-nine-vfx.json)。这些动作只发往 HD2D 视觉接口，不触发游戏结算。

高阶特效第一次短测时模拟器弹出 `System UI isn't responding` 对话框，遮挡了最初三张截图；[遮挡原图](validation/emulator-android35-current-20260927/vfx-mage_chrono-dark-ANR-overlay.png)仅作为环境故障证据。点选 Wait 后在恢复的 ED60 包重跑，获得无遮挡的[白天影刃](validation/emulator-android35-current-20260927/vfx-archer_shadowblade-light-360.png)、[夜间时序法师](validation/emulator-android35-current-20260927/vfx-mage_chrono-dark-360.png)与[夜间杀戮神兵](validation/emulator-android35-current-20260927/vfx-slaughter_god-dark-360.png)动作截图。Android DropBox 中有 05:50 的系统应用 ANR，`com.android.systemui/.SystemUIService` 等待 20032ms；[索引](validation/emulator-android35-current-20260927/anr-dropbox-index.txt)。

## 连续十分钟性能：未通过

全部 FPS 是模拟器 `dumpsys gfxinfo` 的应用 UI 帧统计，不等同于物理手机 GPU 帧率。修改前 27482 基线 APK 的完整 SHA-256 为 `27482E5CD4986C052D7BE60F1097AA9DA001924F46D5E99C776F4FFC9743ADA6`；当前 ED60 的完整 SHA 见上表。

| 包及条件 | 时长 | UI 帧与平均率 | P50 / P95 | GPU P95 | 结论 |
| --- | ---: | ---: | ---: | ---: | --- |
| 27482 早期包，夜间 12 对 12，同模拟器 | 600.267s | 17,861 / 29.755 fps | 23 / 36ms | 20ms | 旧包基线，不能代替当前包 |
| **ED60 当前视觉包**，夜间 12 对 12，独立采样 | **600.93s** | **5,081 / 8.455 fps** | **150 / 300ms** | **4,950ms** | **30 fps 目标失败** |
| ED60，仅 App force-stop/重启 | 90.893s | 744 / 8.185 fps | 150 / 300ms | 4,950ms | 复现低帧率 |
| ED60，完整 AVD 重启 | 91.057s | 872 / 9.576 fps | 150 / 250ms | 4,950ms | 同期系统启动 ANR，环境受污染 |
| 687F 诊断包，仅头顶扫描 256→64px | 90.829s | 1,175 / 12.936 fps | 125 / 200ms | 4,950ms | 仍失败；不能仅凭该差异归因 |
| **ED60 恢复包**，系统 UI 对话框清除且 AVD 安静 | 91.410s | 1,120 / 12.253 fps | 150 / 200ms | 4,950ms | 仍低于 30 fps，稳定复现 |

ED60 600 秒独立样本始于 `2026-09-27T05:22:35Z`，结束于 `05:32:35Z`，采样期没有并发桌面渲染/构建。App PID 全程稳定；采样后 WebGL `contextLost=false`、24/24 立绘和六套紧凑动作仍就绪，但自适应像素比降到 1.0。[原始数据](validation/emulator-android35-current-20260927/performance-ed60Final.json)与 [framestats](validation/emulator-android35-current-20260927/gfxinfo-ed60Final-framestats.txt)留存。883 条采样窗口中的 `chromium:E` 均为同一条 `Invalid first_paint` 指标诊断，非 883 次崩溃；没有 fatal 或 WebGL context loss。更早一次与桌面 Edge 并发的探索样本已中断并标记，不作为性能证据。

诊断包 SHA-256 `687F58CDEB4AD45F916D01F40831C11BA95152679C058EEF9211AC46D1DF72C6`，诊断构建时 568/568 资源一致。该包仅用于 A/B，最终已恢复 ED60 包及视觉源文件。由于完整 AVD 冷启留下系统 UI ANR，诊断短样本的 12.936 fps 与 ED60 的 9.576 fps 不能视为严格隔离的代码性能差值。清除对话框后恢复 ED60 再测仍只有 12.253 fps；256px 的一次性透明像素扫描并非主要稳态瓶颈。更早 ED60 600 秒与仅 App 重启复测也低于 9 fps，故系统 UI ANR 不能解释全部低帧率。需要在稳定设备、尤其物理手机上再查渲染瓶颈和发热。

## 验收结论与回退

主要实际命令与退出码：`gradle.bat -p android :app:assembleDebug --offline` 0；`pwsh -File audit-apk.ps1` 构建时 0、恢复后 1（仅 `config.js`/`math.js` 源码后续变化）；`adb install -r app-debug.apk` 0；`node run-emulator-smoke.js 320` 0、`360` 0；`node cold-start-medium.js` 0；`powershell -File sample-performance.ps1 -Seconds 600 -Label ed60Final` 0（脚本成功采样，**帧率验收失败**）；`node stress-all-actions.js` 0；`node test-final-nine-vfx.js` 重拍后 0。脚本退出 0 仅表示收集/断言运行成功，不等于帧率达标。

- **通过**：离线资源完整性、320/360 CSS px 布局与主题、血线位置/颜色、18 动作、九高阶 ID 特效、WebGL 持续、原有存档读取路径未被验收夹具修改。
- **失败**：当前 ED60 包在此模拟器的连续十分钟 30 fps 性能目标；实测 8.455 fps。系统 UI 还出现一次 ANR 对话框；遮挡图已保留，后续另拍无遮挡特效图。恢复后与当前工作区逐文件重审因并行玩法编辑而有 `config.js`、`math.js` 两项源/包差异。
- **未运行**：物理手机离线十分钟、触控、发热和真实设备 30 fps；用户目前无法提供手机。当前视觉验收没有对战损、奖励和存档字节一致性做真实战斗回归，因此不能由本报告宣称玩法等价。
- 回退时保留 `rts_save` 和原始安装数据；可用 `adb install -r` 安装此前归档且已验收的包，不卸载、不清数据。旧包与新包的存档兼容仍需按具体版本验证；模拟器性能基线不能证明旧代码回退对所有存档安全。

验收脚本、原始 JSON、截图和日志见 [当前验证目录](validation/emulator-android35-current-20260927/)。
