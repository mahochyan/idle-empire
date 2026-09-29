# 兵营历史库存与兵种研究动作门（P381）

2026-09-29；`master`，基线 `f85e1c8624de8c9e17f7724373e65899d1085cdf`。在“未解锁直接隐藏”规则下，旧档已有的青铜兵若缺当前科技前置，军营会把整条线隐藏，玩家无法查看库存或从后备遣散；同线已拥有较高阶兵时仍可训练的低阶兵也被藏起。军营“可研究”角标只看费用，未验主线、Boss、已建成营地和阶位，实际研究可能被拒。进一步检查发现 `upgradeUnit()` 本身也缺训练建筑完工、科技和Boss守卫。

军营现在保留历史实际持有、编队和队列中的兵种卡，允许从后备遣散锁住的历史兵；远征和驻军中的兵仍须先撤下。新档未拥有的深层兵种继续隐藏；可训练的低阶兵与已研究高阶兵可以同时显示。角标和完整科技图谱按动作门显示，`upgradeUnit()` 在扣费与写档前校验科技、Boss、训练建筑已完工及目标阶位，旧档已研究记录仍直接返回，不追缴或重置。

[真实函数专项](../../tests/progression/barracks_visibility_gate_p381.js)在修复前 1/5、扩充夹具后 6/7，现 7/7通过；[真实Edge 320px专项](../../tests/progression/barracks_visibility_browser_p381.js)在保存重载、DOM遣散、历史兵显示和科技动作链上通过15/15。另复测原 `unlocked_only_browser_p362.js` 104/104、`military_browser.js` 31/31，`root_unlock_gate_p365.js` 20/20、`combat_guards.js` 13/13、`tier_refund_safety_p378.js` 6/6。拒绝研究的 toast 曾临时挤窄手机布局，已在 `index.html` 修复内联CSS优先级，Edge专项新增检查确保提示为 fixed、320px 页面不横向溢出。

没有新增 `rts_save` 字段。以上浏览器验证为 Windows Edge 模拟视口，未运行安卓实机；旧档已拥有记录保留，不改变研究和训练成本。回退只撤销本项 `ui.js`/`technology.js` 局部及新增测试，但会重新暴露已证实的假角标和历史库存隐藏问题。
