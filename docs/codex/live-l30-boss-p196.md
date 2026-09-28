# P196：第30关正式敌阵旧档复查（2026-09-26）

当前工作区第30关「帝国元帅」敌阵为步／弓／骑三系各前中后排`[6,4,3]`、法师前中排`[6,4]`。[独立回归脚本](../../tools/verify/verify-live-l30-boss-p196.js)直接载入现行 `levels.js`，逐字段比较 [P192](current-l30-boss-sensitivity-p192.md)留存的旧第30关CFG：**该关除`units`外的名称、描述、Boss倍率、奖励、掉落及ID均相同**。新阵容增加的敌方人数同时影响HP和攻击出手量；脚本没有覆写CFG、修改玩家文件或使用旧探针源码。

来源为 [P190](reports/data/p190-current-third-chapter-second-back.json) 一份真实实付58人第30关战前 `rts_save`，以及 [P194](reports/data/p194-current-third-chapter-population-army.json) 两份22人口、7粮工、73人真实实付战前档。各档先核对原文SHA-256、1—29关通关记录和当前代码加载状态，再按 [P195](reports/data/p195-current-l30-followup.json) 的固定战斗随机流真实编队、异步回调、结算、保存重载；P190流1还与P192候选的战功、精魄和实收资源核对。P190／P192／P194历史输入中的旧`levels.js` SHA不作为当前代码门槛，只核对其原始JSON相互引用的哈希与完整旧档SHA。

| 旧战前档 | 固定流 | 当前真实配置战果 | 与隔离候选 |
| --- | --- | --- | --- |
| 58人第三前排 | 1—32 | **32／32胜**，战损8—42人 | 逐场胜负、回合、回调、分兵种战损、实收资源及重载状态相同 |
| 58人高损 | 19 | 胜／3回合／32回调／损42；木0／石6／粮2997.312实入账 | 与P195相同 |
| 22人口73人 | 1 | 胜／2回合／25回调／损13；木0／石6／粮2995.764实入账 | 与P195相同 |
| 22人口73人 | 15 | 胜／3回合／31回调／损27；木0／石6／粮2996.505实入账 | 与P195相同 |

这里是**3份完整旧战前档、34次固定流复战**，不是34名独立玩家或通关率估计。另直接载入P195保留的一份**改动前已胜第30关的完整旧档**：胜场、资源、精魄和军队状态不变，再保存和重载仍一致。仅改关卡敌阵没有增删存档字段，旧胜场无需重打；本批没有验证其它历史人口／军备档、败后经济重训或第31关实战。

`node --check tools/verify/verify-live-l30-boss-p196.js`、`node tools/verify/verify-live-l30-boss-p196.js`、`node tests/progression/campaign_enemy_units.js` 和 `node tests/progression/combat_async.js` 均退出0；异步战斗测试5／0。主代理还独立执行`node tests/progression/campaign_enemy_browser.js`，退出0，13／13通过。开发侧复战采用模拟DOM、localStorage和定时回调；浏览器冒烟不等于Android或长期挂机验证。P197另验高战损胜后第31关补兵和战斗，不由本批34次复战推断。当前分支`master`，HEAD`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；旧证据所用`levels.js` SHA-256为`f355720480b51dddafe1bb4c9c78281684125183611cb9afbf7869e8063989c5`，本批正式配置为`578b75b7934b31f2bf834e94606708901ac4215e3f6d27fcd375d5bb1bf56c61`。

本报告与回归脚本仅属开发侧新增文件。若撤回本次关底校准，只把`levels.js`第30关四系`units`恢复为原步／弓／骑各`[1,1,1]`、法师`[1,1]`，保留共享工作树其余改动和所有玩家存档；开发侧脚本与报告可单独移除。
