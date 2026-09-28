# P128：工坊分段成本接入与仓容路线复核

日期：2026-09-25。范围限于策划文档 A1 的建筑升级费用公式及开发侧可达探针；不调整资源基数、仓容配置、奖励、UI、美术或存档字段。

## 依据与实现

母本 `addWorkShopLv` 的函数原文由 `node tools/verify/era_workshop_cost.js` 从 `210(1)_unpacked/_analysis/deob_main.js` 锚点 1,485,372 只读抽取。按当前等级 `L`：

- `L < 10`：`Need + L × Need/3`
- `10 ≤ L < 20`：`Need + 9 × Need/3 + (L−9) × Need/3 × 5`
- `20 ≤ L < 30`、`30 ≤ L < 40`、`40 ≤ L < 100`：沿同一分段式，末项斜率依次为 10、20、40。
- 母本实体 260015“蒸汽工厂”把分母改为 5。当前我方没有该生产设施映射；配置留有 `upCostDivisor` 单体覆盖位，通用值为 3。

`config.js` 增加曲线参数，`math.js:upCost` 将非仓储建筑从 `upCostLv^lv` 切到该公式，不再对工坊公式结果向上取整。仓库对齐费用、带 `storageCostStep` 的仓储费用、未分段旧仓线性费用及线性建造时间维持原路径。真实 `buildAct` 仍按费用扣款一次；没有存档字段或迁移变化，失败写档仍完整回滚。

当前实现把我方 `bldSt(key).lv` 直接映射为母本 `L`，并用 `upBase` 承接 `Need`；这两项都尚未逐建筑完成映射审计。当前接入是成本曲线骨干的一段实现，不代表各建筑基数、等级起点、所有时代的费用可达性或成长体验已定稿。

## 路线影响

新的费用使旧的零战斗到蒸汽路线在学院升级处遇到单笔费用高于仓容。探针现通过真实仓库、石仓和粮仓升级扩大容量，再调用原有建造动作，不注入资源或胜利。`node tools/verify/probe-next-era.js` 通过；`node tools/verify/probe-steam-era.js` 通过，结果为：

- 437,921 模拟在线秒（约 121.6 小时）训练首名蒸汽装甲兵。
- 26 人、普通关卡胜利 0、建筑动作 322 次；蒸汽时代研究前知识容量 101,400、钢容量 10,125。
- 旧费用路线记录的 193,554 秒不再代表当前成本。新旧数字只用于揭示成本—仓容联动，不是同一玩家策略的四路对照，也不是50小时体验验收。

仓容扩建把当前单路线变慢的原因变得可见；下一轮仍需在同档经济、科研、军事和短时路线中联合推演产能、仓容、费用、战斗回补与操作量。此报告不据单一路线调整任何 `upBase` 或上限。

## 验证

- `node tools/verify/era_workshop_cost.js`：退出 0；确认分段原文与 `/3`、`/5` 特例。
- `node tests/progression/workshop_cost_curve.js`：5/5；含四个斜率拐点、建筑级 `/5` 覆盖、仓储隔离、真实扣款和写档失败回滚。
- `node tests/progression/repertory_cost_curve.js`：3/3；`basic_storage.js`：9/9；`storage_branches.js`：8/8；`metal_chain.js`：27/27。
- `node tests/progression/gold_era.js`：6/6；`silver_era.js`：7/7；`population.js`：19/19；`node tests/ie001/run.js`：96/96。
- 当前工作区非浏览器 `tests/progression/*.js` 批跑：53/54 个脚本退出 0。唯一失败为 `alloy_gear.js` 的 `calcGarrisonDmg` 装备伤害大小断言；本批未修改驻军伤害、合金装备或该断言，且没有在干净 HEAD 上复现，因此记录为当前工作区未归因失败，不计通过。
- UI、浏览器及 Android WebView 本批未运行；用户另有 UI 美化工作，本批未修改 `index.html`、`ui.js`、`visual.css`、`sprites.js` 或图像资产。

## 基线、兼容与回退

分支 `master`；基线和完成时 HEAD 均为 `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。在已有大量未提交改动与未跟踪文件的工作区上做最小修改；没有 reset、提交、推送或部署。存档键 `rts_save`、版本和字段语义未变，逆向费用不要求迁移。回退时只撤 `workshopCostCurve`、`workshopUpgradeCost`/`upCost` 非仓储分支、对应测试期望与 P128 开发探针/文档增量；保留共享工作区的其余 UI、玩法、存档和未提交内容。
