# v3.11｜同速行动顺序修复与复查

## 结果与范围

远征和驻军原先在 `Array.sort` 比较器中抽随机数；比较次数随 JS 引擎变化，同一第 29 关战前档和随机流在 Edge 与 Node 出现不同胜负。本批把两条战斗路径改为速度优先的确定性排序，再对每个同速组做一次 Fisher–Yates 洗牌。每组 `n` 个兵团恰好抽 `n−1` 次随机数，保留既有双方交替行动与战术速度修正。训练场也走同一个远征回合入口。没有调整敌军、伤害公式、兵种属性、奖励、人口或主题命名；UI 美化由并行工作负责。

基线为工作区 `master`、HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，不是干净检出；保留了全部既有未提交修改。改前 `math.js` SHA-256 `7a71108cb66c45a58b2fb44e3e08e80df27b722bcb3f18fd6ad437b147df46a4`，`garrison.js` 为 `a16b5ec3ae6f6eec7619e0de8f7386f627c449c1f2ce9a8dfe3ebbf07a9bcc33`。改后分别为 `6335736ad922dd51b9f231e28cc286215074add83c74e0cc5b067baf3f449695`、`c3793840886aac466dd25ede4ffd407adf726b618dee81d13f1c6c0f8970b167`。实际页面脚本顺序仍为 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js`。参考快照 `98571e38801f71bfdbb982a626e0e58f510abb98` 实测提交日期为 2026-05-17；它没有用于回退。

## 验证

- 新回归 `tests/progression/combat_order.js` 首先在旧实现下 0/3、退出 1，证明缺少稳定同速排序；实施后扩为 5/5、退出 0，覆盖随机调用数、排序比较次数扰动、正式远征／训练场／驻军行动顺序。
- `node --check math.js`、`node --check garrison.js`、`node --check tests/progression/combat_order.js` 均退出 0。`node tests/progression/garrison_settlement.js` 6/6、`combat_async.js` 5/5、`combat_guards.js` 13/13、`cavalry_wind_semantics.js` 15/15、`tests/ie001/run.js` 96/96，均退出 0。`git diff --check -- 策划文档.md math.js garrison.js` 退出 0。
- [P214真实浏览器报告](live-combat-order-browser-p214.md)：当前 `math.js`／`garrison.js` 与 `hd2d.js` SHA `19ad4ce60deb9dbb270cc28212201238593606872d570a476124011870252636` 下，同一两份第 29 关实付战前档在 Edge HD2D、Edge 视觉回退和 Node VM 的流 1／15 分别同为胜损 24／50，随机轨迹、奖励及去 `ts` 的完整战后档相同。驻军从真实页面按钮触发后，行动及持久化业务状态一致；原始档仅两处日志时间因地区格式不同。探针和 40 项 SHA 复核退出 0。
- [P215现行 16 流报告](live-l29-order-sweep-p215.md)：两份来源档交叉重放原阵、逆序阵各 16 流共 64 场 Node 正式异步战斗，原阵 12/16、逆序 14/16；逆序流 8、9 仍全损。流 8 实付 1868 模拟在线秒补满 73 人，粮最低 2.42，同流同阵复战仍败。探针和 79 项 SHA 复核退出 0。
- [P216下游报告](combat-order-downstream-p216.md)：第 20、40 关实付档各两条流均胜，四场战前、战后保存重载成功；战损分别为 18／28、18／58。探针和 21 项 SHA 复核退出 0。P215／P216 是 Node VM 固定流，不能当玩家胜率。

## 兼容、风险与回退

本批没有新增 `S`／`B` 字段或改变 `rts_save` 结构、读写与迁移规则；IE-001 兼容回归通过。旧存档可加载，但相同阵容与随机种子下的战斗轨迹会因同速洗牌算法改变；修复前的 P210／P211／P213 固定流结果只作历史证据。Edge 验证限第 29 关两条流和一场驻军；第 20／40 关仅 Node 抽查，Android WebView、全关卡、多策略军粮与第 29—31 关难度曲线尚未验收。

若需撤销本批运行规则，只撤 `math.js` 中的同速排序辅助函数及远征两处调用、`garrison.js` 中的两处调用；保留工作区其他未提交改动和并行 UI 文件。恢复旧随机比较器会重新带回已证实的 Edge／Node 分叉，因此撤销后须重新评估战斗一致性。新测试及 P214–P216 开发侧证据可独立保留作对照；没有提交、推送或部署。
