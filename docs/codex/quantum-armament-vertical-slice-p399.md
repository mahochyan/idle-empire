# P399｜星界圣痕兵装：逐兵种 ATK／HP 付费切片

基线：2026-09-30，`master` / `eff25820391efccbd881d1a11d66091d2f3c3c5b`。仅改 `config.js`、`math.js`、`ui.js` 与专项测试；`technology.js`、战斗美术、`index.html`、策划正文由其他工作负责。此报告不把当前未提交的 UI、美术、区域补给工作算作本切片结果。

## 文档目标、源证据与本次决定

[P398 源效果审计](singularity-entry-audit-p398.md)核对：母本 450224（知识 50 亿、勋章 500 万）在科技已研究后出现 `quantum(armyID)` 逐兵种入口；`QuantumListHP/ATK` 参与真实攻击／生命调整。其前置 450124 是知识 40 亿、勋章 400 万的研究，但当前可见旧日远征回调实由 450123 打开，450124 没有可核实动作效果。450125／450225 的所见副本回调尚未落地。本次只实现可付费、可投入、在战斗内生效的 450224 风格纵切：我方玩家名「星界圣痕兵装」，前置 `sci_quantum_age`，科技费用按源 450224 保留 50 亿知识／500 万勋章。**它直接接量子时代，暂不收 450124 的另 40 亿／400 万，也不声称复刻源六节点累计费用。**这是不加空研究 flag 的有意改编；旧日远征真正的战斗、奖励与对应成本仍需另行成套设计。

升级状态 `S.quantumArmament[兵种].atk/hp` 对当前已有的九种时代兵逐一独立记录；满级各 10。每级攻击或单兵生命另加相应基础属性 5%；下一等级投入钢 `8000×等级` 与星辉原石 `10×等级`。这组每级比例与材料费是**我方聚合兵团口径候选值**，不是母本的精确量子公式。新研究及所属兵种时代研究都须完成，动作函数再次检查；未解锁的兵种升级在科技页隐藏。钢与星辉原石分别从 `S.res` 与 `S.items` 扣除并保存，保存失败会回滚。研究、攻击级、生命级是三笔独立付费；按钮或控制台重复点击不能免费升阶。攻击进入 `weaponAttack → battleMilitaryAttack`，生命进入 `battleVitals`，远征 `initBattleState` 与驻军 `buildGarrisonUnitsFromForm` 因而读同一加成；敌军按 `owned=false` 不获益，战后兵力仍按原人数回写，不创建士兵或永久护盾。

## 付款、实战与自然路线的边界

[可复跑实战探针](../../tools/verify/probe-quantum-armament-battle-p399.js)从已付 P397 第100关 v33 原档开始，原文 SHA-256 `ba8602a98d0d927c96cabb2d2074807c9b0ec46183aae4534e5486055c6125c4`。自然状态知识 1,727,566、仓容 **3,017,311,895**、勋章 1,440,726；真实 `researchScience('sci_astral_armament')` 拒绝，资源与科技列表未动。它现在**无法在这份原档直接付款**：即使集满当前知识仓，也比单笔 50 亿少 1,982,688,105 容量，勋章少 3,559,274。独立 [P399 仓容路线](singularity-capacity-route-p399.md)已从同档实付知识仓研第1级，给出其余仓研、图纸和勋章的缺口，不等于全程已付。

为核对战斗代码，探针在隔离 VM 内将该档条件设为知识仓研 5 级、图纸已用 158（比源档多 25）、知识 50 亿与勋章 500 万；条件仓容 **5,011,586,710**。这些额外仓研、图纸和资金是**注入夹具，没有通过获取／研究动作实付**。在此明确夹具下，真实 `researchScience` 一次扣尽 50 亿知识与 500 万勋章；真实 `upgradeQuantumArmament` 分别购买星际先遣兵攻击、生命 1 级，合计扣钢 16,000、星辉原石 20；保存重载仍为两项 1 级。随后真实进入第100关，用固定随机流跑完异步回调：49 次回调、4 回合、胜利，敌军余血 0。该 7 人星际先遣兵团入场攻击由 **513.12→517.12**，生命由 **62.384→65.184**；两个星兵团战后都阵亡，故这个样本只能证明属性进入了实战，**不能证明胜率、战损或后期收支改善**。[P399 战斗数据](reports/data/p399-quantum-armament-battle.json)保留自然状态、注入条件、扣费、入场属性与结果。

## 存档与验证

主键仍为 `rts_save`，格式由 v33 升 v34。新档有九种兵的零值默认映射；`serializeSave`、`applySaveToS`、`migrateSave`、`validateSave` 均覆盖此字段。v33 原文先写 `rts_save_premigration`，候选迁移成功后才写主档；专项对原档资源、兵池、编队、科技、关卡、道具、旧兵装和拓境进度逐项比较，无变化。缺项、未知兵种、负数、非整数、超 10 级、已投资却缺前置研究的 v34 档会被保护而不自动覆盖；合法 0 保留。旧 v33 代码面对 v34 属未来版本，代码回退前须先导出、核对和规划存档恢复，不能只替换脚本宣称兼容。

Windows PowerShell / Node v24.19.0：`node tests/progression/quantum_armament_p399.js` **5/5、退出0**；`node tests/ie001/run.js` 更新 v34 预期后 **96/96、退出0**；`node tools/verify/probe-quantum-armament-battle-p399.js` **退出0**；`node --check config.js`、`node --check math.js`、`node --check ui.js` 与 `git diff --check -- config.js math.js ui.js tests/ie001/run.js` 均退出0。真实 Edge/CDP `node tests/progression/quantum_armament_browser_p399.js` **9/9、退出0**：新档隐藏、v33 原文迁移、条件夹具按钮付款和保存、320／360px 无横向溢出；未捕获异常和 `console.error` 都为零，独立临时 profile 清理未报错。浏览器夹具仍不证明 5b 自然可达；实体 Android WebView、50 小时成长曲线与终局区域未验收。
