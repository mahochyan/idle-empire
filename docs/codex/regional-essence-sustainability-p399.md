# P399｜拓境村落战功与精魄的实战补给复核

基线为 `master` / `eff25820391efccbd881d1a11d66091d2f3c3c5b`。从 [P245 第10关已付存档](reports/data/p245-outer-village-l10-save.json)开始，43名已编队士兵、普通主线10胜，重载时由 v32 候选迁至 v34，`rts_save_premigration` 保留输入原文。探针执行真实 `openDevelopmentOuter('village')`、异步战斗回调、`endBattle`、`train`、生产 `tick()`、编队和保存重载；固定伪随机流，不注入资源、胜场、兵力或奖励。战斗回调按配置毫秒时间推进 `tick()`，补兵等待按秒计；没有离线结算。最终运行的 `math.js` SHA-256 为 `4e121994991540d91b52d63b64b21506ff42f84f7e3e558917cebfdec65366bb`。

| 路线 | 实际结果 | 战功／精魄 | 军力与费用 |
| --- | --- | --- | --- |
| 不补兵 | 第1、2场胜，第3场败；43→28→16→0人 | 战功39→49，额外盾、枪精魄各1；主线胜场仍10 | 第3场全灭，不能把区域结算测试当成连续刷取能力 |
| 每胜实付补回43人 | 15/15胜，区域警戒0→300，最终再次补满43人并可重载 | 战功39→114，拓居令0→180，勋章0→75；盾／枪／剑精魄终值5／5／6，剑初值为1；主线胜场仍10 | 共损184人、真付训练184人；粮26,510、铜6,500、木10,040、石4,760；补兵等待3,330模拟在线秒，含战斗总推进3,468秒 |

补兵路线最终粮约58.06、铜727，故这里只证明这份固定流在第15场后仍能补满，不证明无穷续刷或长期正净收益。每次训练费记录来自真实 `payTrainingCost`，生产在等待期间真实运行；仓储和资源净值不能用费用简单相减。驻军日志在该次回放中为0；随机驻军威胁、不同阵容或随机流、短会话离线恢复与 Android WebView 均未由本探针验收。

复跑命令 `node tools/verify/probe-regional-essence-sustainability-p399.js` 与同命令加 `--paid-refill` 均退出0。逐场战损、付款、时钟、存档 SHA 和运行文件 SHA 分别见[无补兵账本](reports/data/p399-regional-essence-unreplenished.json)与[实付补兵账本](reports/data/p399-regional-essence-paid-refill.json)；两份末档分别为 `p399-regional-essence-unreplenished-save.json`、`p399-regional-essence-paid-refill-save.json`。这是 Node VM 中的真实逻辑调用及计时器模拟，不等同浏览器冒烟。本批只新增开发侧探针和隔离报告，无玩家代码、存档格式或 UI 改动；回退只需移除这些 P399 开发材料。
