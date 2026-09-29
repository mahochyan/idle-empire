# P395｜星界兽域六阶实付突破与七阶入口

日期：2026-09-30。接续 `master` / `0300e8c96cd9960d03886511dd931c37ae41852d`；输入为 P394 [五阶首胜后补满编档](reports/data/p394-tier4-after5-refilled-paid-save.json)，SHA-256 `14bd38b1c9c428c6b8e7a42a8c16296158de59eafccb9e50ec774a32a73a666a`。本批只新增[隔离探针](../../tools/verify/probe-star-beast-six-p395.js)、账本和可重载检查点，不修改玩家运行时或 UI，也不写入真实浏览器存档。原始六阶付费路径的 `config.js` / `levels.js` / `math.js` SHA-256 分别是 `1d46cd09d15cd9faf05cbb40a0b5e30fdf7d6ae3bcfd21550233c178378ebfd8` / `dc0f73ccb179900f2a270f35ab22775d2eb7ca18caf10037480f3bc7a3359afc` / `9cb16af1e322205a2a92110758d71ac5bea0c422b04d981aab870c18a8cd2513`。并行任务随后改动了 `config.js` 和 `levels.js`，故末节另列当前哈希冒烟；不能把旧哈希付费全链路误写成新哈希全链路。

## 六阶突破

五阶胜后警戒值 1,000、军制 17 星、出战 626／总兵 672。该档六阶固定 16 流 0/16，最近仍余敌生命 400,542。真实 `calmStarBeastAlert()` 消耗当日第 1 次免费平息，警戒 1,000→0，保存重载后的六阶仍 0/16，最近余敌生命 181,988。[平息账本](reports/data/p395-star6-calm.json)、[平息后档](reports/data/p395-star6-calm-paid-save.json)可复查；没有注入警戒值。

从平息后档以 `settleOffline()` 连续结算 40 个 8 小时窗口，共 **320 小时模拟离线时间**。每步先通过 `settlementBatchPreview()` 报价，再用 `upgradeSettlementBatch()` 支付地契，调用 `steamMilitaryStarStep(1)` 升星，并 `save()`／新 VM `loadSaveAndApply()`。城市 Lv627→1090、军制 17→25 星，原 626 人阵不变。逐星费用、地契余额、每段离线收益和固定流结果见[升星账本](reports/data/p395-star6-stars.json)。22 星最近余敌生命 38,730；23 星最近 10,623；24 星 15/16，失败的 seed7 仅余敌生命 1,184；25 星 **16/16**，战损 2–5，三种圣阵石每种各 +100。[25 星战前档](reports/data/p395-star6-star25-paid-save.json) SHA-256 `44e6910c1b7399d7e82b49a82729b25eaef653cda028a025d6e8ece37f50b869`。

另从 24 星 seed7 真实败档继续，保存重载后实训补回 5 人：铜／铁／钢各扣 40,000，在线推进 3 秒。再结算 6 个 8 小时窗口（48 小时）、支付 401,814 地契扩城到 Lv1090、升到 25 星；从这条**败后恢复**路径得到的独立[25 星战前档](reports/data/p395-star6-star25-after-loss-recovery-paid-save.json) SHA-256 `8a796b1ad09c618b578a63ad2f090b5ac2bd1f8df4e8b3ef13dc2d111247f8b1`，六阶也 **16/16**。原败档、补兵档和回战明细见[恢复账本](reports/data/p395-star6-loss-recovery.json)。这条分支前 24 星的 34 个离线窗口与上述主路径相同；追加 6 个窗口后累计同为 320 小时，没有重复累计两条分支的时长。

## 七阶入口与可付强化

从恢复路径六阶 seed1 首胜，战损 3，三种圣阵石各 +100，警戒 0→350。真实补兵后第 2 次免费平息将警戒 350→0；七阶固定 16 流仍 0/16，最近余敌生命 308,726。[七阶入口账本](reports/data/p395-star7-entry.json)保留了首胜、补兵及平息后的可重载档。

同档把 902 人从采铜转到学者，8 小时真实离线结算后知识增加约 3.073 亿；支付知识 1 亿和勋章 100 万研发星界战机。此时已有高能核心 29。[知识付款账本](reports/data/p395-star7-fighter-supply.json)记录了人口调配、离线收益和研究后检查点。接着战术演算机按 seed11 连胜 3 次，各得高能核心 59／60／60、各损 11 人；每胜后真实训练补回，三轮训练在线合计 18 秒。核心库存到 208；[核心供给账本](reports/data/p395-star7-core-farm.json)记录每次掉落、警戒、材料支出和可重载档。最后 `forgeWeapon('starFighter')` 真实执行 20 次，支付钢 200,000、高能核心 160，升到 Lv1 并真实装备。该[装备后档](reports/data/p395-star7-fighter-equipped-paid-save.json) SHA-256 `dcf21b0932e2bd640c3a37804da1fc3d685165c47b2f2f3c1c50f3ccb16d93f1`；七阶仍 **0/16**，最近余敌生命降到 289,725。[战机账本](reports/data/p395-star7-fighter.json)保留了逐次扣费与战斗结果。本批在此停止；没有声称七至九阶可达或宣称所有强化途径耗尽。

## 验证范围与存档

Windows PowerShell / Node v24.19.0：`node --check tools/verify/probe-star-beast-six-p395.js` 退出 0；探针 `--calm`、`--stars`、`--recovery`、`--next`、`--gates`、`--fighter-supply`、`--core-entry`、`--core-farm`、`--fighter`、`--smoke-current` 均退出 0。根级并行小改之后的[当前哈希冒烟](reports/data/p395-star6-current-smoke.json)使用 `config.js` / `levels.js` / `math.js` SHA-256 `c1e9257c1b0677c5a306a80c28e8b729b4667bc2dbd7e43e1f88bed06d97e869` / `7105cc27283ea25aa6829135b09c1da2f1b0ea5a7f1721d6bb3167e3d57c5f08` / `9cb16af1e322205a2a92110758d71ac5bea0c422b04d981aab870c18a8cd2513`，对 25 星原胜档、败后恢复档、七阶平息档、七阶战机档各重新加载并跑固定 16 流：依次 16/16、16/16、0/16、0/16。它证明这四个旧安全档在新代码上可运行，不等于新代码上重复付款 320 小时全链路。

探针使用真实游戏函数与战斗结算，通过 Node VM 模拟 localStorage、DOM、定时器及固定 RNG 种子 1–16；每场独立从战前档重载。这里的 16/16 只是 16 条固定流，不是任意随机流必胜或玩家胜率。模拟 320 小时离线不表示现实已经等待；这条路线的真实时间门槛很长。尚无本批专门的浏览器 UI 冒烟。

所有检查点仍为 `rts_save` v33，没有新增字段、迁移、导入或存档覆盖行为；源档只读。删除本探针、本报告及 `p395-star*` 隔离数据即可撤回本批验证产物。若后续更改星兽、军制、城市费用或离线公式，应重新验证付费链路及败后恢复。
