# P205：猎风弩骑“远程射击＋暴击10%”语义审计（2026-09-26）

**历史缺陷基线：**本报告记录修复前的真实函数行为；现行正式能力及同档实战结果见[P208](live-cavalry-formal-p208.md)。以下“当前”均指P205执行时点。

**结论：按现有兵种配置文字作为设计契约，战斗实现缺了两项能力。** `config.js` 把猎风弩骑设为前排骑兵、`tag:'wind'`，并写“远程射击+暴击10%”；`math.js:3147` 的 `isRanged()` 仅把基础弓兵／法师算作远程，`math.js:3209` 的暴击只识别 `tag:'spear'` 和法师次元打击。`garrison.js:399`／`:404` 共用射程判断，`:417` 的暴击也只识别长矛标签。箭矢特效（`math.js:3244`）不会改变目标或伤害。若策划本意是近战、无暴击，才应同步改配置文案；当前文案和弩骑命名更支持补足实现，但本批不改游戏代码或策划。

[P205 探针](../../tools/verify/audit-live-cavalry-semantics-p205.js)从[P201 原始数据](reports/data/p201-live-cavalry-third-chapter.json)直接读取、校验两份已实付的第29关73人战前完整 `rts_save`，固定流1／15 的 SHA-256 分别为 `ecec78193a69954510eaac3827bb9b5e2b8323691e9f08dbadb3571086f43e5f`／`4cac51b4725c1efdea6b87017d09f38c0acef560ec1058e840b6ee95a8f9984a`。另读取固定流15过第30关后的真实终档（SHA-256 `0c650fab752698ac264987fcc64c11d0b010ac4901b6c3c0f2448c6e8584a0f1`），只为重新打开第30关检查战斗单位，不把这份战损后档当作原第30关满编战前档。现行 `levels.js` 整文件已与 P201 时不同，脚本核对了实际检查的第29／30关敌阵字段仍与 P201 一致；`config.js`、`math.js`、`garrison.js`、`technology.js` 及测试载入器的源码 SHA 与 P201 基线一致。

三份存档均通过真实 `loadSaveAndApply()`、`selEnemy()`、`openBattle()` 初始化 `B.ourUnits`／`B.enemyUnits`，使用实际猎风弩骑、游侠与有前后排的敌军。随机值固定为 `0.99` 时，真实 `getTarget()` 和 `getGarrisonTarget()` 都让猎风弩骑只打**前排**、游侠可选到**后排**。这证明了当前可达目标差异；正常远程规则仍有 60% 前线阻挡，补上射程也不意味着必打后排。随机值固定为 `0`（若有10%暴击必触发）时，同一个猎风战斗实例调用真实 `calcDmg()` 得 `crit:false`，驻军 `calcGarrisonDmg()` 传给真实 `finalizeCombatDamage()` 的暴击参数也为 `false`。把仅作对照的同一临时攻击实例 `tag` 改为 `spear`，两条暴击路径都得到 `true`，说明探针确实到达暴击分支。第29关两流与第30关战损后档结果一致；具体伤害和调用证据见[原始 JSON](reports/data/p205-live-cavalry-semantics.json)。此对照只改 VM 中的战斗临时对象，不改变 `S`、配置或存档；主 `rts_save` 原文在检查后保持逐字一致。

需要同时处理的影响面不止第29关远征：远征 `getTarget()`／`calcDmg()` 和驻军 `getGarrisonTarget()`／`calcGarrisonDmg()` 各有射程及暴击路径。`isRanged()` 还影响进攻骑兵时的闪避判定、双刃刺客对远程的增伤、驻军箭塔优先目标与兵种排位提示；若直接把猎风判为远程，这些关系也会变化。本批只验证目标与伤害帮助函数的现行语义，没有跑完整驻军入侵，也没有推断修正后第29关胜率或把 P201 的败局归因于单项能力。后续应在相同已实付战前档中隔离比较完整战斗，核对远征／驻军两条路径，再决定正式实现及数值。

验证：`node --check tools/verify/audit-live-cavalry-semantics-p205.js`、`node tools/verify/audit-live-cavalry-semantics-p205.js` 初跑与复跑均退出 0。模拟 DOM／定时器只用于载入并打开真实战斗，不能代替浏览器或 Android 实测。分支 `master`，基线／结束 HEAD 为 `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。本批仅新增 P205 探针、JSON 与报告，未改运行文件、UI、美术、策划或存档结构；回退仅移除这三份开发侧文件，保留共享工作树的其它未提交改动。
