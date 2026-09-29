# 战斗血线颜色与贴头距离复核（2026-09-29）

## 基线与范围

- 工作区基线：`f85e1c8624de8c9e17f7724373e65899d1085cdf`（`master`）；已有大量未提交改动，全部保留。本次只调整战斗血线的绘制、样式及相应浏览器断言，不改 `S/B`、战斗数值、奖励或 `rts_save`。
- 用户意见：红线颜色太浅，离角色有点远。旧的稀疏截图：[`qa-battle-layout-count-sparse-390.png`](../../hd2d-previews/qa-battle-layout-count-sparse-390.png)。

## 调整与画面审查

- `hd2d.js`：场景角色血线从 `#81000f` 改为 `#a9001b`，线槽从 `#35070d` 改为 `#29050b`；血线相对立绘可见头顶的像素定位从满编 `+2.5`、稀疏 `+3.5` 改为满编 `+4`、稀疏 `+5`。
- `visual.css`：顶部战况与二维回退血线统一为 `#a9001b`，保持 3 CSS px 高。
- 最初试过满编 `+6`、稀疏 `+7`，截图中线穿过红帽与头盔，故收回至上面的最终位置。过量版本证据：[`390 稀疏`](../../hd2d-previews/qa-battle-hp-close-390-battle.png)、[`390 长枪兵`](../../hd2d-previews/qa-battle-hp-close-390-spear-head-badge.png)。
- 最终位置在 320/390 CSS px 的日夜稀疏和双方各 12 团画面中贴近头顶，未遮挡面部、人数或武器；长枪兵仍以头盔而非枪尖定位：[`390 稀疏日间`](../../hd2d-previews/qa-battle-hp-verified-390-battle.png)、[`390 稀疏夜间`](../../hd2d-previews/qa-battle-hp-verified-390-dark-battle.png)、[`320 满编日间`](../../hd2d-previews/qa-battle-hp-verified-320x568-battle-full-12v12.png)、[`320 满编夜间`](../../hd2d-previews/qa-battle-hp-verified-320x568-dark-battle-full-12v12.png)、[`390 满编日间`](../../hd2d-previews/qa-battle-hp-verified-390x844-battle-full-12v12.png)、[`390 满编夜间`](../../hd2d-previews/qa-battle-hp-verified-390x844-dark-battle-full-12v12.png)、[`390 长枪兵`](../../hd2d-previews/qa-battle-hp-verified-390-spear-head-badge.png)。
- `tests/visual/browser_smoke.js` 更新原色值和贴头间距断言。稀疏 1v2 最终量测约 `-5.5px`，六对六 `-5.7…-4.3px`，满编 `-4.6…-3.4px`；范围基于各类立绘和截图确认，维持入镜、分层、独立槽位与徽标不重叠检查。

## 验证结果

| 命令 / 环境 | 退出码 | 结果 |
|---|---:|---|
| `node tests/visual/browser_smoke.js > hd2d-previews/qa-battle-hp-close-browser-20260929.json`，第一次过量位置 | 1 | 198/215；旧颜色断言与血线位置断言失败，截图显示帽顶遮挡。 |
| 同命令输出 `qa-battle-hp-refined-browser-20260929.json`，位置收回 | 1 | 201/215；血线位置明显改善；旧断言及并行科技页变化仍有失败。 |
| 同命令输出 [`qa-battle-hp-verified-browser-20260929.json`](../../hd2d-previews/qa-battle-hp-verified-browser-20260929.json)，最终代码 | 1 | **205/215；战斗血线与站位相关 33/33 通过。** 余下 10 项均是并行修改中的科技页检查失败，未把整套冒烟写成通过。 |
| `git diff --check -- hd2d.js visual.css tests/visual/browser_smoke.js` | 0 | 无空白错误；Git 报告 LF/CRLF 提示。 |

并行科技页检查随后已按「未解锁内容隐藏」的现行界面规则更新。重新运行 `node tests/visual/browser_smoke.js > hd2d-previews/qa-visual-smoke-verified-20260929.json`，退出码 **0**，实际 **217/217** 通过，包含稀疏与满编血线位置、颜色、夜间模式、320–430px 站位和二维回退检查。此前的 205/215 是修正科技页测试前的历史结果。

此前 10 项失败涉及科技页内容显隐与按钮检查；界面规则和断言同步后已在上述 217/217 复跑中全部通过。

这些截图和测试是 Windows Edge headless、HTTP 本地源和模拟 CSS 视口的验证。ADB 当前无设备，安卓手机实机触控、离线运行十分钟和帧率未运行。回退血线变化时仅撤销上述 `hd2d.js`、`visual.css` 和测试断言对应行，保留其他未提交改动；存档结构未触及。
