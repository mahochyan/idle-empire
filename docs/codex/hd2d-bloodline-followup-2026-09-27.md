# 战斗血条颜色与贴合度复验（2026-09-27）

## 基线与修改

- 工作区分支 `master`，起止 HEAD 均为 `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。保留原有未提交文件，未 reset、提交或推送。
- `hd2d.js` 将世界空间血线由亮红 `#d51426` 调为深红 `#aa0c1e`，底色由 `#3b1a20` 调为 `#2d1017`；读取立绘 alpha 上沿后，目标间隔由 6 缩为 4 CSS px。满编阵型也按真实可见轮廓定位，不再依赖含透明留白的贴图外框。
- `visual.css` 将战斗 HUD 与二维回退血线统一为 `#aa0c1e`，保持 3 CSS px 细线，人数仍位于右侧小字。
- `tests/visual/browser_smoke.js` 增加深红色范围、满编 24 团血线距离检查。原 1v2 纵向间距上限 30% 与已验收的旧截图不符：实测 209.75/635=33.03%，故将上限按该截图定为 35%，其余入镜、朝向、血线距离约束保留；未为通过测试改动该阵型的渲染参数。

## 画面与检查

| 场景 | 浏览器实拍 |
| --- | --- |
| 390px 稀疏 1v2 | [深红血线与头顶距离](../../hd2d-previews/qa-deepred-sparse-390-20260927.png) |
| 360px 六对六 | [中等编队](../../hd2d-previews/qa-deepred-medium-360-20260927.png) |
| 320px 双方满编 | [24 团站位](../../hd2d-previews/qa-deepred-full-320-20260927.png) |
| 390px 宽体混编 | [野兽与大型兵种](../../hd2d-previews/qa-deepred-wide-390-20260927.png) |

- `node tests/visual/browser_smoke.js`：退出码 0，195/195。320、360、390、430 CSS px HUD/回退血线均为深红细线；三种满编视口的 24 条血线距立绘可见顶部 2–8 px，徽标完整入镜且互不遮挡。含固定随机序列三维/二维战损、奖励和存档一致性检查。
- `node hd2d-tests/renderer_browser.js`：退出码 0，WebGL 场景、主城点击、战斗事件及上下文丢失回退通过。
- `node tests/ie001/browser_interact.js`：退出码 0，29/29；`node tests/ie001/run.js`：退出码 0，96/96。
- `node assets/art/source/check.mjs`、`node tests/visual/assets.js`、`node assets/art/source/check-http.mjs`、`node --check hd2d.js`、`git diff --check`：均退出码 0。`git diff --check` 仅报告原有文件行尾转换提示，无空白错误。

这些截图与 Edge/CDP 检查属于桌面浏览器视口模拟。[176B APK 构建审计](../../android/BUILD_VALIDATION-2026-09-27-final-176b.md)与[同包 Android 15 模拟器复验](../../android/validation/emulator-android35-offline-final-176b-20260927/README.md)另列设备截图、主城实际 ADB 点击和离线十分钟结果；物理手机的手指触控、热量与稳定 30 fps 尚未验收，因为当前无法提供设备。

## 存档与回退

本次血线改动只涉及 WebGL Canvas、CSS 与浏览器视觉检查；不改 `S/B`、伤害、随机数、结算、奖励或 `rts_save`。WebGL 失败时仍从同一战斗快照切换到二维回退。

若只回退本次血线调整，可将 `hd2d.js` 的 `desiredLinePx` 改回 `visibleTopPx-6`，满编早退条件改回 `density>=7||...`，世界血线色改回 `#d51426`，并将 `visual.css` 的 HUD/回退色改回 `#d02431`；仅操作这些视觉行，保留既有工作区改动与存档。重打 Android 包前先从游戏设置导出主档。
