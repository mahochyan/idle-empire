# P361｜「未解锁直接隐藏」科技与兵种界面只读复查

日期：2026-09-29。用户在「科技和兵种排版做一下优化」后明确要求「未解锁的直接隐藏」。本批只读现行 `ui.js`、`technology.js`、`visual.css` 与动作层，运行已有隔离浏览器和动作检查；另一个任务正在并行修改 UI，本批不写玩家代码、美术、总策划或他人测试。

## 结论与复现

| 界面 | 现行行为 | 对要求的判断 |
|---|---|---|
| 军队→训练军队 | [rBarracks](../../ui.js) 用 `trainLockReason` 找最新可用 tier，且遇到未研究、兵坊未建、Boss 未过或整线无已解锁兵种时 `continue`，不生成分支卡。条件成立后显示该线最新 tier 的已解锁兵种和训练按钮。 | **已满足训练列表的隐藏要求。** 浏览器新档青铜／铁兵分支与卡片均不存在；仅作展示验证的研究＋兵坊条件注入后两者出现，保留金属和粮食费用。 |
| 科技→页面首屏 | [rTech](../../ui.js) 的「接近解锁」列出前置已满足但尚未付费的研究。360px 全新档截图中「探矿术 0%」直接可见，虽然研究未完成、科技点为 0。 | 若「未解锁」按所有未研究项目直译，**未满足**；但完全隐藏可研究入口会妨碍玩家推进，应明确保留“当前可研究/下一项”这一例外。 |
| 科技→完整图谱→科研／兵种 | [rTechFull](../../ui.js) 对全部生效长科技逐项生成 `.tech-science-row`，只跳过不适用模式／历史科技，不以未完成前置过滤；兵种图谱 `renderUnitTreeNode` 递归生成所有后继 `.tech-unit-node`，不以 `S.upgradedUnits` 为显示过滤。新档青铜时代、铁器时代行在浏览器 DOM 中存在且按钮禁用。完整图谱初始为关闭的 `<details>`，玩家点击后可见这些「待前置／条件未达」节点。 | **深层未解锁科技和兵种仍可见，未满足“直接隐藏”。** 折叠只减少初屏占用，不等于过滤节点。 |

页面脚本顺序由 `index.html:1667` 确认为 `config → levels → sprites → math → garrison → technology → ui`；[technology.js](../../technology.js) 也定义 `rTech()`，但后加载的 `ui.js` 同名函数覆盖它，当前页面实际使用 `ui.js` 的 `rTech()`／`rTechFull()`，不能依据旧函数判断最终显示。

动作层仍防绕过：隔离新档调用真实 `researchScience('sci_quantum_age')` 返回 `science-prerequisite`，`buildAct('bronze_workshop')` 返回 `need-science`，`train('bronze_guard',1)` 返回 `locked`；研究数、胜场仍为 0，且这些拒绝没有写出主档。视觉隐藏不应代替这些动作检查。对旧兵种 T1/T2/T3，`upgradeUnit()` 仍调用 `checkTierLevel()`；[P357](era-dependency-audit-p357.md)有当前科技与兵种付费依赖的独立证据。

## 浏览器、布局与既有测试失配

`node tests/progression/military_browser.js` 在真实 Edge 独立 profile 退出 0，29/29 检查通过：360px 新档青铜／铁科技行的 DOM、费用和禁用态存在；360px 未研究／未建兵坊的训练线不存在，条件注入后训练卡出现；320px 已解锁训练卡及 360/400px 科技／建筑／训练页没有横向溢出，未见未捕获异常。该用例的研究和兵坊是**展示用注入**，不证明自然成长或真实付款；截图和 profile 仅写系统临时目录，本批未写共享 UI 文件。

`node tests/progression/era_chain_browser.js` 在同一工作区退出 **1**：424 检查通过、78 失败。多项真实点击研究和持久化检查仍通过，但**整个用例不得标为通过**。代表性失败有：测试 `scienceRow()` 取 `strong.parentElement.parentElement`，现行 `.tech-science-row` 的费用／前置在标题头外，故“城镇化前置在该子节点文本中”断言失败；测试 `buildingRow()` 用 `button.closest('.card')`，现行建筑外壳是 `<article class="build-entry">`，所以即便按钮存在也报 `exists:false`。`git show HEAD:ui.js` 与 `git show HEAD:tests/progression/era_chain_browser.js` 证实这两组结构／选择器在当前提交 `f85e1c8` 中已并存，属于**提交基线源码中就可静态推出的测试契约不符**；本批没有隔离运行 HEAD 浏览器，因此不把 78 项全部判定为基线失败，其余失败在并行 UI 修改期间的归因未定。不要为得到绿色结果删除断言；后续应另立测试维护任务按现行 DOM 语义更新选择器，再重跑比较。

当前移动端检查只覆盖上述 320/360/400px 视口的横向溢出与训练卡展示，不能等同所有设备的视觉验收。科技完整图谱的默认折叠与分类切换是源码/DOM 复查；本批未逐设备人工检查其展开后的长列表阅读体验。

## 最小下一步与边界

先把“隐藏”的范围落实为可操作规则：保留当前可研究和紧接的下一项提示，完整图谱只生成已研究科技及至多一层前置已满足的研究；兵种图谱只生成已拥有根线、已研究节点和其可研究的直接后继。其余深层未解锁节点从 DOM 中省略，研究／建造／训练动作的原有校验保持。落地前需确定用户是否也希望「接近解锁」里的当前待筹科技完全不显示；本批不代替并行 UI 任务实施。

工作区 `master`，基线与本批结束 HEAD 均 `f85e1c8624de8c9e17f7724373e65899d1085cdf`。已读 `AGENTS.md`、`CLAUDE.md`；参考提交 `98571e38801f71bfdbb982a626e0e58f510abb98` 实际 Git 日期是 2026-05-17T03:10:16+09:00，与 AGENTS 中 2026-09-18 不一致，没有回退。起止 `ui.js` SHA-256 均 `aea50c74f4a73bd459e035eaffaa8cde4446dd771692f3aabba2f53dcfe812f2`；`technology.js` 为 `9cfda541f49011a676674fb2740b12af63812542a1ce872dcafc57eb4330bf98`；`visual.css` 为 `f7642d67fb72ea9e8f097435213865370c0ce55cd292a3d1a01c086162beef35`。并行改动较多，报告对准这些哈希对应的瞬时快照。

实际命令及退出码：`git status --short`、`git branch --show-current`、`git rev-parse HEAD`、`Get-FileHash`、`git show HEAD:ui.js`、`git show HEAD:tests/progression/era_chain_browser.js`、隔离新档 `node -e` 动作探针均为 0；上述两个 Edge 用例分别为 0 和 1。一次临时 `node -e` 因 PowerShell 字符串转义写错而退出 1，改用字符码构造引号的同一只读探针后退出 0，不是游戏动作失败。本批未改变 `rts_save` 结构与用户浏览器存档，隔离测试各自使用临时 profile；撤回仅需移除本报告，保留他人未提交改动，不建分支、不推送。
