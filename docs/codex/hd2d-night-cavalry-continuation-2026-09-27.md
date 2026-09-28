# HD-2D 夜战、骑兵动作与资源补齐续验

## 基线与范围

实施基线为 `master`、`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。工作区开工前已有大量未提交和未追踪资源，未 reset、checkout、清除存档、提交或推送。`index.html` 的业务脚本顺序仍为 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js`。本次只改视觉层、资源、校验脚本和文档，战斗数值、出手、奖励和 `rts_save` 结构未变。

## 本次可审查结果

- 以现有日间战场为参考生成蓝紫夜战母图 `assets/art/source/generated/battle-night-master.png`，由 `assets/art/scene/optimize.py` 打包为 `assets/art/scene/battle-night.png`。昼夜主题切换时，WebGL 场景和二维回退同步选择相应背景；角色、按钮和文字不套整屏变暗滤镜。夜战场景图按原有资源目录随离线 APK 打包。
- 应用户进一步反馈，`hd2d.js` 的世界血线与 `visual.css` 的 HUD、二维回退统一压深为 `#a80018`，仍保持约 3 CSS px；人数为线右侧小字。步兵、弓兵与两种骑兵的部分举剑、抬弓、举枪帧使用头部锚点。头顶扫描从 64px 提高至 256px，修正细角/头盔边缘漏检；为容纳 CSS 子像素投影，血线心距可见顶边目标设为 1.75 CSS px。稀疏、六对六、满编及动作画面已针对这次修改在桌面与 Android 模拟器重新验收。
- `cavalry_t1`、`gold_cavalry` 各有攻击、受击、倒地四帧高清图集；六个已接入兵种的 18 张动作图集另有 4×256 的紧凑版，满编选择紧凑版，稀疏编队使用 4×512 原版。完整版旧 12 张图集哈希未改变。母图、可复现打包与 64px 对照见 `assets/art/source/generated/units/actions/`。
- 第三至第五批 18 个科技线兵种及最后 9 个高阶兵种的专属攻击特效已接入，全部 45 个兵种均有独立 ImageGen 母图、同 ID 运行 PNG 与 SVG。最后九张经过 64px 浅/深底目视审核，[九宫格](../../hd2d-previews/qa-vfx-final-nine-runtime-64.png)可复核；旧运行图保存在 `assets/art/source/generated/vfx/units/previous-runtime-final9/`。
- 基础时代主城新增独立 3D＋2D 样板。200px 对照显示它比旧模型更接近原画，但院落与地形细节仍不足，因此未替换九时代全景。见 `docs/codex/hd2d-town-diorama-candidate-2026-09-27.md`。

## 已完成的本地验证

| 命令 | 结果 |
| --- | --- |
| `node tests/ie001/run.js` | 退出码 0，96 通过 / 0 失败 |
| `node tests/visual/browser_smoke.js` | 进一步修改后隔离重跑退出码 0，200/200；320/360/390/430 CSS px、昼夜、满编与回退。此前两次与模拟器操作并行的 CDP 连接超时未进入断言；独立运行后先有 199/200，实际发现细角扫描漏检及 430px 子像素边界，修正扫描精度和目标间距后 200/200 通过。CDP 超时阈值未更改 |
| `node hd2d-tests/renderer_browser.js` | 最终隔离重跑退出码 0；六兵种动作帧血线实测 1.75px、骑兵头部锚点、256px 密集图集、上下文丢失后二维回退 |
| `node tests/visual/assets.js`、`node assets/art/source/check.mjs` | 均退出码 0 |
| `node assets/art/source/check-http.mjs` | 退出码 0，571 个运行 URL 均返回 200；包含夜战、高清及紧凑动作、45 张单位 VFX |
| `python -B assets/art/source/generated/units/actions/layout_cavalry.py --check` | 退出码 0，骑兵源图按三格透明边距复核 |
| `python -B assets/art/source/generated/units/actions/pack.py --check` | 退出码 0，18 张完整与 18 张紧凑图集逐像素一致 |
| `python -B assets/art/source/vfx/review-techline-batches.py`、`python -B assets/art/source/vfx/review-techline-batch5.py` | 均退出码 0；独立母图、运行图、备份和 SVG 核对 |
| `python -B assets/art/source/vfx/review-final-nine.py` | 退出码 0；最后九张特效校验，45/45 母图和运行图 SHA 各自独立，全量重建 45/45 SHA 一致 |

## 存档、限制与回退

视觉偏好仍单独保存为 `idle_empire_visual_theme`；不写入 `rts_save`。浏览器测试对战斗视觉层有无 WebGL 时的结算一致性做了检查；本次没有更改存档读取或战斗逻辑。回退夜战可移除夜间场景切换和夜图，回退新动作可将 `hiresActionTypes` 恢复为原四个 ID 并保留已有完整图集；回退前建议从设置导出存档。

Android 修改前 Debug APK 为 83,737,261 字节、SHA-256 `27482E5CD4986C052D7BE60F1097AA9DA001924F46D5E99C776F4FFC9743ADA6`；568/568 个源文件、Gradle 生成文件与 APK 资源逐项 SHA-256 一致。Android 15 模拟器飞行模式开启、Wi-Fi 关闭，320/360 CSS px 冒烟已通过，45/45 VFX 解码、六兵种紧凑动作、夜间切换与满编站位可见。该包的独立 600.267 秒基线记录了 17,861 个 Android UI 帧、29.755 fps、P50 23 ms、P95 36 ms、GPU P95 20 ms；同一进程、WebGL 与 24 个立绘保持，过滤后的错误 0。此后血线颜色和距离再调整，该包只能作为修改前基线；最终包的性能实测见下文及 `android/validation/emulator-android35-current-20260927/`。用户暂时无法提供物理 Android 手机，真机触控、发热、离线十分钟及稳定 30 fps **未验证**；模拟器结果不能替代。

最终候选 Debug APK 的 SHA-256 为 `ED60E5B9C59201DAE1DDFF97F508D31383152339E09D14653802F530F7650B07`，83,772,033 字节；**构建及还原时** 568/568 个资源源文件、Gradle 生成文件与 APK 哈希一致。Android 15 离线模拟器 320/360 CSS px 冒烟均退出码 0，稀疏、六对六、满编血线距离总体 1.22–2.41 CSS px；六兵种动作帧 1.75px，夜间 HUD 红/轨道色为 `rgb(168,0,24)` / `rgb(47,17,23)`，无横向溢出，24 个编队占独立槽位。真实进程冷启测试退出码 0：应用脚本在启动后 13.249 秒就绪，六对六场景挂载后 7.218 秒 12/12 高清立绘全部就绪，总计启动后 24.156 秒。未发现 WebView Runtime/console 错误、WebGL 正常、`B` 空、存档版本 32；这段冷启动等待仍需做体验优化。最终包的第一轮独立 600.93 秒满编夜战性能样本**失败**：5,081 个 Android UI 帧、8.455 fps、P50 150ms、P95 300ms，尽管同一进程、24 张立绘与 WebGL 保持。重启应用后的 90.893 秒样本仍仅 8.185 fps；不得把早先 27482 包的 29.755 fps 当作本包结果。Android 证据目录为 `android/validation/emulator-android35-current-20260927/`。

继续诊断：重启整个 AVD 后 ED60 包的 91.057 秒样本仍仅 9.576 fps。只将透明顶边扫描临时退回 64px 的 687F 诊断 APK 在同 AVD 的 90.829 秒样本为 12.936 fps，仍远低于 30；其间发现模拟器 `com.android.systemui` 曾弹出无响应对话框，DropBox 记录约 20 秒 ANR。故现有对照不能证明 256px 一次性扫描是主要原因，也不能把模拟器图形故障掩盖为通过。诊断前将正式源码与 ED60 APK 保留了逐字节备份；诊断后正式源码已按 SHA-256 `9CC48852…`（`hd2d.js`）及 `937DFE07…`（`visual.css`）恢复，Gradle 重建得到与原始 ED60 **相同**的 APK SHA，568/568 资源重审通过。恢复 ED60 安装、系统 UI 弹窗清除后的最后 91.410 秒夜战样本仍只有 12.253 fps（P50 150ms、P95 200ms），同一 PID、WebGL 正常且 logcat:E 为 0；性能失败可以稳定复现，已停止重复采样。物理手机仍不可用，最终稳定 30 fps 尚未验收。

还原构建后，工作区有并行任务继续修改 `config.js` 的发展线说明与 `math.js` 的离线采集计算。重新比对**当前**工作区与已冻结的 ED60 APK 时，仅这两个运行文件不一致；没有改写或覆盖这些并行改动。ED60 是上述血线视觉改动在构建时源码的验收包，不能称为当前整个工作区的完整构建；若随后需要发布当前工作区版本，应先单独审查并验证这两处玩法改动，再重新构建与验收。
