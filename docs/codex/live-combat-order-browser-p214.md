# P214｜同速排序修正后的真实 Edge／Node 战斗复核

结论：在当前 `sortCombatUnitsBySpeed()` 实现及 P201 两份实付第 29 关战前档中，固定流 1、15 的真实 Edge HD2D 启用、Edge 视觉回退和 Node VM 三条路径，初始兵团、随机调用次数与前 32 次值／调用点、首回合行动、胜败、回合、战损、奖励，以及仅去除 `ts` 的**完整战后存档均逐项一致**。真实驻军页从按钮触发入侵并逐秒推进的战斗也复现了同速兵团洗牌，Edge 与 Node 的排序、随机流、首个行动者、战损和结算状态一致。驻军存档有两处本地化时间字符串差异，详见下文。

## 输入与真实页面动作

工作区 `master`，HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。本批只读审查的核心源码 SHA-256：`math.js` `6335736ad922dd51b9f231e28cc286215074add83c74e0cc5b067baf3f449695`、`garrison.js` `c3793840886aac466dd25ede4ffd407adf726b618dee81d13f1c6c0f8970b167`、`hd2d.js` `19ad4ce60deb9dbb270cc28212201238593606872d570a476124011870252636`。真实 `index.html` 以本地 HTTP 打开，加载 Three、VFX profile、HD2D 与正式 `config → levels → sprites → math → garrison → technology → ui` 顺序。独立临时 profile 的 headless Edge UA 为 `Edg/153.0.0.0`；辅助 Node 为 `v24.19.0`／V8 `13.6.233.17-node.51`。

输入是 P201 `t2SecondBack73` 的来源流 1、15 两份真实 73 人第 29 关战前完整档，SHA-256 为 `ecec78193a69954510eaac3827bb9b5e2b8323691e9f08dbadb3571086f43e5f`、`4cac51b4725c1efdea6b87017d09f38c0acef560ec1058e840b6ee95a8f9984a`。页面从原档加载，实际点击战斗页和编队弹窗形成共同前排“民兵 15 → 猎风弩骑 15 → 青铜刀盾兵 15”，后排游侠 13+15，确认拥有的 73 人、资源与队列不变后保存重载。两份编队后战前档 SHA 为 `a38c789cbcf8f718828e5e2e4a8ea3ffd927e3ed9ec837eb75d0acb68019c245`、`43848b84696a8631dbaac267c5d995e45501e8ce6c6871b81c3657ff998c1cdf`。同流的 Edge 视觉开／关各自从相同完整档重载；Node VM 也从该**浏览器形成的同一档**加载，而非在 VM 中另造阵。

Edge 实际点击 4 倍速后异步战斗。HD2D 组有活跃画布、`hd2d-active` 类及就绪贴图；回退组仅在隔离页面暂令 `HD2D.mountBattle()` 返回 `false`。测试环境在旧档加载时把时钟冻结到档内时间戳，加载后恢复真实时钟，并暂停后台每秒 `setInterval(tick)`；战斗 `setTimeout` 不变。两流开战时随机调用数均为 0，战斗期间 `S.tick` 不动。随机种子仍为 P201/P211 的 xorshift32 `(flow*1009+29*9176)>>>0`。未注入资源、士兵、胜场，也未修改战斗实现或正式 CFG；玩家浏览器的 localStorage 未被使用。

## 第 29 关三路径结果

| 固定流 | Edge HD2D、Edge 回退、Node VM 的共同结果 | 随机调用 | 三路径共同的去 `ts` 完整战后档 SHA-256 |
|---:|---|---:|---|
| 1 | 胜，第 2 回合，损 24／73；石 +383、粮 +975、战功 +16 | 124 | `aba0b10c3cbe3a14abcdcb8589b279de219a7d200238a06e02e741c2e892aec8` |
| 15 | 胜，第 5 回合，损 50／73；木 +151、石 +94、粮 +975、战功 +16 | 191 | `6fce5c641353f46d78de1f21f7b7b3a59a5854dd8e8248fa251d5896e25142db` |

每流的 Edge HD2D、回退和 Node VM 双方兵团类型、站位、人数、HP、攻防、速度、tag 与战术相同；首回合完整日志相同，随机调用点统计和前 32 次数值相同，敌剩 HP、奖励、战功和整个去时间戳的序列化存档相同。流 1、15 在同速洗牌处分别有 12、15 次抽取，三路径一致。四场 Edge 战斗均无未捕获 JS 异常、console error 或缺失资源；完整原始和规范化存档均留在 JSON。

这与冻结的 [P213 旧实现结果](live-hd2d-battle-p213.md)不同：同一固定流在旧实现下流 1 胜损 37、流 15 败损 73；现在分别胜损 24、胜损 50。排序修正确实改变这两条战斗轨迹，不能由这两流推断整个第 29 关的玩家胜率或难度曲线已改善。P211 的 13/16 仍是旧实现 Node VM 固定流结果，不能沿用为新算法的浏览器通关数。

## 真实驻军状态机核验

另从来源流 1 的实付档重载，在真实页面战斗页切到“驻军”，经编队弹窗把同一 73 人合法转入驻军并保存重载，未改变拥有量、资源或队列；驻军战前档 SHA 为 `fea09ace60a7ae97cffc5bed6cad8aaecf39f3015f61503f22bdd63c038ca3dd`。使用固定流 6，点击页面“测试触发入侵”按钮，真实抽到“林缘斥候”，然后调用页面的 `tick()` 七次，经 `warning → spawn → sortie → battle` 状态机实际执行 `resolveGarrisonBattle()`。Node VM 从同一驻军战前档调用相同入口并推进七秒。

两环境首回合都把同速 13 的两游侠团从初始 id `3,4` 洗为 `4,3`；我方／敌方完整排序轨迹相同，首次行动者均为 id 1 猎风弩骑，随机调用均为 18 次且前 18 次值和调用点相同。两边均胜，第 2 回合结算，驻军由 73 人剩 71 人，敌 0，实入库石 +30、粮 +40，战功 +2；`S.tick` 从 19269 到 19276、资源、驻军阵型及结算对象相同。

驻军**原始存档没有逐字相同**：删去 `ts` 后仅 `/garrisonLog/0/time`、`/garrisonLog/1/time` 两处不同，Edge 按 24 小时制写 `21:08:09`，Node 按 12 小时制写 `9:08:09 PM`。JSON 保留两份原文与差异路径；另仅为比较删除这两个本地化展示字段后，其余整个存档 SHA 同为 `7d63760d440afa8510bbb72e0c942eb56838532b04f845b7e6871777dc0c0b29`。因此本批对驻军的结论是**战斗和持久化业务状态一致，展示时间字符串受环境地区格式影响**。

## 验证、边界与回退

- `node --check tools/verify/probe-combat-order-browser-p214.js`：退出码 0。
- `node tests/progression/combat_order.js`：探针冻结时 3/3，补齐正式训练场和驻军实际出手顺序断言后 5/5，退出码均为 0；`node tests/progression/garrison_settlement.js`：6/6，退出码 0；`node tests/progression/combat_async.js`：5/5，退出码 0。
- `node tools/verify/probe-combat-order-browser-p214.js`：退出码 0；真实 Edge 异步远征 4 场、真实驻军按钮与状态机 1 场，辅助 Node VM 远征 2 场及驻军 1 场。脚本对远征关键字段及驻军业务状态做断言，源码在测试过程中变动会使输入 SHA 断言失败。
- 冻结后只读复核 16 个输入指纹、两份来源档、三份编队后战前档、全部原始／规范化战后档及两份驻军语义档，共 40 项 SHA，退出码 0。探针 SHA-256 `e49a7e473b91e5ed91d68aa8facfeddfd537fb331d1c880165b46a1861cff36a`，JSON SHA-256 `41180e4af51d8d9dedcc8d864831faf61bd1ed6a275cd7962d237730aeb8d369`；JSON 内列全部源码与资源输入指纹。
- 开发调试中两次退出码 1 来自探针把 `armyCount()` 误当出征人数、以及将驻军入口误定位到军队页，均已修正。随后一次只读核对发现并行 UI 工作改变 `hd2d.js` SHA，本报告已以新 SHA 重跑、成功并复核。P213 探针、数据、报告均未覆盖。
- 仅新增本批探针、JSON、报告；未修改运行代码、策划、UI、美术或用户存档。样本只覆盖两份来源档和两条固定流，不覆盖设备性能、所有浏览器、全部关卡或玩家胜率。回退本批只需移除这三份开发侧文件。

数据：[`p214-combat-order-browser.json`](reports/data/p214-combat-order-browser.json)。探针：[`probe-combat-order-browser-p214.js`](../../tools/verify/probe-combat-order-browser-p214.js)。
