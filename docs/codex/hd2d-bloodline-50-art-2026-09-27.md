# HD‑2D 血线与当前 50 单位美术验收（2026‑09‑27）

## 工作区与改动

- 基线：`master`，HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；沿用已有未提交改动，没有重置、提交、推送或改存档版本。
- 按反馈把角色血线及 HUD/二维回退血线统一为 `#e00020`，角色血线中心目标从可见头顶上方 1.75 CSS px 移到 1.0 CSS px。线条继续保持 3 CSS px 左右，人数放在右侧。
- 为当前配置新增的 `revival_god`、`silence_god`、`trial_guard_easy`、`trial_guard_perfect`、`trial_guard_extreme` 接入各自立绘、32px 图标、动作帧与专属 VFX；保留原 ID，图标字段改为各自 ID。立绘和特效均有可编辑母图/源文件与完整提示词记录。
- 浏览器测试由固定 45 单位/10 敌人的断言改为按当前配置遍历；15 个敌方专属角色分批挂载，避免把超出单场 12 槽的第 13 个误判为资源丢失。Android 包审计允许后续增加单位，同时继续逐文件校验源码、生成目录与 APK。
- 独立基础时代主楼 3D 样板见 [360×200 对照](../../hd2d-previews/qa-town-base-village-comparison-360x200.png)。原全景更丰富，样板没有进入运行地图；九时代运行图仍是既有的 2.5D 全景。

## 冻结 Android 包

- [最终 APK](../../android/validation/bloodline-20260927/app-debug-50-units.apk)：85,588,186 字节，SHA‑256 `AA1FCFAA8C2D0792B3DE4F916472161D9F2C35A345C92ECD72EA42500A2CB30B`。
- `Gradle 8.13 :app:assembleDebug --offline` 退出码 0；[构建日志](../../android/validation/bloodline-20260927/gradle-50-units.log)。
- [逐文件审计](../../android/validation/emulator-android35-current-20260927/apk-parity-50-units.json)退出码 0：源码、生成目录和 APK 603/603 一致，差异 0；包含 50 张逐单位 VFX 和全部运行立绘。候选 3D 样板未打包。

## 实测

| 检查 | 结果 |
| --- | --- |
| `node tests/visual/assets.js` | 退出码 0；57 个图标、50 张独立兵种立绘、九时代城镇资源覆盖 |
| `node assets/art/source/check.mjs` | 退出码 0；50 张逐单位特效及原始资源完整 |
| `node tests/visual/browser_smoke.js` | 退出码 0，200/200；Edge CDP，320/360/390/430 CSS px；含血线、敌方贴图/VFX、满编、夜间与二维回退 |
| `node tests/ie001/run.js` | 退出码 0，96/96；存档兼容与保护 |
| `node tests/progression/awakening_trial.js` | 退出码 0，7/7；对应并行试炼逻辑 |
| `node tests/progression/combat_guards.js`、`combat_order.js` | 均退出码 0，13/13 与 5/5 |
| Android 35 模拟器离线 `adb install -r` | 退出码 0；未卸载或清空数据 |
| Android WebView 320 与 390 CSS px | 各 34/34，0 WebView 错误；稀疏、五对五、12 对 12 满编均入镜，五名新敌人立绘和专属特效从 APK 解码；无横向溢出 |

Android 结果与截图在 [final-50-units](../../android/validation/bloodline-20260927/final-50-units/)；[320 结果](../../android/validation/bloodline-20260927/final-50-units/final-320.json)、[390 结果](../../android/validation/bloodline-20260927/final-50-units/final-390.json)。血线像素为 RGB(224, 0, 32)，中心距可见头顶约 0.4–1.6 CSS px；[320 五对五](../../android/validation/bloodline-20260927/final-50-units/battle-five-320.png)、[390 五对五](../../android/validation/bloodline-20260927/final-50-units/battle-five-390.png)、[390 满编特效](../../android/validation/bloodline-20260927/final-50-units/battle-vfx-trial_guard_extreme-390.png)已人工复核。每档测试内，原始 `rts_save` 哈希前后相同，`B` 与 `battleEpoch` 不变；跨 APK 安装前后的存档原文有正常时间推进差异，不能声称完全相同。

## 边界与回退

- 用户暂时不能提供物理手机；真机离线十分钟、触控手感和中端设备稳定 30 帧尚未验收。旧 ED60 包的软件渲染 600 秒约 8.455 fps、宿主 GPU 60 秒约 24.248 fps，均未达 30 fps；这些数字不能当成新包性能结果。
- 本轮没有把候选主楼 3D 样板接到运行地图，也没有把九时代城镇全景替换为九套真三维模型。
- 视觉回退可以单独恢复 `hd2d.js` 与 `visual.css` 的血线参数，不需要改 `rts_save`。若要回退 APK，先导出并验证当前存档，再核对旧版对并行玩法字段的兼容性；不能假定直接安装旧包一定安全。
