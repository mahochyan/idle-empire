# P284 第6阶纳米甲10级实付接力

## 文档目标、代码现状、本次决定

《策划文档》把100关设为全科技后的陡峭主线，圣域试炼属于《放置时代》式发展副本。P283已接入守卫防御被动并以纳米甲首级从第4阶窄胜至第5阶，但P279的第5阶155名星际兵档仍在第6阶11种子全败。本批只验证现有装备和材料来源能否**真实支付**到一个第6阶胜例；不改玩家战斗公式、敌人数值、收益、UI或美术，不把隔离条件试验称为实付进度。

源档为[P279第5阶155兵安全档](reports/data/p279-awakening-star155-paid-save.json)，SHA-256 `5624c6aff153cb687b1e5d2a3b58402e5d34c69a2152c6a6a636e8c38f07e79b`。当时671总兵、626出战、155星际兵，战术演算机警戒3400、高能核心33、异果130、纳米甲未研发。《放置时代》源码中的星际兵升阶另需将魂石；`armyLvUP`首阶需10次各100石升星和1000石升阶，来源「异域将魂」研究线450122→450222→450322，三笔科技知识800万／1000万／2000万及勋章10万／20万／30万。它不是目前已有的免费属性。本批未虚构将魂石产出或抢先接入这条远期支线。

## 条件筛选与实付链

从同一源档在隔离VM临时置装备等级的第6阶11种子筛选中，基线、纳米甲1/2/4级各0胜；10级1胜，20级1胜，40级2胜；能源甲与纳米甲各10级3胜，攻防兵装各100星7胜。这些等级注入**未付款**，只用于选后续实付路线。[第6阶条件数据](reports/data/p284-awakening-stage6-growth-sensitivity.json)给出每种子的敌余HP和兵数。六种合法阵型在当前规则下原档共66场0胜，纳米甲首级条件档再测66场仍0胜，见[原档阵型](reports/data/p284-awakening-star155-formation.json)与[纳米首级阵型](reports/data/p284-awakening-star155-formation-nano1.json)。

现行纳米甲从0→10级需20、12、14、16、18、20、22、24、26、28次锻造，共200次、800高能核心。原档不补兵连打战术演算机只得4胜，核心33→201，第5场警戒3800战败；[原始连战](reports/data/p284-awakening-core-stage5-20-no-replenish-20-pressure.json)不能当刷料闭环。再以同一满编、不同警戒值做**不支付前置胜场和补兵**的边界筛选：警戒4900下原装备及条件纳米甲1/4级均0/11，纳米甲9级仅1/11；警戒5000四组均0/11。分别见[原装备](reports/data/p284-awakening-core-alert-cap.json)、[纳米1级](reports/data/p284-awakening-core-alert-cap-nano1.json)、[纳米4级](reports/data/p284-awakening-core-alert-cap-nano4.json)、[纳米9级](reports/data/p284-awakening-core-alert-cap-nano9.json)。条件结果指出要在最后一场前先锻到9级，但本身不证明材料可达。

随后从原始实付档在隔离存档里连续调用真实战斗、结算、生产、训练、编队、兑换、研究及锻造动作。为给出**存在性见证**，前15场分别从固定种子4开始，第16场从固定种子1开始；每场前显式重置随机流，属于挑选有利战果的复现条件，不是自然连续随机流、玩家胜率或平均耗时。每战伤亡后清空远征编队、以原本预备池加真实训练补足缺口，再用编队动作恢复同一626人阵型，所有资源在训练完成时按原函数扣除。16战共补训支付钢5972000、铁5916000、铜5916000、粮840000；食物监测最低307916.57，未断粮。铜/铁/钢逐批生产，依赖石、煤、铁前置库存；累计30086**模拟在线秒**，其中训练849秒，其余为相应资源生产和知识生产，不能直接解读为典型玩家时长。

第15胜后警戒4900、核心789。骨片批量兑换269份实扣兽骨18292、获勋章36584，生产知识并支付知识350万／勋章10万研发纳米甲；172次真实锻造付688核心至9级，余101核心。第16场在警戒4900、纳米甲9级、种子1赢得58核心，警戒升5000；补回战损后再以28次真实锻造付112核心至10级，余47核心。最终671总兵、626出战、155星际兵、第5阶、异果130，实付档重载一致。[纳米甲10级安全档](reports/data/p284-awakening-stage5-nano10-paid-save.json) SHA-256 `509c448cc729602113d181ef2d05c529f7dbfb662b9147add89cd3e125d0be6d`；逐场敌阵、伤亡、补训和资源账见[实付账本](reports/data/p284-awakening-stage5-nano10-paid.json)。原始P279档哈希重验未变，独立重复脚本两次产出同一SHA。

从这份**已付款**安全档重载，11固定种子都由`openAwakeningTrial('easy')`预付105异果并走异步战斗、真实结算；只有种子8胜，敌HP归零，升至第6阶7星，异果25、517总兵／472出战、155星际兵。其余10败，敌余最多39125 HP。[逐种子结果](reports/data/p284-awakening-nano10-stage6-paid-pressure.json)及[种子8可重载胜档](reports/data/p284-awakening-101star-nano10-paid-seed8-terminal-terminal-save.json) SHA-256 `0f449c31bc9d088b0aa18637848bb70a3aa988760f2f0e8328524db77de26bce`可复核。第6阶因此从“当前已付款档全败”推进为“一条可付款的窄胜路线”，并未成为平顺曲线；第7–20阶、完整第100关与50小时多策略仍未验收。

## 验证、兼容和回退

本地`master`，基线/最终HEAD均为`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。参考快照`98571e38801f71bfdbb982a626e0e58f510abb98`实际提交日2026-05-17 +09，与AGENTS记载的2026-09-18不符；未回退。保留已有未提交改动与并行UI美化。根目录列举的运营背景文件不在根目录；`运营优化/`的同名文件不当成代码现状。本批使用PowerShell、Node v24.19.0。

实际命令均在仓库根目录运行：`node tools/verify/probe-awakening-stage6-growth-sensitivity-p284.js`退出0；`node tools/verify/probe-awakening-core-farm-p277.js --input=p279-awakening-star155-paid-save.json --label=stage5-20-no-replenish --output-prefix=p284 --count=20`退出0（报告含第5场败局，不是20胜）；`node tools/verify/probe-awakening-core-alert-cap-p284.js`及分别加`--nano-level=1`、`=4`、`=9`四次退出0；`node tools/verify/probe-awakening-star155-formation-p279.js --batch=p284`及加`--nano-level=1`两次退出0。`node tools/verify/probe-awakening-nano10-paid-p284.js`修正开发探针中的补料先后顺序、付款记录后连续两次退出0且SHA相同；之前两次退出1是探针训练卡料与记账断言错误，不计为玩家玩法失败。`node tools/verify/probe-awakening-nano10-stage6-paid-p284.js`退出0；种子8另以`node tools/verify/probe-awakening-101star-pressure-p276.js --input=p284-awakening-stage5-nano10-paid-save.json --label=nano10-paid-seed8-terminal --output-prefix=p284 --seed=8 --max-steps=1 --expect-last=win --expect-level=6 --expect-enemy-hp=0 --save-terminal`退出0。

六份本批新增/改动开发脚本的`node --check`均退出0；`node tests/progression/awakening_trial.js`8/8、`awakening_guard_passives.js`5/5、`energy_nano_armor.js`6/6、`weapon_forge.js`5/5均退出0；`node tests/ie001/run.js`退出0（96/96）；真实Edge `node tests/progression/nuclear_browser.js`退出0（17/17）。本批无玩家代码/UI变更，实体Android WebView未验证。

`rts_save`仍为v32，本批新增的JSON是开发隔离存档，未写用户浏览器存档；没有新字段、迁移、奖励或关卡改价。已知风险是第16场和第6阶各仅有少数固定流胜例，补兵成本高、战术演算机警戒已到5000，不能把高警戒核心再刷视为现有军备的稳定长期来源。回退本批仅移除P284探针/数据/报告及策划、进度文档的P284新增段落；保留P279源档、P283守卫规则、用户存档及并行UI文件。
