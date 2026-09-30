# 战斗血线深色与头部定位复核（2026-09-30）

## 基线与本次决定

- 当前任务开工时 `master` 为 `4cab3d7c4579d8236835cc593188807663e8bef8`；工作区已有大量其他任务的未提交改动，均保留。参考快照 `98571e38801f71bfdbb982a626e0e58f510abb98` 仅用于历史审查，不作为回退目标。
- 用户反馈血线颜色太浅，部分兵种的线离角色太远。代码现状是统一 `#a9001b`，头部检测仅要求图像中央宽度约 4.5% 的连续不透明像素，容易把光环、角或武器细部当作头顶。
- 本次只调整视觉层：场景血线与 HUD／二维回退血线统一为更深的 `#890012`；场景线槽为 `#25040a`。头部定位要求中央约 9% 的连续不透明像素，并把相对锚点的偏移从满编／稀疏 `+4/+5` 改为 `+2/+3` CSS px。两项合用，使普通兵血线略靠近头部，而带角、光环的兵种能越过装饰物靠近头盔／鬃毛。线宽未增加，人数仍置于血线右侧。
- `index.html` 更新 CSS／脚本查询版本，避免已有缓存继续显示旧样式。未改战斗状态 `B`、游戏状态 `S`、伤害、出手顺序、奖励或 `rts_save`。
- 审查新动作截图时发现倒地角色旁仍留有两名缩小的随从及血条。`hd2d.js` 现于倒地动作期间隐藏这两项，动作结束而编队仍存在时恢复；已在动作浏览器 fixture 中验证。此项也只作用于视觉对象。

## 可复核画面

- [390px 日间稀疏](../../hd2d-previews/qa-battle-hp-anchor-390-battle.png)、[390px 夜间稀疏](../../hd2d-previews/qa-battle-hp-anchor-390-dark-battle.png)
- [320px 日间满编](../../hd2d-previews/qa-battle-hp-anchor-320x568-battle-full-12v12.png)、[390px 日间满编](../../hd2d-previews/qa-battle-hp-anchor-390x844-battle-full-12v12.png)、[390px 夜间满编](../../hd2d-previews/qa-battle-hp-anchor-390x844-dark-battle-full-12v12.png)
- [长枪兵与枪尖区别](../../hd2d-previews/qa-battle-hp-anchor-390-spear-head-badge.png)、[高阶兵与野兽角](../../hd2d-previews/qa-battle-hp-anchor-360x800-vfx-star-badges.png)
- [极限试炼守卫与头顶光环](../../hd2d-previews/qa-bloodline-trial_guard_extreme-current-battle-390.png)
- 390px 稀疏画面量测：最上方敌兵血线较前版下移约 1px，较低敌兵约 3px，我方约 5px；量测受立绘外形与动作影响，不能把这三个数当作所有兵种统一偏移。

## 实际验证

| 命令／环境 | 退出码 | 结果 |
| --- | ---: | --- |
| `node --check hd2d.js`、`node --check tests/visual/browser_smoke.js` | 0、0 | 语法通过。 |
| `node tests/visual/archer_t1_actions_browser.js mage_t1` | 0 | 18/18，390px 稀疏与 320px 满编攻击、受击、倒地和图集解码通过。 |
| `node tests/visual/archer_t1_actions_browser.js infantry_shield` | 0 | 18/18，含同排动作 alpha 重叠审查。 |
| `node tests/visual/archer_t1_actions_browser.js iron_spearman`（倒地修正后） | 0 | 22/22，含倒地隐藏／幸存恢复，390px 稀疏与 320px 满编；同排动作最大 alpha 重叠约 0.007。 |
| `node tests/visual/archer_t1_actions_browser.js bronze_guard`（新图集接入后） | 0 | 26/26，攻击、受击、倒地在 390px 稀疏与 320px 满编可见，倒地随从／徽标隐藏并在幸存后恢复。 |
| `node tools/visual/qa_iron_spear_vfx.js --unit=quantum_trooper --assert-solo-balance` | 0 | 390px 单挑角色入镜且上下留白平衡，血线近头部，特效贴图可见。 |
| `node tools/visual/qa_iron_spear_vfx.js --unit=trial_guard_extreme --assert-solo-balance` | 0 | 390px 光环高阶兵种的血线仍在头盔上沿，单挑入镜，专属攻击图可见。 |
| `node tools/visual/qa_iron_spear_vfx.js --unit=star_trooper --assert-solo-balance` | 0 | 390px 五星兵攻击轨迹与血线入镜；WebGL 贴图已加载且效果可见。 |
| `node tools/visual/qa_iron_spear_vfx.js --unit=mage_time --assert-solo-balance`、`--event=hit` | 0、0 | 时间法师攻击／命中贴图均在 WebGL 场景中加载并可见。 |
| `node tests/visual/browser_smoke.js > hd2d-previews/qa-battle-hp-anchor-browser-pass-20260930.json` | 0 | **217/217**；含 320／360／390／430px、日夜、稀疏／满编、二维回退、血线颜色与位置。 |
| `node tests/visual/browser_smoke.js > hd2d-previews/qa-visual-final-12-actions-bloodline-edge-20260930.json` | 1 | 最新 12 套动作后的复测 **214/217**；失败三项集中在 WebGL 特效采样时机，攻击／命中与五星中途轨迹未在全套长测试的窗口内捕获；其它 214 项通过。 |
| 改进贴图预热采样后重跑全套 `browser_smoke.js` 两次 | 1、1 | Edge CDP 的 `Runtime.evaluate` 分别在 25 秒和 60 秒超时，未产出完整结果；不能写作通过。单兵攻击／命中专测见上。 |
| `git diff --check -- hd2d.js visual.css index.html tests/visual/browser_smoke.js` | 0 | 无空白错误；Windows 换行提示不影响检查。 |

浏览器验证使用 Windows Edge headless、本地 HTTP 源及模拟 CSS 视口。早先血线版完整验收 217/217 运行于倒地隐藏和第十二套动作接入之前；两项之后的最新完整复测仍有上述三项特效采样未通过。测试脚本已对慢贴图加载加预热重放，CDP 超时上限调到 60 秒，但共享主机上随后两次完整运行卡在 `Runtime.evaluate`，尚须在较空闲环境完成最终全套复核。倒地隐藏已由铁器长枪兵与青铜守卫动作 fixture 单独覆盖。Edge 临时用户目录偶发 `EPERM` 清理提示，已生成截图与通过结论不依赖清理结果。

安卓实体手机当前无法提供，最新血线和动作图未完成真机离线十分钟、触控与帧率验收。回退时只撤销本次 `hd2d.js`、`visual.css`、`index.html` 和视觉测试相应行；美术源图与存档不需要回退。
