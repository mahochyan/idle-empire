# P405 主线第 51–97 关连续付款复核

基线为 `master` 的 `9fd54b76e3587aed069bdc4d5df61a0fd2b97778`，输入是 P404 第 50 关首胜的 v36 真存档。P405 没有改正式关卡数值、兵种属性或 UI。以下是**同一胜档链**的推进，不是把独立试验档或失败后的资源拼成一个档。每段从上段实际胜档加载，调用正式研究、建筑、训练、编队、区域/主线战斗和结算动作，再保存并独立加载核对。VM 固定 `Math.random()=0.5`，计时回调在模拟时钟中逐个执行；这不是实际玩家耗时、浏览器实测或所有随机流的胜率。

| 连续段 | 模拟在线秒（不含战斗回调） | 实际付款/成长和结论 | 摘要及末档 |
| --- | ---: | --- | --- |
| L50 胜档 → L79 | 69,210 | L51–56 残兵连胜；L57 起需实付补兵；胜至 L79，L80 常规阵容败。 | [连续账](reports/data/p405-mainline-continuous.json)、[L79 档](reports/data/p405-mainline-continuous-final-save.json) |
| L79 → L80 | 31,430 | 扩仓、农田、银金兵坊和营帐，158 人第 4 回合首胜，余 97。 | [扩军账](reports/data/p405-l80-capacity.json)、[L80 档](reports/data/p405-l80-capacity-final-save.json) |
| L80 → L94 | 104,530 | 实付补兵连续首胜 L81–94；L95 的 158 人分叉失败，未写回胜档。 | [逐关摘要](reports/data/p405-mainline-l81-onward.json)、[逐关账](reports/data/p405-mainline-l81-onward-ledger.jsonl)、[L94 档](reports/data/p405-mainline-l81-onward-final-save.json) |
| L94 → L95 | 29,600 | 石仓容扩至 8,000；弓营 T3/Lv5、学者实产并付 1,000 科技点，研究「不列颠长弓手」且正常训练 60 人；164 人第 6 回合首胜，余 13。 | [长弓账](reports/data/p405-l95-longbow.json)、[胜前档](reports/data/p405-l95-longbow-ready-save.json)、[L95 档](reports/data/p405-l95-longbow-final-save.json) |
| L95 → L96 | 32,290 | 残存 13 长弓首胜外域村寨得 12 地契；加原 20 地契实付小镇扩建 30，自然人口 19→21；仓 Lv20、营帐 Lv4（每团 25）、弓营 Lv12，补到长弓 100／全军 209，第 3 回合胜 L96，余 108。 | [人口与扩军账](reports/data/p405-l96-onward.json)、[逐战账](reports/data/p405-l96-onward-ledger.jsonl)、[L96 档](reports/data/p405-l96-onward-final-save.json) |
| L96 → L97 | 63,810 | 外域工造军镇 9 次真胜共得 180 地契，第 5 胜后补 58 长弓；实付 150 地契扩小镇四级，自然人口 21→29；仓 Lv35、粮仓 Lv5、营帐 Lv5（每团 30）、弓营 Lv29（长弓上限 204）、农田 Lv25。真训长弓 200／全军 309，第 3 回合胜 L97，余 154。 | [扩军账](reports/data/p405-l97-mass-longbow.json)、[逐战账](reports/data/p405-l97-mass-longbow-ledger.jsonl)、[胜前档](reports/data/p405-l97-ready-save.json)、[L97 档](reports/data/p405-l97-won-save.json) |

胜链从 L50 到 L97 累计模拟在线 **330,870 秒（约 91.9 小时）**；每段的在线秒只计入最终胜链，未将独立失败分叉的采集/训练时间相加。外域战斗回调和主线战斗回调另以毫秒记录：例如 L97 九场外域工造军镇回调合计 70,717.5 ms，L97 主线 18,165 ms。瞬时菜单操作、手工选择和真实设备渲染耗时不在此数中。区域的 9 次胜利是发展线提供地契的实得，主线击败记录没有靠它们代填。

L97 胜档独立重载后只到第 97 关。其后同档剩余 154 人打 L98 第 1 回合失败；从该**胜档**另开候选、真实付费补到 309 人，打 798 人的 L98 仍于第 3 回合全灭，敌方尚余 441。两个失败均为隔离候选，正式胜链保留 L97 战损后的原档；不能据此断言 L98 数值绝对不可达。L99 尚未进入；L100 的「星辉圣阵／星界量子时代」双科技准入以及新兵战力应由独立发展线验证，不能用 L97 的早期科技档臆测已通关。1000 亿知识的「星界引擎」是另一便利项，不能混作这两个关卡门槛。

关键存档 SHA-256 按输入到输出链如下；每段摘要还存有源码哈希、回放步骤、最终档哈希和 `failure:null`：

| 关口 | SHA-256 |
| --- | --- |
| P404 L50 输入 | `e0e8aba95021e069eb5ef4df06603ce15df67b9909c4328336dcf21a37546354` |
| P405 L79 | `0dc1cfc2a1d80bdd4e73df5f31c7b6ab5718dee901a2e9f892a62aa88752be6f` |
| P405 L80 | `4de98bbae15e5d03a902ed1ab01076da2bae1e29d2eab8f466959c7559de4141` |
| P405 L94 | `9415fc6b96e2e98077b3bdc66bc0a5c41e3fd7a29e2c8423985dfd45c27b46fa` |
| P405 L95 | `cf2f221d0ed5a4d1ced5178acd5b3b41abe719554b1dcfea238cea6c3b04b7b5` |
| P405 L96 | `f73cbc94d8352393923741d6a7a8e5d299d2fd5b781cffcd50721f37edc036cb` |
| P405 L97 | `d53dab711944ed857cecdb2d7914f0dd0fa925aa02e077d82209d88ed186cf22` |

复现顺序：`node tools/verify/probe-p405-mainline-continuous.js` → `node tools/verify/probe-p405-l80-capacity.js` → `node tools/verify/probe-p405-l81-onward.js` → `node tools/verify/probe-p405-l95-longbow.js` → `node tools/verify/probe-p405-l96-onward.js` → `node tools/verify/probe-p405-l97-mass-longbow.js`。三条新长弓/扩军探针及其 `node --check` 在 Node v24.19.0、PowerShell 环境均退出 0。测试为模拟 DOM、localStorage 和计时器的正式函数回放；本批没有改玩家运行文件及 `rts_save` 格式，故没有由本批新增的存档迁移。浏览器、Android、随机多种子、四策略 50 小时和 L98–100 全链验收仍未通过。
