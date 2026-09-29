# P357｜新档科技、兵种依赖与主线门槛只读审计

日期：2026-09-29。策划文档 D18 的目标是：区域副本承担《放置时代》式材料和时代发展，100 关是陡峭主线，应在全科技及综合军力成长后才打完；D18 **没有**要求每项科技都先过指定主线关。本批只读现行玩家代码、运行隔离 VM 真动作及既有回归，不改数值、玩家文件、总策划、UI 或其他代理资料。

## 判断

1. **科技直链没有已发现的静态循环门。**当前 `CFG.tech.longLadder=true`，`activeSciences()` 选用 41 个长表节点，其中 40 个可研究、1 个 `sci_metal` 仅供旧档保留。逐项检查 `need` 引用，未发现缺失节点或环；建筑、兵种上的 `needScience` 均指向现有长表。新档煤链的冶铜需先研究煤，城镇化需冶铜，冶铁需城镇化，城市化需冶铁。`researchScience()` 检查前置、科技点和材料，当前 `sciencesNoMerit=true` 豁免资源科技的战功；它不检查 `S.defeated`，也不会因科技点满额自动解锁。详见 [配置](../../config.js)、[研究动作](../../math.js) 与 [早期直链回归](../../tests/progression/era_chain.js)。
2. **旧兵种树与部分训练建筑仍以主线击杀为门。**`checkTierLevel()` 将 T1/T2/T3/T4 研究分别卡在第 5/20/40/65 关；步弓营升阶同样按这些关卡，骑兵场要击败 1 个 Boss，法师塔要击败 4 个 Boss，动作函数而非仅 UI 强制。首四 Boss 自然位于第 10/20/30/40 关，所以敌军第 29 关已有法师时，我方法师塔按顺序推进仍未可建。第 65 关当前只对应部分建筑 T4 升阶；现有玩家兵种最高 T3。它是显著的兵种供给错位和潜在战力墙，但本审计没有证明第 29/40 关必败或构成所有路线的硬死锁。时代独立军备（青铜、铁、银、金、合金、蒸汽、电磁）依赖时代科技及各自兵坊，动作层不要求主线胜场；星际／星界兵另依赖星核／量子研究，复用电磁兵坊。详见 [兵种研究](../../technology.js)、[训练和建造](../../math.js)、[敌阵](../../levels.js)。
3. **从条件可支付到新档终局，缺口很大。**长表终端 `sci_quantum_age` 需先有星核研究，再一次支付知识 3,000,000,000 和勋章 3,000,000；`researchScience()` 会原子扣费，但测试的足额资源是条件夹具，不是新档自然积累证明。[P270](nuclear-mixed-paid-p270.md)仅在选定高进度已付档上，新增约 105.33 小时模拟在线时间后实付星核 1 亿知识／80 万勋章；不含此前发展。[P304](quantum-capacity-guardian-paid-p304.md)的另一已付档知识容量约 1.67 亿；固定该档图纸等条件下，达到 30 亿容量的搜索候选仍须额外约 72.842 亿知识和大量材料，实际只续付电力科研 16→17 级。二者不能拼成一条从新档到量子科技的连续有价路线，也不能推断量子绝不可达。
4. **第 100 关尚未以全科技高难终局动作验收。**`selEnemy(idx)` 直接设置选择，主线 `openBattle()` 仅检查已选关和有编队，没有检查前一关或研究进度；UI 下拉列出全部 100 关。现行第 100 关配置是 11 个单位组、每组 1 人。这里不主张加“全科技硬锁”——D18 说的是难度成长目标；但当前门槛代码不能保证该目标。[P271](stage100-paid-terminal-audit-p271.md)曾以其当时工作区的已付晚期档发现第 90–100 关偏轻，那是历史证据；当前仍需同源、实付、逐关并含失败补兵的复核，不能把那份历史测试直接当成新档或当前代码的终局通过证明。

## 本批真实动作与验证界限

使用仓库 [VM/localStorage 测试壳](../../tests/progression/harness.js)，从无档初态起：人口 0、科技点 0、研究和胜场均空，木／石／粮各 300。先以真实 `buildAct('bronze_workshop')`、`train('bronze_guard',1)`、`buildAct('iron_forge')` 检查，均因科技未研究拒绝；`buildAct('academy')` 成功。推进 20 次 `tick()` 至学院完工、人口 4，真实分配粮工 1、学者 3；再推进 31 次 `tick()` 后科技点为 102.3（展示数值，浮点存值为 102.29999999999994），研究仍空、胜场仍空。调用真实 `researchScience('sci_prospect')` 后扣 100 科技点，余约 2.3，研究记录新增；保存主键在全新 VM 中 `loadSaveAndApply().status==='ok'`，资源和研究记录一致。此处 51 次 tick 是**模拟在线秒**，不含浏览器操作、建筑按钮时间或离线倍率，亦非全链最短策略。

针对动作门，隔离新档运行 `checkTierLevel(1/2/3/4)` 分别返回第 5/20/40/65 关提示，`buildAct('stable')`、`buildAct('mage_tower')` 均返回 `need-boss`；静态读取 100 个关卡和第 29 关首次法师。已有 [青铜铁器回归](../../tests/progression/military_metals.js)涵盖研究→建造→完工→训练，并确认零通关条件下可行；[白银](../../tests/progression/silver_era.js)、[黄金](../../tests/progression/gold_era.js)、[合金](../../tests/progression/steel_era.js)、[蒸汽](../../tests/progression/steam_era.js)、[电力](../../tests/progression/electric_era.js)、[星核](../../tests/progression/nuclear_era.js)、[量子经济](../../tests/progression/quantum_economy.js)、[量子兵](../../tests/progression/quantum_soldier.js)核动作接线、原子付款和回档，但多数采用预设足额状态，只证明动作在条件满足时有效。没有进行从新档到第 100 关的连续实付模拟，也没有做浏览器或 Android 验证。

## 最小下一步

先固定一套可重载的**同源新档检查点矩阵**：零胜场早期科技、5/10/20/29/40/65 关旧兵门、各时代兵坊实付首兵、星核之后的知识容量／勋章逐笔积累，再到第 90–100 关的同源实付阵容。每个点记录科技与材料余额、仓容、人口、出战编队、战损补训、主线胜场和模拟在线／离线秒。优先验证第 29 关的无我方法师策略、第 40 关前战力出口、量子 30 亿仓容及 300 万勋章净来源；若具体点确实不可持续，再最小幅度调整该点的门或曲线。第 100 关须在正式配置下与未毕业／毕业编队对照，检查是否真正形成高难台阶，避免仅用硬锁代替难度。

## 基线、命令与存档风险

- 工作区 `master`，基线及报告完成时 HEAD `f85e1c8624de8c9e17f7724373e65899d1085cdf`；`git status --short` 显示玩家脚本、UI、美术、策划和大量既有隔离报告均已有并行改动，本批仅新增本报告。`index.html:1667` 实际加载顺序为 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js`。已读 `AGENTS.md`、`CLAUDE.md`；AGENTS 所指参考提交 `98571e38801f71bfdbb982a626e0e58f510abb98` 的实际 Git 日期是 2026-05-17T03:10:16+09:00，与其标注的 2026-09-18 不一致，没有回退。
- 审计时玩家源 SHA-256：`config.js` `8e40ccc41ab96156db291ce74560981d875b304703fffb89c4139d5e23001675`；`levels.js` `9ef3e47bae99242e70970fc9c0f86912301aabdb6ed4fefe9e4e18250293c1cc1`；`math.js` `dc0bcdee534853368cb3c576e6020e1c85ab7be00052241136605897e91b0c95`；`technology.js` `9cfda541f49011a676674fb2740b12af63812542a1ce872dcafc57eb4330bf98`。终检复核相同。
- PowerShell / Node：`git status --short`、`git branch --show-current`、`git rev-parse HEAD`、`git show -s --format='%H %cI' 98571e...` 均退出 0；`Get-FileHash` 退出 0；两条 `node -e` 真动作检查及一条依赖图检查均退出 0。`node tests/progression/{era_chain,military_metals,silver_era,gold_era,steel_era,steam_era,electric_era,nuclear_era,quantum_economy,quantum_soldier,campaign_enemy_units}.js` 是逐条执行而非 shell 花括号命令，11 个文件合计 74 个案例通过、0 失败，逐条退出 0。
- 本批不修改 `rts_save` 格式或玩家数据。真动作仅在独立内存 localStorage 中进行，重新载入的验证也只针对该隔离存档；没有写用户浏览器存档。剩余风险是条件夹具不能证明长期开销可付、固定胜流不能代表自然胜率、UI／Android 未验和并行未提交源码可能继续变化。撤销本批只需移除本报告；不得 reset 工作区或回滚他人改动。
