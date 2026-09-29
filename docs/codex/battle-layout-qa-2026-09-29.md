# 战斗站位与人数标识复核（2026-09-29）

## 基线与改动

- 工作区基线：`master`，`f85e1c8624de8c9e17f7724373e65899d1085cdf`。开工时已有未提交改动，全部保留。
- 320px 满编截图中，头顶人数绘在 128px 画布内，`20px` 原字号缩到屏幕后难读。`hd2d.js` 只把满编人数原字号改为 `28px`；血线颜色、粗细、位置、徽标宽度和战斗状态均未改。
- `tests/visual/browser_smoke.js` 增加 360×800 满编样本；原有 320、390、430px 满编检查仍保留。

## 实际验收

| 检查 | 结果 |
| --- | --- |
| `node --check hd2d.js` | 退出码 0 |
| 修改前 `node tests/visual/browser_smoke.js` | 退出码 0；210/210 |
| 修改后、增加 360px 满编样本 `node tests/visual/browser_smoke.js` | 退出码 0；215/215 |
| `git diff --check` | 退出码 0；只有 Git 的 LF/CRLF 提示 |

测试在 Windows Edge headless CDP、HTTP 静态源、模拟 CSS 视口执行。覆盖 320/360/390/430px 稀疏与 6v6，320/360/390/430px 满编，夜间满编、宽体混编、敌方野兽与机兵混编、减员后槽位稳定、敌左我右朝向、血线贴近头部、徽标不越界不重叠、256px 动作帧、53 个专属特效贴图的 WebGL 可见性、倍速与二维回退。6v6 与满编属于仅供视觉测试的内存编队样本，不证明玩法上可达。

截图：`hd2d-previews/qa-battle-layout-count-before-full-320.png` 为改动前；`qa-battle-layout-count-full-320.png`、`qa-battle-layout-count-full-360.png`、`qa-battle-layout-count-full-390.png`、`qa-battle-layout-count-full-430.png` 为改动后。另有 `qa-battle-layout-count-medium-320.png`、`qa-battle-layout-count-sparse-390.png` 和 `qa-battle-layout-count-dark-full-320.png`。

未进行安卓实机验收：当前没有可连接的实体手机。此项不能由 Edge 模拟视口替代。改动不触及 `S/B`、数值、计时或 `rts_save`；若要回退，只需恢复 `hd2d.js` 中人数画布字号与测试新增的 360px 样本。
