# Android 离线容器验证：四兵种动作最终包

验证日为香港时间 2026-09-27；原始采样时间戳采用 UTC。仅验证 Android 15 模拟器，用户暂时无法提供物理手机。工作区在验证前已包含大量未提交改动，本次没有清除存档或重置文件。Git 基线和最终 HEAD 均为 `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，分支 `master`。先前 `850C498A...` APK 是步兵头部锚点修改前的历史基线，其十分钟结果不用于本包。

## 构建与包内资源

- `:app:assembleDebug` 退出码 0，`BUILD SUCCESSFUL in 20s`，34 个任务中 4 个执行、30 个已是最新。当前 APK：[app-debug.apk](app/build/outputs/apk/debug/app-debug.apk)，69,813,872 字节；SHA-256 `15DA2AF33C8FDB56FFDA60A0F78DA27386B87AC80C0AC92D65F1616D0B68E8B3`。
- [资源校验](validation/emulator-android35-four-atlas-20260927/apk-parity.json)退出码 0：源文件、Gradle 生成目录和 APK 的 543 个运行文件逐项 SHA-256 一致，差异 0。包括当前 `hd2d.js`、`visual.css`、四兵种各三张高清动作图集、动作 manifest，以及两批专属特效。`assets/art/models/candidates/**` 没有进入 APK。
- 运行资源冻结后又做了一次独立的 [live APK 校验](validation/emulator-android35-four-atlas-20260927/apk-parity-live-final.json)，退出码 0；当前源目录仍与生成目录及 15DA APK 的 543/543 个文件一致，差异 0。定向核对 `hd2d.js`、`visual.css`、12 张动作 PNG、18 张已有独立美术母图的单位特效 PNG（12 个兵种与六只野兽）和动作 manifest，共 33/33 项存在；没有覆盖构建时 JSON。
- `aapt dump permissions` 退出码 0，仅显示包名，没有 `INTERNET` 权限。安装 `adb install -r` 成功，未执行 `pm clear` 或卸载。模拟器为 `sdk_gphone64_x86_64`、Android 15/API 35、WebView `124.0.6367.219`；飞行模式为 1、Wi-Fi 为 0、`ip route` 为空。页面实际地址为 `https://appassets.androidplatform.net/assets/index.html`。

## 模拟器画面与动作

320×568、360×800 CSS px 的 ADB 冒烟脚本均退出码 0。[320 结果](validation/emulator-android35-four-atlas-20260927/runtime-320.json)与[360 结果](validation/emulator-android35-four-atlas-20260927/runtime-360.json)记录了 1 对 2、6 对 6 和 12 对 12 快照。满编分别有 24 张立绘和 24 个独立槽位；两边朝向相反，页面无横向溢出。每团红色细血线相对当前角色锚点约 2–3 CSS px。320 满编紧凑，部分细小人数徽标较难读，需要真实手机进一步确认。

四兵种 `infantry`、`star_trooper`、`archer`、`archer_crossbow` 的 `portraitActionsReady` 均为 true；各自的四帧攻击动作实际触发，效果贴图完成解码且视觉效果可见。两批中被脚本检查的 12 张专属特效 PNG 均在 Android WebView 解码成功。[320 满编截图](validation/emulator-android35-four-atlas-20260927/battle-full-320.png)、[360 满编截图](validation/emulator-android35-four-atlas-20260927/battle-full-360.png)、[弩兵攻击截图](validation/emulator-android35-four-atlas-20260927/attack-archer_crossbow-360.png)可供目视核对。

十分钟采样结束后，用单独的 360 px 稀疏快照复验步兵举剑。[截图](validation/emulator-android35-four-atlas-20260927/sparse-sword-frame1-360.png)中血线位于头盔上方、举起的剑尖下方，未压住头盔；[CDP 记录](validation/emulator-android35-four-atlas-20260927/sparse-sword-360.json)在动作约 437 ms 时为四帧图集，锚点间隔 2.5 CSS px，WebGL 未丢失。最初尝试连续抓三个动作帧时，ADB 截屏耗时使第二帧采样落到动画结束后；最终以单帧脚本重跑并退出码 0。这是采样时序问题，不计作游戏动作失败。

## 600 秒独立离线样本

采样期间固定在 360×800 CSS px 的四兵种混合 12 对 12 战场，不切换页面。开始前和结束后均为 24 个可见角色、四兵种动作贴图解码就绪、一个 WebGL canvas、`contextLost=false`、渲染像素比 1.4、主进程 PID 9152、WebView 渲染 PID 9192；`B` 为空、`battleEpoch=0`、`rts_save.v=32`。`portraitActionsReady` 仅证明动作贴图已加载到解码缓存；本次还实际触发了四兵种攻击动作，但不宣称十二张图集全驻留 GPU。

| 指标 | 结果 |
| --- | ---: |
| UTC 开始 / 结束 | 2026-09-26 21:27:39.846 / 21:37:39.841 |
| 采样命令退出码 | 0 |
| gfxinfo 窗口 / UI 帧 | 600.221 s / 18,036 |
| Android UI 帧率 | 30.049 fps |
| 帧时 P50 / P95 | 22 / 34 ms |
| GPU 帧时 P95 | 21 ms |
| 主进程 PID | 9152 → 9152 |
| 过滤的 AndroidRuntime/chromium 错误 | 0 |
| 应用 PSS / Native Heap PSS | 100,709 / 16,148 → 104,551 / 16,040 KiB |
| WebView 渲染进程 PSS / Native Heap PSS | 208,527 / 1,400 → 134,973 / 1,412 KiB |

[性能摘要](validation/emulator-android35-four-atlas-20260927/performance-600s.json)、[gfxinfo 原文](validation/emulator-android35-four-atlas-20260927/gfxinfo-600s-framestats.txt)、[采样前状态](validation/emulator-android35-four-atlas-20260927/status-before600.json)、[采样后状态](validation/emulator-android35-four-atlas-20260927/status-after600.json)及 `meminfo-before600-*` / `meminfo-after600-*` 原文均保存在同一验证目录。模拟器 `Graphics PSS` 两个进程均报告 0 KiB，这是该模拟器的记账限制，不能解释为没有 GPU 占用。`gfxinfo` 的 UI 帧率不是物理手机实际性能。

## 独立 12 动作压力检查

长样本之后另行执行，不混入上述帧率统计。四兵种分别播放攻击、受击、倒地，共 12 个视觉事件；每项状态显示四帧动作已激活，[原始事件记录](validation/emulator-android35-four-atlas-20260927/stress-all-actions.json)退出码 0。结束后仍为同一 PID 9152、24 个单位、`contextLost=false`、`B` 为空、`battleEpoch=0`、存档版本 32。[步兵受击](validation/emulator-android35-four-atlas-20260927/stress-infantry-hit.png)与[弩兵倒地](validation/emulator-android35-four-atlas-20260927/stress-archer_crossbow-death.png)截图保留。

压力检查前后应用 PSS 为 102,961→102,935 KiB，WebView 渲染进程 PSS 为 135,317→134,997 KiB；Native Heap PSS 分别为 16,032→16,036 KiB 与 1,412→1,412 KiB。原始 `meminfo-beforeStress-*` / `meminfo-afterStress-*` 在同一验证目录。逐一显示十二种动作说明这些图集在当前场景被调用并经 WebGL 渲染；没有 GPU 驻留量的直接测量。

## 存档、限制与回退

`adb install -r` 保留了模拟器已有 `rts_save`，启动、两种宽度检查、十分钟样本和动作压力检查后版本均为 32；视觉快照的 `B` 始终为空、`battleEpoch` 始终为 0。本次没有修改游戏数值、结算或存档结构，也没有对完整存档字节做前后哈希比较。

缺少物理手机，因此真机离线十分钟、触控手感、发热和中端设备帧率仍未验证。若需回退此 Android 包，请先导出现有存档，再使用经归档的旧 APK 或恢复旧渲染资源后重新构建并以 `adb install -r` 覆盖；当前工作区的构建输出仅保留此最终 APK，历史 `850C...` 包未留存为可直接安装的文件。不要通过清除应用数据回退。
