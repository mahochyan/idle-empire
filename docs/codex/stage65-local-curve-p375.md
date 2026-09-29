# 第65关局部人数曲线修复（P375）

2026-09-29；`master`，基线 `f85e1c8624de8c9e17f7724373e65899d1085cdf`。正式 `levels.js` 仅把第65关「神射营」的步兵、弓兵人数各从 `[1,1,1]` 改为 `[11,8,5]`，共6→48人；关卡名称、奖励、第64／66关和第100关均未改。现行人数相邻序列为42→48→52。此修复消除单关人数断崖，**不作为第65关已形成全科技门的证明**。

P368 与 P372 的原始实验和 JSON 保留其当时的身份：旧正式6敌、隔离候选48敌。更新后的两份探针把旧6敌仅注入隔离 VM 作历史对照；48敌不注入，直接取当前 `CFG.enemies[64]`。新输出另存 `p375-*`，未覆盖 `p368-*`／`p372-*` 文件；P368 原始 JSON 的 SHA-256 复核仍为 `a87f0f2b460e5d01a97b722bfd0e44d35b7d27c76f213be48a8f6211be95043d`。两份同源实付入口 SHA-256 与原实验一致：高科研档 `7838551aeab18d3706cde0e9f26564279af8558968d7579e66a6dead9e326cc9`，低科研档 `3807ece70ee164b57448c31a01ccf06af666b08274b81209fcbb87e9195826b3`。具体逐流结果见[高科研数据](reports/data/p375-stage65-hightech-comparison.json)与[低科研路线及战斗数据](reports/data/p375-lowtech-route.json)。

| 实付入口 | 历史6敌／现行48敌，第65关胜场 | 胜局战损中位数，历史／现行 | 现行48敌之后 |
| --- | ---: | ---: | --- |
| P368，34科技、80人出战，步兵营T3 | 32／32；32／32 | 1／2 | 32流均实付T4、补回80人、再胜66关 |
| P372，8科技、22人口、73人出战，步兵营T1 | 32／32；32／32 | 3／5 | 32流均实付补兵、再胜66关；该档没有直接支付T4 |

高科研入口从第64关已付档补兵、营地升阶后进入第65关，真实扣费与重载校验仍通过。低科研入口从 P206 已付第41关档走第42—64关，第49和59关各在32个固定流中选择一次胜流；这只证明一条合法路线存在，存在明确选择偏差，不能当玩家胜率。低科研档当前营地T1、仓上限木4800／石3200／粮3000，不足以直接付T3或T4，需另走仓储和建筑成长。两档战斗均使用真实回调、结算、补训和 `rts_save` 重载；32固定流只是可复现诊断。

新增 `tests/progression/campaign_stage65_curve_p375.js` 从实际加载的 `CFG` 和 `initBattleState()` 双重核第64／65／66关人数为42／48／52。变更不含玩家状态字段、存档迁移或 UI；旧存档的第64关后进度仍可读，进入第65关时使用新正式敌阵。余下风险是其他弱编队、玩家资源调度及更多随机流未覆盖；战斗 HP 会影响伤害，48敌的战损不能只由人数比例推算。百关终局难度与广泛科技门另行校准。

逻辑验证命令与退出码均为0：`node --check tools/verify/probe-stage65-paid-p368.js`、`node --check tools/verify/probe-stage65-lowtech-route-p372.js`、`node --check tests/progression/campaign_stage65_curve_p375.js`、`node tools/verify/probe-stage65-paid-p368.js`、`node tools/verify/probe-stage65-lowtech-route-p372.js`、`node tests/progression/campaign_stage65_curve_p375.js`、`node tests/progression/campaign_enemy_units.js`。真实 Edge 浏览器另执行 `node --check tests/progression/campaign_stage65_browser_p375.js`、`node tests/progression/campaign_stage65_browser_p375.js`（6/6）及现有 `node tests/progression/campaign_enemy_browser.js`（17/17），均退出0、无未捕获浏览器异常；新测试在360×800视口加载实际 `index.html`，检查脚本顺序、第64—66关预告与开战阵容、敌军卡片及逃离清理。它仅注入测试用通关条件和编队以进入战斗，不证明自然路线，也未保存截图。`git diff --check -- levels.js` 退出0，Git仅提示工作区换行将来可能转换。

未建分支、提交、推送或改部署；保留共享工作区其他代理改动。回退正式规则时将第65关两种敌军各恢复 `[1,1,1]`，并同步回退 P375 的正式邻接断言和探针当前／历史标签；P368/P372 冻结数据无需改写。
