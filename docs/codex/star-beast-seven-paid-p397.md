# P397：星兽七阶同档实付前沿

基线为 `master` 的 `6552bad5c459971d68304dcf1057c35812f6f15f` 和未提交工作区；入口是 P395 已付存档 `p395-star7-fighter-equipped-paid-save.json`（SHA-256 `dcf21b0932e2bd640c3a37804da1fc3d685165c47b2f2f3c1c50f3ccb16d93f1`）：军事 25 星、城镇 1090 级、完整兵力 672、已装备星辉战机 1 级。P397 没有修改运行配置、战斗公式、关卡或存档格式，也没有注入资源。

| 同档节点 | 真实动作与成本 | 七阶固定 16 组随机流 | 下一段压力 |
| --- | --- | ---: | --- |
| P395 入口，25 星 | 已付基线 | 0/16 | — |
| P397，30 星 | 15 次每次 24 小时的**模拟离线**结算；真实 `upgradeSettlementBatch` 共付地契 2,884,499，城镇 1090→1465，真实 `steamMilitaryStarStep` 25→30，逐星保存/重载 | 13/16 | 八阶 0/16，最近剩余敌军 HP 334,834；九阶 0/16，最近 699,362 |
| P397，35 星 | 从七阶首胜、补兵、清除警戒后的**同一存档**继续；再做 22 次每次 24 小时的模拟离线结算，真实支付地契 4,425,936，城镇 1465→1902，军事 30→35 星 | **16/16**，每场损失 1–3 兵 | 八阶 0/16，最近剩余敌军 HP 151,792；九阶 0/16，最近 510,478 |

30 星时实际执行了一场七阶首胜：随机流 1 获胜，三种星阵材料各从 280 增至 420，损失 2 名星际士兵，星兽警戒由 0 升至 400。随后真实训练并完成 2 名补兵，铜、铁、钢各付 16,000，模拟在线推进 1 秒，兵力恢复 672、出征编队恢复 626；真实免费清除警戒后为 0。首胜、补兵、清除警戒都有独立可重载存档。25→35 星累计 37 天（3,196,800 秒）**模拟离线**、地契支付 7,310,435；这些是游戏内时间和实际扣费记录，不是实际墙钟等待，也不包含 P395 之前的模拟时长。

战斗压力每个随机流都从对应已付存档单独载入，不是同日连续挑战，也不能据此声称统计胜率或八、九阶已通关。30–50 星的探索性敏感性数据另见 `p397-star-beast-late-pressure.json`；其中大于 25 星的行直接改写未保存 VM 状态，只是条件搜索，不是付款证据。35 星实付存档在当前源码下的七阶 16/16 是本次止步点；八阶在该阵容下仍是首个未通战斗门槛。未继续推进 45、50 星，也未调整战斗数值。

第 100 关阵容改动后，最终源码的 `levels.js` SHA-256 为 `cec80c26fa91f941994c253a2fe73be0dfe3f108237620b662fdab9f5449fd1d`。30 星及 35 星付款账本是在改动前的 `levels.js` SHA-256 `7105cc27283ea25aa6829135b09c1da2f1b0ea5a7f1721d6bb3167e3d57c5f08` 下生成；付款账本未重新跑 37 天。现已在最终源码下复跑七阶首胜、补兵、清警戒，并从现有 35 星**已付存档**重载复跑七至九阶压力，结果和存档 SHA 均保持一致。其余最终源码 SHA-256：`config.js` `85501a43d1257c2d189d517fd9dd4edb33e5cc3764f13759ee82d9d7f05a0b01`、`math.js` `88f9c84b549f4b80d331faa59c2a540973c98c5f1caadae5a3d04e7df5941e3f`、`technology.js` `9b35d51f46e636713f06cedfb003a19c338026ab2bfbbc80f8c63bc8ef99e486`。最终 35 星存档 SHA-256 为 `d71e05a3454d9ebc44ff4f23b7006f722a3eeac4cbf2a6a04cb029dd6ddc93ce`，且可用原 `rts_save` 键重载。

验证通过（退出码均为 0）：`node --check` 三个 P397 探针；`node tools/verify/probe-star-beast-seven-paid-p397.js`；`node tools/verify/probe-star-beast-late-pressure-p397.js --paid35`；`git diff --check -- config.js levels.js math.js technology.js`。付款探针 `node tools/verify/probe-star-beast-late-stars-paid-p397.js --target=30` 和 `node tools/verify/probe-star-beast-late-stars-paid-p397.js --from-seven --target=35` 此前均退出 0，并留下逐笔账本。验证环境是 Node VM 及模拟 DOM/计时器；本次未做浏览器冒烟，因无 UI 改动。原 P395 存档与现有用户工作区未覆盖。若需回退本子任务，只删除下述 P397 探针和数据，不动运行文件或用户存档。

文件清单：

- 探针：`tools/verify/probe-star-beast-late-stars-paid-p397.js`、`tools/verify/probe-star-beast-seven-paid-p397.js`、`tools/verify/probe-star-beast-late-pressure-p397.js`。
- 逐笔账本：`docs/codex/reports/data/p397-star-beast-star30-paid.json`、`p397-star-beast-seven-paid.json`、`p397-star-beast-star35-paid.json`。
- 实付存档：同目录 `p397-star-beast-star30-paid-save.json`、`p397-star-beast-seven-win-paid-save.json`、`p397-star-beast-seven-refilled-paid-save.json`、`p397-star-beast-seven-calm-paid-save.json`、`p397-star-beast-star35-paid-save.json`。`p397-star-beast-last-star-paid-save.json` 与 30 星终档同 SHA，`p397-star-beast-last-star35-paid-save.json` 与 35 星终档同 SHA，供原账本路径复跑。
- 压力明细：同目录 `p397-star-beast-star35-pressure.json`（已付存档）及 `p397-star-beast-late-pressure.json`（含未付款条件搜索）。
