# P402｜高阶密卷从已付兵装档的自然首张

日期：2026-09-30。输入是 [P400 已付兵装原档](reports/data/p400-armament-natural-invested-save.json)（v34，SHA-256 `e466af613d8048e4d68fb7993956a02491271c50c429a28775e0dad9222b2a9d`）。起始 Git HEAD 为 `ba112c4224c13b8898a525abe5c559377a9fca52`；并行任务正在改运行码，本探针最终回放时的 `config.js`／`levels.js`／`math.js` SHA-256 依次是 `30da1763fc2f7f7453438d263a667bea58c6acc11d67481d16272f5e1ffb1c0f`／`cec80c26fa91f941994c253a2fe73be0dfe3f108237620b662fdab9f5449fd1d`／`e6980084a1f9b0a7a42f25342abd3e8f475e2737b6dfc300004425b02c2bdd4a`。两段回放强制校验相同运行码哈希；不以 HEAD 代替未提交代码基线。仅新增本探针、报告及数据，没有改玩家运行码、UI 或策划。

本轮用 [`tests/progression/harness`](../../tests/progression/harness.js) 调真实 `loadSaveAndApply`、`openMaterialDomain` 与战斗回调、`refreshBeastExchange`、`exchangeWildMaterialForScrolls`、`exchangeTierScroll`、`useTierStorageScroll`、`upgradeEraStorage`，并独立重载终档。随机流固定为 xorshift32 种子 402；没有搜索其他种子、注入材料／库存／货位／兵力或改关卡。先实付领取现有货位，再打一次铁甲龟壳猎场，然后最多刷新十次，每次买得起的Ⅰ阶图纸并尝试最高可付高阶密卷。首段只有两张Ⅰ阶，故从其真实存档和 RNG 状态续跑最多二十次；第十四次总刷新拿到首张高阶，未跑满续段上限。脚本与逐次账分别在 [首段](../../tools/verify/probe-high-scroll-natural-p402.js)、[首段数据](reports/data/p402-high-scroll-natural.json)、[续段](../../tools/verify/probe-high-scroll-followup-p402.js)、[续段数据](reports/data/p402-high-scroll-followup.json)。所有在线时间为秒，存档 `ts` 为毫秒。

| 实际动作 | 付款与结果 |
| --- | --- |
| v34→当前 v36 载入 | 原文进入 `rts_save_premigration`，迁移成功；未丢已有Ⅰ阶已用 133 或猎场库存。 |
| 初始现有货位 | 铁甲龟壳 160→机巧拓仓图纸Ⅰ ×1。 |
| 铁甲龟壳猎场 | 实战胜利；敌首单位 HP 336；我军 673→533，损 140，未补兵；龟壳 +25，警戒 4000→4010。战斗随机、战损与掉落均走当前实现。 |
| 第一轮刷新 | 十次真实刷新、在线等待 5041 秒；首个刷新另付龟壳 160→Ⅰ阶 ×1；其余货位虽出现Ⅱ–Ⅴ阶，但手头两张Ⅰ阶未达到当轮实际报价。 |
| 同档续刷 | 四次真实刷新、再等 4800 秒；第十四次出现「圣界密卷Ⅲ」品质 50%，按 `ceil(4×0.5)=2` 消耗库存Ⅰ阶 ×2；实际兑换并使用Ⅲ阶 ×1。没有第二次猎场或补兵。 |
| 结果 | 总在线等待 **9841 秒（2 小时 44 分 1 秒）**、刷新 14 次。龟壳 511+25−160−160=216；Ⅰ阶库存 0，Ⅲ阶库存 0、已用 1；知识仓 **5,129,430,221→5,173,459,665**，增加 44,029,444；独立 v36 重载一致。 |

终档当前知识 `239,750,977`，量子知识仓研仍为 Lv7，下一笔真实报价为知识 4,000,000,000 与圣愈叶 4,800；圣愈叶现存 138。直接调用 `upgradeEraStorage('quantumKnowledge')` 返回 `insufficient-resources`，资源、等级和存档原文均未变化。当前 `prodRate('tech')` 为 24,354/秒，但这不是持续净速率保证，不能用它线性推演后续仓研时间。`materialDomainEncounter('revivalLeaf')` 只读预览当前警戒 4100 下下一战奖励 106 圣愈叶、敌首单位生命 2574、攻防倍率约 18.3；没有真打，不能把 106 张每场恒定或战胜率当成结论。单张Ⅲ阶证明高阶货位→Ⅰ阶材料→实付兑换→使用→仓容→重载链真实可通；不证明足量密卷、圣愈叶、1000 亿知识单笔费或更后期万亿级门槛可在目标 50 小时内达成。

验证命令：`node --check tools/verify/probe-high-scroll-natural-p402.js`、`node --check tools/verify/probe-high-scroll-followup-p402.js`、`node tools/verify/probe-high-scroll-natural-p402.js`、`node tools/verify/probe-high-scroll-followup-p402.js`，均退出 0。终档见 [v36 续段存档](reports/data/p402-high-scroll-followup-save.json)，原档哈希在探针末尾重核。VM 模拟 DOM 和定时器，只证明当前逻辑路径与存档持久化；此轮没有真实浏览器操作、不同种子统计或战后补兵付费验收。撤回 P402 只需删除本报告、两脚本和四份 P402 数据/存档，不应触碰共享工作区其它任务文件。
