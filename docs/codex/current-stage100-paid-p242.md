# P241–P242｜现行新档第99关检查点与实付终局复战

**后续状态（v3.24）：**[P260–P261](stage100-terminal-frontier-p261.md)沿本报告的未通100关战前档实付40名电磁兵，并对第100关人数做隔离敏感度；正式配置未改。原P242的三条固定值结果保留其当时代码与存档的历史含义，后续16条PRNG流及条件星界注入不能视为同一口径或已实付星核通关。

2026-09-27。100关是高难主线，完整通关的设计目标是需要完成核心科技与成熟军力。本次仅验证当前代码的一条实付路线是否已经满足这一终局门槛；不调整关卡、科技、奖励或玩家界面。

## 共同存档与真实动作

[P100自然新档战役入口](reports/data/p100-natural-campaign-entry-before-upgrades-save.json)原文 SHA-256 为 `d90f82556623e6e33c0c507d0e87d3067619a0fd38c8a2ec92d35c92e55a9445`，v31、102人口、零主线胜场。用现行 `loadSaveAndApply()` 在隔离 `tests/progression/harness` 中迁移到v32，再调用 `probe-stage-frontier.js` 真实战斗、补兵、岗位与在线 `tick()`，以种子9连续打到第99关。输出新文件 [P241逐关回放](reports/data/p241-natural-campaign-stage99-replay.json) 和 [P241完整v32检查点](reports/data/p241-natural-campaign-stage99-save.json)，没有覆盖P97/P100历史文件或玩家浏览器存档。

P241 `attempted=99`、`wins=99`、`blockedAt=null`，第99关后在线计数3,321,419秒，实际拥有92兵、出战47兵。独立核对存档版本32、`defeated`恰含1–99且不含100，现行加载状态`ok`。第99关前125兵、80出战；第99关5回合胜，损33兵。P241回放 SHA-256 为 `2a9114c3ccca5a2e6d01de4449815b16dd7e5307e613ddf0e06b9a347310d6b5`，完整档为 `459187841404398aee909298b589ee70e6bf0aeaff705f8b78372548640268ab`。终点脚本没有为第100关补兵，因此这份检查点不能原样视为满编第100关战前档。

[P242开发探针](../../tools/verify/probe-current-stage100-paid-p242.js)从上述同一档独立分出三支，在每支内通过现有 `setPopAlloc()`、`tick()`、`train()`、队列扣费、`openFormModal()`、`confirmForm()`、`save()` 恢复第99关战前使用的40合金兵前排、20/20猎人中后排。没有直接修改兵池、资源或胜场。三支均训练15名合金兵与18名猎人，实扣粮23,040、钢1,500、木1,440、石360；79在线秒后拥有125兵、出战80兵，最低粮182,406.8566，准备档重载状态`ok`。准备前后仍为99胜、34项研究、未研究`sci_nuclear_age`、无兵种升阶。

为后续终局调参保留一份**尚未胜第100关、已实付补满**的 [P242战前v32存档](reports/data/p242-stage100-recovered-save.json)，SHA-256 `8bab121b5fc92058356341423d4339bf8c4fdbf0906bb2284e01403330dd2630`；在线计数3,321,498秒。三支战前档除生成时刻与编队ID外，人口、岗位、资源、兵池、队列、编队人数、科技、胜场与在线计数完全一致；只保存其中一份。独立重载为`ok`，验证1–99关已胜、第100关未胜、125兵/80出战、无星核科技或兵种升阶。后续若复用此档调第100关，应保留它的原文与SHA，分支隔离测试，不把候选胜利结果写回这份输入。

| 第100关固定战斗随机值 | 回合 | 胜负 | 战损 | 战后主线胜场 | 战后存档重载 |
|---:|---:|---|---:|---:|---|
| 0.1 | 7 | 胜 | 6 | 100 | `ok` |
| 0.5 | 1 | 胜 | 1 | 100 | `ok` |
| 0.9 | 1 | 胜 | 15 | 100 | `ok` |

三支均调用现行异步战斗回调直到`endBattle()`真实结算，`B.settled=true`，战斗未推进生产时钟；胜场与兵力均经新VM载入刚写出的隔离存档核对。[P242原始数据](reports/data/p242-current-stage100-paid.json) SHA-256 为 `789e7e4c3a148c31089d90ed61b3dd3ade883e7d8070cfcb517690a372518680`。P242运行前后五份玩家源码哈希一致：`config.js` `bbd2b099f529f3e047bad69a02bec5935786cb42aecc6fa9490d73273405125a`、`levels.js` `6762169e213dce8ce806fc08799c28a3431cf6f6dca2058d993ab56aab8f3e95`、`math.js` `2bc7573ebe9bae8d924dab3682860fb9763505b22740aee72fa455c03b5928de`、`garrison.js` `c3793840886aac466dd25ede4ffd407adf726b618dee81d13f1c6c0f8970b167`、`technology.js` `994e1e82d3507d2fcd4d3147135575fe91f255c1add032d166ca0a896b1f4945`。

## 设计含义与边界

这条**现行代码**的实付新档路线从零胜场连续到99关，再由其真实存档补兵打赢第100关；它比P237从已100胜历史终档直接复战更强地反驳“现在必须研究星核时代才能通关”的说法。它仍只是一条102人口、高操作、较长模拟在线时间的路线；前99关使用种子9，第100关使用三个固定值，不能当玩家胜率、自然操作时长、多策略成长或后期科技可付性的证明。第100关的最终难度需待发展区域提供可付的后期科技与补兵来源后，用**同源、尚未胜100关**的缺关键科技与已发展军备两态比较，再校准敌军人数、生命、出手规模与章内战损。没有必要据此添加科技按钮硬锁。

本次没有真实浏览器或Android验证；测试夹具替代了DOM、localStorage与计时器，但战斗、生产、训练、付款和保存均调用当前游戏实现。P242探针最初两次因开发侧断言错误（团数误作人数、跨VM对象原型直接比较）退出1；修正探针后完整运行退出0，这两次不是游戏失败。命令与退出码：`node tools/verify/probe-stage-frontier.js --snapshot-in=docs/codex/reports/data/p100-natural-campaign-entry-before-upgrades-save.json --max-stage=99 --seed=9 --alloy-front --replenish --snapshot-final=docs/codex/reports/data/p241-natural-campaign-stage99-save.json` 退出0，标准输出另存P241回放；`node --check tools/verify/probe-current-stage100-paid-p242.js`退出0；`node tools/verify/probe-current-stage100-paid-p242.js`修正后退出0；`node tools/verify/probe-current-stage100-paid-p242.js --checkpoint-only`退出0，核对三支战前状态一致、既有P242结果一致后只写入新P242战前档；另以独立Node断言核对P241 v32/1–99胜/无100与P242战前档的v32/99胜/125兵/80出战/无星核，退出0。只新增P241/P242开发侧文件；撤回时删除这两批新探针、数据和本报告，不回退历史存档或共享工作区其它改动。
