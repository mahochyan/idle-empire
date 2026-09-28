# P276 第5阶试炼的实付补兵与成长门槛复查

## 目标与结论

《策划文档》把100关定为全部核心科技后仍艰难的主线，把圣域等区域材料线作为《放置时代》式发展路线。P275首阶实付档在固定流中到第4阶时前排耗尽。本批从该档继续，只用当前代码的岗位、生产、训练、编队、锻造、战斗及保存动作判断第5阶门槛；没有改敌人数值、奖励、玩家存档或并行UI资产。

结论限定在一条1002人口、主线第99关、固定随机流和这些编队：前排空缺确实需要补兵，但**补满后第5阶简单试炼仍失败**。敌人进场43659 HP，完整587人出战仍在敌方剩7911 HP时全灭；额外实付能源甲1→2级后剩4555 HP，说明装备成长有作用，却不足以证明此档第5阶或20阶可达。没有据此下调守卫，也没有把试炼失败档作为可继续发展的检查点。

## 同源实付链

输入为[P275首阶实付档](reports/data/p275-awakening-source-paid-save.json)，SHA-256 `b93762778919200d62c76e70c1c88dee525e2f158d7d83927123b90675cdbe37`。先经真实移除/编入动作，把唯一星际兵退回后备并恢复原后排55猎人；[准备档](reports/data/p276-awakening-star-prepared-save.json)517人，现役516、星际后备1。随后沿P271现有逐秒产能、真实`train()`与`processQueue()`，补训100星际兵，实际扣铜/铁/钢各800000，3435模拟在线秒、最低粮401280；[实付终档](reports/data/p276-awakening-star-paid-save.json)总军617人、星际101人。P271探针仅增加可选输入/输出文件名和固定随机种子，默认入口保留。

将原四支前排恢复、101星际兵置中排，四支猎人留后排后，出战587人、后备30人。[中排档](reports/data/p276-awakening-star-midreserve-save.json)从首阶继续13场固定流，3次试炼胜至4阶；第13场后现役444人、星际101人、异果78。[第4阶败前安全档](reports/data/p276-awakening-101star-midreserve-safe-terminal-save.json)可重载。无补兵直接挑战第5阶会败；把101星际兵直接放到前排的另一配置更早在第4阶失败。这些只是单配置对照，不代表所有可行配兵。

从安全档把已损34电磁兵、54合金特种兵、55蒸汽装甲兵逐种补回：真实岗位生产与训练排队合计2330模拟在线秒，队列实扣铜382000、铁382000、钢387400、粮81000，最低粮329404.34；[完整补兵档](reports/data/p276-awakening-level4-replenished-save.json)恢复617总军、587出战、星际101，源档及重载校验通过。再刷一场缄默圣域得异果78→116且无损，支付第5阶费用95异果；实际简单守卫为43659 HP/攻14/防20/出手规模462。193次回调后全军灭、敌余7911 HP，阶数留4、异果剩21。单独从同一完整补兵档调用12次真实`forgeWeapon('energyArmor')`，消耗48神祇核心、能源甲升至2级；同样一场取果及试炼后仍败，敌余4555 HP。两组败局只存在隔离探针，安全检查点均保留。

直接补55合金兵和15铁枪兵的较轻补兵方案仅恢复到358出战，虽能再胜材料战，但第5阶同样全灭；因此轻补兵不能作为成长闭环。各方案的逐场记录和库存见[安全流](reports/data/p276-awakening-101star-midreserve-safe-pressure.json)、[完整补兵](reports/data/p276-awakening-full-replenish.json)、[第5阶原装备](reports/data/p276-awakening-101star-full-replenish-pressure.json)与[能源甲2级](reports/data/p276-awakening-101star-energy-armor-lv2-pressure.json)。数值均为我方战斗适配值，母本守卫特殊技能和缄默神技尚未实现，不称完整母本对齐。

## 验证、兼容与后续

本地`master`，基线/最终HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，保留所有未提交改动。Node v24.19.0、PowerShell；P276准备、补100星际、重编、第4阶安全流、完整补兵、两次第5阶压力脚本均退出0。把生产/战斗随机数固定后，同一七步链连续两次输出的七份存档/报告SHA-256逐份相同；完整补兵档SHA-256 `3ebea242ba3c3dc1d92e09a6f6d467ffc47553f96cffdcdb20c26c1d46ee5fe`。[真实觉醒测试](../../tests/progression/awakening_trial.js)8/8、`node tests/ie001/run.js`96/96，6个相关JS的`node --check`退出0。P276未改运行时、CFG或UI，故未把DOM模拟当真实浏览器复测；Android/WebView未运行。

`rts_save`仍v32，未新增字段，P275源档不被探针覆盖。失败试炼按现规则扣异果且不升阶；不能把隔离失败档当成玩家存档，也不能凭空退款。后续先从完整补兵安全档核验可支付的装备/兵装、更多合法编队及守卫技能对实际胜负的影响，再判断第5阶之后的资源净收支与20阶曲线。100关主线与圣域材料线继续分开验收；原创玩法后置。若要撤本批，仅移除P276开发探针/隔离数据/本报告和策划记录，并恢复P271探针可选参数改动；不回退玩家存档或并行美术工作。

本批实际执行的关键命令均退出0；战斗脚本的败局是预期观测值，专项断言阶数、胜负和敌方剩余HP：

```text
node tools/verify/prepare-awakening-star-replenish-p276.js
node tools/verify/probe-stage100-star-paid-p271.js --input=docs/codex/reports/data/p276-awakening-star-prepared-save.json --output-prefix=p276-awakening-star-paid
node tools/verify/reform-awakening-star-reserve-p276.js
node tools/verify/probe-awakening-101star-pressure-p276.js --input=p276-awakening-star-midreserve-save.json --label=midreserve-safe --max-steps=13 --save-terminal --expect-last=win --expect-level=4
node tools/verify/probe-awakening-full-replenish-p276.js
node tools/verify/probe-awakening-101star-pressure-p276.js --input=p276-awakening-level4-replenished-save.json --label=full-replenish --max-steps=2 --expect-last=lose --expect-level=4 --expect-enemy-hp=7911
node tools/verify/probe-awakening-101star-pressure-p276.js --input=p276-awakening-level4-replenished-save.json --label=energy-armor-lv2 --forge=energyArmor --max-steps=2 --expect-last=lose --expect-level=4 --expect-enemy-hp=4555
node tests/progression/awakening_trial.js
node tests/ie001/run.js
```
