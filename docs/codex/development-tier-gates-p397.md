# P397｜兵营与兵种层级增加拓境首胜入口

基线：`master` / `6552bad5c459971d68304dcf1057c35812f6f15f`（2026-09-30）。策划 D17/D18 把「帝国战线」保留为陡峭的百关主线、「拓境远征」作为资源和军力成长线。代码此前把训练建筑升 T1/T2/T3/T4 与相应兵种研究只系在第 5/20/40/65 关；即使拓境区域已通也不能开启该层级。本批给同一动作增加**区域首胜或原主线胜场**的入口，不免费研究、不赠兵、不改变关卡胜场。

| 目标层级 | 保留的帝国战线入口 | 新增拓境入口 | 其它费用和限制 |
|---|---|---|---|
| T1 | 第5关 | 边疆铜脉哨站首胜 | 原营地升阶木石粮、兵种研究知识/战功/精魄与训练费 |
| T2 | 第20关 | 外域工造军镇首胜 | 同上 |
| T3 | 第40关 | 外域铸银城塞首胜 | 同上 |
| T4 | 第65关 | 外域铸金王都首胜 | 原升阶费；现有兵种树没有所有线的T4新兵 |

`CFG.unitTierDevelopment` 只记录对应关系，`S.development` 已是 v33 现存胜次。`unitTierProgressLock()` 被建筑升阶动作、兵种研究动作及其 UI 锁态共同调用，避免只改按钮不改动作。无新存档字段、版本迁移或既有胜次修改；旧主线胜档保持可升，历史已研究兵种仍保持。拓境胜次不能代替其它单笔资源费、研究前置、营地建成、兵种精魄和真实训练，所以这不是“零主线胜场必达高阶兵种”的证明。

本批 `tests/progression/development_tier_gate_p397.js` 在无第5关胜场、已有合法铜点胜次的状态下，真实调用 `buildTierUpgradeAct()`、完工 `tick()`、`upgradeUnit()`、`train()`、`processQueue()`、保存与重载；还覆盖四档锁态、旧第5关胜档和非法胜次。它与既有 `development_border_v32.js` 的真实边疆战斗结算测试相接：后者证明胜场由实际战斗写入。真实 Edge 的 `development_border_browser.js` 又在四个区域真实异步首胜并重载后，以零主线胜场读出 T1–T4 门均解锁；浏览器军队与研究输入属于测试准备，不代表自然新档走完这四区。

验证（Windows PowerShell / Node v24.19.0）：新增层级门 3/3，`combat_guards.js` 13/13，`root_unlock_gate_p365.js` 20/20，`development_border_v32.js` 10/10，`development_outer_v32.js` 13/13，`tier_refund_safety_p378.js` 6/6，`military_metals.js` 23/23，`steam_military.js` 4/4，`campaign_stage_gate_p369.js` 5/5，`node tests/ie001/run.js` 96/96，全部退出0。`node tests/progression/development_border_browser.js` 真实 Edge 52/52、进程退出0、无页面异常；其测试专用临时 profile 清理报 `EPERM`，清理不列为通过。`node --check` 对三份运行脚本、`git diff --check` 均退出0。未运行 Android WebView。

本批只改配置、共用门函数、测试与发布缓存 V31→V32。回退这一个改动集会恢复主线独占的 T1–T4 门；若已有人从拓境路径研究了兵种或升阶，旧代码对存量进度的处理须单独核对，不能承诺直接回退旧版无损。功能关闭也不得删除既有 `S.development`、兵种或建筑数据。
