# 科技兵种图谱收纳与 Android 渲染定位

## 当前基线与改动

工作区为 `master`、HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，开工时已有大量未提交文件。本轮保留它们，未重置、提交、推送或发布。`index.html` 的业务脚本顺序仍为 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js`。

- `ui.js`：完整科技图谱的“兵种”分类将精魄库存收成可展开的摘要，默认直接看到四条兵种线和各自立绘。摘要显示当前持有的精魄种类数；展开后保留原有逐项库存、Boss/科技点/战功说明。展开状态保存在当前页面内存，页面重渲染时保留；不写入游戏存档。
- `visual.css`：库存摘要使用至少 48 CSS px 的触控高度，日夜主题沿用现有文字与卡片色板。
- `assets/art/source/check.mjs`：额外检查九时代的科技 ID、资源清单和运行/母图不重复。具体覆盖核查见[九时代城镇图报告](hd2d-town-era-coverage-audit-2026-09-27.md)。
- `hd2d-tests/emulator_renderer_probe.js`：新增只在开发侧运行的短时 WebView 渲染探针；使用 `ADB` 或 `ANDROID_HOME` 查找 adb，不把原始存档文本传回 Node。游戏逻辑、数值与 APK 内容未因探针改变。

## 视觉和资源验证

`node tests/visual/browser_smoke.js` 首次隔离运行遇到 CDP 超时，未进入完整断言；之后一次完成断言时为 199/200，发现库存组件结束标签错误导致兵种节点消失。修正后又遇到一次 CDP 超时；停止模拟器中的持续 WebGL 场景后，最终隔离重跑退出码 **0，200/200**。它覆盖 320/360/390/430 CSS px、日夜、科技树全部 26 个兵种节点与立绘加载、满编战斗和二维回退。结果在 `hd2d-previews/qa-tech-inventory-smoke-20260927.json`；最终 stderr 为空。视觉截图：[320px](../../hd2d-previews/qa-tech-essence-collapsed-320-20260927.png)、[390px](../../hd2d-previews/qa-tech-essence-collapsed-390-20260927.png)。

`node --check ui.js`、`node --check hd2d-tests/emulator_renderer_probe.js`、`node assets/art/source/check.mjs`、`node tests/visual/assets.js` 均退出码 0；`node tests/ie001/run.js` 退出码 0、96/96；`git diff --check` 退出码 0。资源校验报告显示 45 个不同兵种立绘、九时代城镇图、45 个兵种特效及相关母图/清单可读。该校验只证明文件和映射，不替代画质评审或手机运行。`ie001` 是当前工作区的开发侧逻辑回归，不能把它当作已冻结 ED60 APK 或真实战斗在手机上的验证。

## Android 性能定位

已验收的 ED60 APK 在 Android 15 SwiftShader 模拟器、360 CSS px、暗色 12 对 12 的十分钟样本为 **8.455 fps**，30 fps 目标失败；具体证据见[ED60 Android 报告](../../android/BUILD_VALIDATION-2026-09-27-current-ed60.md)。本轮探针在同一场景做短时可逆遮挡：完整场景 73 次绘制调用约 13–15 fps；隐藏阴影及人数徽标降至 25 次绘制调用，仍约 18 fps；连场景也隐藏、只做 WebGL 清屏仍约 19 fps；跳过 `renderer.render` 约 28 fps。渲染调用的 JavaScript 耗时中位数约 0.7 ms。[短测数据](../../android/validation/emulator-android35-current-20260927/renderer-ablation-swiftshader-20260927.json)留存。

同一模拟器改用宿主 NVIDIA RTX 4070 SUPER GLES 后，对**同一 ED60 APK**做一次 60 秒离线夜战 12 对 12 样本：1,484 帧 / 61.202 秒 = **24.248 fps**，P50 44 ms、P95 93 ms，24/24 立绘、WebGL 和进程保持，0 条 logcat 错误或上下文丢失；[原始结果](../../android/validation/emulator-android35-current-20260927/performance-hostGpu60.json)。它优于 SwiftShader，但仍低于 30 fps；后端不同、样本时长不同，不能把两组差值解释为代码提速。上述对照说明当前模拟器的图形后端负担明显，不能据此认定高清立绘本身是根因；因此没有用降清晰度或删特效来换取未经证实的帧率。

短测后 AVD 已恢复原 `-gpu swiftshader_indirect` 启动方式，SurfaceFlinger 再次显示 Google SwiftShader GLES；ED60 APK 哈希、飞行模式与 Wi-Fi 设置保持，应用目前停止，未卸载或清数据。恢复后未重新打开应用，因此不把恢复后的存档字节状态写成已验证。详细命令和证据见[宿主 GPU 对照记录](../../android/validation/emulator-android35-current-20260927/host-gpu-evaluation-20260927.md)。

## 存档、限制与回退

本轮 UI 仅改变科技库存的展示，不改 `S/B`、数值、研究动作或 `rts_save` 结构。早先短时探针运行核对了存档未变；之后将脚本改为在浏览器内比较存档、通过环境变量定位 adb，修改后的脚本只做了语法检查，未重新运行。探针设计为结束时恢复 WebGL 构造器与视觉快照。回退 UI 时只撤销 `ui.js` 的库存 `<details>` 和 `visual.css` 的相应样式；不删除玩家数据。资源校验和探针可单独移除，不影响运行包。

九时代城镇图已经覆盖，但主城仍是 2.5D 全景，尚未有九套质量达标的独立三维城镇。Android 物理手机仍不可用，实机触控、发热、离线十分钟及稳定 30 fps 未验证。当前 APK 构建早于工作区内并行的 `config.js`/`math.js` 改动，不能把 ED60 称作当前完整工作区构建。本轮 UI 修改也尚未重新打入 Android 包；上面的 200/200 是桌面浏览器结果，不能替代新包 Android 验收。
