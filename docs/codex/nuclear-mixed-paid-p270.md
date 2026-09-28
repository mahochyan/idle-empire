# P270｜星核研究的同档混合扩仓与实付训练

2026-09-27。本批沿[P269已实付516兵、机巧遗迹六胜后的完整v32检查点](reports/data/p269-crystal-full-roster-last-recovered-save.json)继续，验证《放置时代》式材料线能否在我方现行规则中支付星核时代，而不是仅给出条件仓容。主线「帝国战线」100关仍应是完成核心科技与军备后才能打完的高难主线；「拓境远征」承担材料供给。没有改玩家代码、敌压、研究费用或并行UI。

## 文档目标、代码现状、本次决定

策划目标是同一存档先获得材料、突破知识仓、囤足单笔知识和勋章，再研究并实际训练星核兵。代码现状：P269检查点有1002居民、516兵、晶核364、勋章823856、知识库存1488362和容量87339595；星核研究需单笔知识100000000、勋章800000。`eraStorageCost()`使蒸汽科研下一两级分别花知识4500000/4800000和晶核150/160；两级后知识仓仍只有94617894。`beastExchange`30级图纸需随机上架、实际材料和刷新次数，每张增全资源仓1%，不是无条件直加。

本次选择**两级蒸汽科研＋11张图纸**的可支付组合，所有动作在隔离存档中调用真实`setPopAlloc()`、`tick()`、`upgradeEraStorage()`、`openMaterialDomain()`、战后补兵、`refreshBeastExchange()`、`exchangeWildMaterialForScrolls()`、`useStorageScroll()`、`researchScience()`和`train()`，每段保存并由独立VM重载。[链路校验器](../../tools/verify/check-p270-chain.js)逐段核当前源档/终档SHA-256，防止跨档拼接。起点文本SHA-256为`e6803dbc09617243fc973719d236db88f96acbe6ef9632e58f2756856d51288a`。

| 同档阶段 | 真实结果 | 新增模拟在线秒 | 终点知识仓 |
|---|---|---:|---:|
| [蒸汽科研＋首轮边贸](../../tools/verify/probe-nuclear-mixed-p270.js) | 922学者/80粮工，知识实付930万、晶核310，升蒸汽科研14→16；60次刷新以既有材料换2图纸 | 65620 | 95663396 |
| [蜥龙狩猎](../../tools/verify/probe-nuclear-scroll-hunt-p270.js) | 从警戒3020连续48胜、每胜补回516兵，33次实际掉落共825蜥龙筋；第49战在3500败，交付前一场全员档 | 136299 | 95663396 |
| [蜥龙材料边贸](../../tools/verify/probe-nuclear-scroll-exchange-p270.js) | 60次刷新实付920蜥龙筋换5图纸 | 65301 | 98277150 |
| 同探针虎皮猎场支线 | 从警戒2680连续32胜、每胜补回516兵，23次实际掉落共575虎皮；第33战在3000败，交付前一场全员档 | 85900 | 98277150 |
| 同探针虎皮边贸支线 | 26次刷新实付660虎皮换4图纸；已用图纸总数81→92 | 24500 | **100368153** |
| [星核研究与首兵](../../tools/verify/probe-nuclear-research-paid-p270.js) | 再产知识4337088，单笔扣知识1亿/勋章80万；重复研究不重扣；实训1名星际先遣兵，各付铜/铁/钢8000 | 1551 | 100368153 |

总新增模拟在线时间**379171秒（105.33小时）**，从P269检查点起算，未包含P262–P269上游人口、军备和建造时间，也不含实际点击、读屏或设备动画。146次主动刷新分三段为60/60/26；11张图纸分别由初始蛮牛角/龟壳各100、蜥龙筋920、虎皮660实付取得，不能把材料库存等同于图纸。蜥龙48胜累计战损6165人，实付补员铜/铁各27672500、钢27786300；虎皮32胜累计战损3461人，补员铜/铁各17608000、钢17666800。两段都有胜而不掉材料的场次，分别15/48与9/32。所有被采用的胜场后都补回516兵，最低粮库存分别254903.01与330177.33；harness未触发随机自然驻军。终档保留1002居民，战场编队516兵、预备池星际先遣兵1人，知识484、勋章23856、晶核54；当前代码重载后`scienceUnlocked('sci_nuclear_age')`为真、训练池确有首兵。

这证明在**这条固定随机流与主动操作策略**下，材料→仓容→知识/勋章单笔扣费→解锁→训练的逻辑链可达。它不证明典型玩家105小时能达、50小时内毕业、离线等价或材料路线普遍安全。两个狩猎探针都继续试到首次败，再从败前已保存的完整检查点进入下段；交付路径相当于事先知道应在警戒3490/2990停手，失败后的损兵没有被抹写进后续存档。战斗和刷新以固定PRNG可复现，但每段重载会重设随机流；不应把此选择性路径冒充玩家胜率或无失败保证。材料和补兵高成本提示后期曲线仍需多策略与自然驻军校准，不据单路线直接放宽奖励或削弱100关。现在只能关闭**一条星核研究付款链**；第90–100关的正式敌压、星际兵入阵后的战损补回、后续时代研究与玩家双线UI仍未验收。现行玩家可见“星核时代／星际先遣兵”偏科幻，仍须按用户“后期更西幻”的主题裁决核定名称和美术；本批避开并行UI文件，未把这些名称视为最终定稿。原创玩法继续后置。

## 验证、存档与回退

本地`master`，基线与最终HEAD均`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，已有大量未提交修改保留。AGENTS提到的参考SHA`98571e38801f71bfdbb982a626e0e58f510abb98`在本地Git提交日期为2026-05-17（+09:00），与其写的2026-09-18不符，不把它用作回退目标。新增四个P270开发探针与一份六段SHA校验器、隔离报告/终档和本设计记录，更新唯一策划文档及实施台账；没有编辑游戏运行JS、`index.html`、`ui.js`、`visual.css`、美术或Android。逐段JSON与v32存档见[隔离数据目录](reports/data/)，文件前缀`p270-nuclear-`；最终可重载档是[p270-nuclear-research-paid-save.json](reports/data/p270-nuclear-research-paid-save.json)，当前文本SHA-256 `8e33a404c1e718dffcd5a4911b7cd8c051ba55797edebbd618da379388287beb`。

实际运行：`node tools/verify/probe-nuclear-mixed-p270.js`、`node tools/verify/probe-nuclear-scroll-hunt-p270.js --seed=13`、`node tools/verify/probe-nuclear-scroll-exchange-p270.js`、`node tools/verify/probe-nuclear-scroll-hunt-p270.js --hunt=tigerPelt --seed=13`、`node tools/verify/probe-nuclear-scroll-exchange-p270.js --tiger`、`node tools/verify/probe-nuclear-research-paid-p270.js`及`node tools/verify/check-p270-chain.js`最终均退出0。`node tests/progression/wild_scroll_routes.js` 6/6、`wild_bone_exchange.js` 6/6、`nuclear_era.js` 4/4、`beast_exchange_scroll.js` 5/5、`beast_exchange_refresh.js` 5/5，均退出0。开发侧链路校验器首跑把`purchased`与`purchases`字段混用，研究探针首跑把预备池新兵漏计入`armyCount()`；修正探针断言后复跑通过，这两次退出1不是游戏代码故障。Node VM模拟DOM/localStorage/计时器，未运行真实浏览器或Android；没有修改玩家存档读取、迁移或备份逻辑。

玩家`rts_save`仍v32，隔离链路最终档可由当前代码读取；旧版代码读取此档须单独验证。撤回本批只移除P270探针、隔离数据、本报告及策划/台账本批增量，不删除玩家档，也不回退并行UI。
