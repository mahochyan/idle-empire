# P79 守御4300／4400实付与电力科研16级（2026-09-24）

承接P78真实v29胜利档 `p78-guardian4200-first-win-paid.json`（SHA-256 `4a9dbf2315ba5f3362c1982c713ad140ba8e4ff714d441cce9b4ef58b488e905`）。本批沿同一存档生产材料、补兵、编队、战斗、产知识并付款；不改玩家配置、战斗公式、价格、UI和存档结构。玩家可见命名继续遵循前中段机巧／工业、后段西幻神祇的边界：电磁军备和电力科研仍是技术线，守御之神及守御之石属于后段神祇材料线。原创玩法待完整骨干设计后再议。

| 实付步骤 | 真实消耗／耗时（游戏在线秒） | 结算与快照 |
|---|---|---|
| 补兵后战守御4300 | 电磁32、合金29、蒸汽装甲12；铜／铁各280000、钢282900、粮43500；31511秒，岗位切换13次 | 固定种子2第30回合胜，515→440兵，守御石120→229（+109），警戒值至4400；胜后SHA `36d08c9d21e936c04cf189a6e199739d89ad59a83237e74f79f71671467ac124` |
| 再补兵后战守御4400 | 电磁19、合金39、蒸汽装甲17；铜／铁各186000、钢189900、粮58500；22871秒，岗位切换10次 | 固定种子12第30回合胜，515→437兵，守御石229→339（+110），警戒值至4500；胜后SHA `614fa9d0f610afc5f0f95de2a6398055db00bd96fbda11ce1aee4a` |
| 电力科研15→16 | 90粮工／36学者，知识毛产432/秒、食物净产约68.85/秒；54933秒积累至32000362，升级实扣知识32000000、守御石320 | 等级16、知识剩362、石剩19，知识仓43480800→45220032；v29终档SHA `c3e3ee3c5de26aac0693a6d314b099fdb7a6ae455b7bda25752f5763f38253cf` |

两次补兵均先由现有126人口分相生产石、煤、铜、钢，再通过 `train` 逐兵扣费、队列 `tick` 完成、`clrForm`／`confirmForm` 排回515人阵容。训练费用按当前 `CFG.units` 实价累计，战斗调用 `openMaterialDomain('guardianStone')` 和原异步结算；胜后、付款后的各份v29快照分别独立 `loadSaveAndApply()` 为 `ok`。电力科研费用由 `eraStorageCost` 返回，真实 `upgradeEraStorage` 扣费一次，立即重复调用失败且状态不变。P78输入字节未改。总新增109315模拟在线秒（约30.37小时），不含玩家点击与战斗动画，也不含P78之前漫长的科技／军力准备。

条件筛选与实付严格分开：P78胜后满编条件守御4300为4/12胜，选择种子2后才进行上述真实补兵；4300实胜档满编条件守御4400为1/12胜，选择种子12后才真实补兵。16级实付档的满编条件守御4500为0/12胜，最好种子12在31回合判负时敌方仍有878 HP；该补满只在丢弃的VM副本中修改阵容，**没有支付补兵或把任何奖励写入终档**。固定种子不能外推真人胜率；4500的结果也不是所有阵容、装备或军力成长的上界。

当前神战勋章库存仍超过800000门槛，但知识容量45220032距星核研究单笔100000000尚差54779968；电力科研17级下一笔还需知识34000000和守御石340，现存石19。不能将16级容量或条件满仓路线说成星核自然可付款。下一段应以已验证的现有装备／兵种培养费用核查4500的可付增益与战损，再结合狩猎图纸和建筑扩仓核对同一存档的容量、材料、时间及操作量；不得直接调低Boss难度或提前开放原创玩法。

基线／最终均为本地 `master`，HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；保留原有未提交内容，无重置、提交、推送或部署。本批新增三支开发探针、四份战前／胜后v29快照与一份16级终档、此报告、策划和台账增量。实际命令：

- `node tools/verify/probe-guardian-next-paid-p79.js --snapshot-prebattle=docs/codex/reports/data/p79-guardian4300-prebattle-paid.json --snapshot-first-win=docs/codex/reports/data/p79-guardian4300-first-win-paid.json` 退出0；第一次脚本初稿误用不存在的 `S.pop` 断言而退出1，改为现有 `S.population.current` 后通过。
- `node tools/verify/probe-guardian-next-conditional-p79.js --detail` 退出0；从4300实胜档独立筛选4400。
- `node tools/verify/probe-guardian-next-paid-p79.js --input=docs/codex/reports/data/p79-guardian4300-first-win-paid.json --seed=12 --snapshot-prebattle=docs/codex/reports/data/p79-guardian4400-prebattle-paid.json --snapshot-first-win=docs/codex/reports/data/p79-guardian4400-first-win-paid.json` 退出0。
- `node tools/verify/probe-electric16-after-guardian-p79.js --snapshot-final=docs/codex/reports/data/p79-electric16-paid.json` 退出0；初稿遗留15级的结果断言而退出1，修为16后通过，真实扣费逻辑未改。
- `node tools/verify/probe-guardian-next-conditional-p79.js --input=docs/codex/reports/data/p79-electric16-paid.json` 退出0；只用于4500条件筛选。
- 三支探针 `node --check` 均退出0；`node tests/progression/nuclear_era.js` 4/4、`electric_technology.js` 5/5、`combat_guards.js` 13/13 均退出0；`git diff --check` 退出0（仅既有LF/CRLF提示）。

存档兼容：没有新增或更改v29字段；所交付的五份快照均由真实动作 `save()` 写出并独立重载。VM替身计时器和DOM只验证逻辑与结算，不等于浏览器或实体Android/WebView，本批玩家界面未改，后两者未运行。回退仅移除本批三探针、五份开发快照及文档增量，保留玩家主档、普通备份、迁移前保护副本与P78输入；旧版代码回写v29主档需单独验证，不能以关闭功能替代数据保护。
