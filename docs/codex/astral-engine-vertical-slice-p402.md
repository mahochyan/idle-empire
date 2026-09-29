# P402 星界时序引擎：450924 的实效接入

基线 `ba112c4224c13b8898a525abe5c559377a9fca52`（`master`）；本文件记录 P402 改动，最终提交 SHA 以仓库提交记录为准。另一 UI 美化任务的图片和候选资产未纳入本切片。

## 事实与决定

- 本地母本 `210(1)_unpacked/_analysis/entities_table.json` 的 `ents[450924]`：直接前置 `450224`，需知识 `100000000000`、勋章 `30000000`，解锁该研究自身。`deob_main.js` 的 `speedBtn100` 检查 `ScienceList[0x6e16c]`，成功时把 `BattleSpeed[0]` 设为 `0x64`（100）并调用 `savePlayer()`。这些文件是参考资料，不是我方运行代码。
- 我方已有对应 `450224` 的「星界圣痕兵装」`sci_astral_armament`，因此新研究命名「星界时序引擎」`sci_astral_engine`，放入长短两科技表，费用和直接前置按母本。当前没有可核实的引擎产能、仓容或战力效果，故只开放 100 倍战斗播放，不额外增益。
- 原本 `S.battleSpeed` 只在内存，按钮仅 1/2/4 倍且动作层不验权。100 倍按钮在研究前隐藏，点击动作 `setBattleSpeed` 再校验研究；选择成功才写存档，保存失败回滚并保持原主档。战斗与训练均通过现有 `queueBattleStep` 按 `delay / S.battleSpeed` 调度，不改伤害、敌人或奖励。
- 为遵循母本保存选择，主档升 v36 并新增 `battleSpeed`。新档默认 2，v35 及更早档在独立迁移候选上补默认 2，成功写回前由既有 `rts_save_premigration` 保存原文；v36 缺失、非法倍速或无研究却存 100 倍速均拒载并保护主档。研究解锁本身沿用已持久化 `sciences` 数组，不增加第二个权限字段。

## 验证

| 命令 | 结果 | 覆盖 |
| --- | --- | --- |
| `node --check config.js`, `math.js`, `ui.js`, `tests/progression/astral_engine_p402.js`, `tests/progression/astral_engine_browser_p402.js` | 退出码 0 | JavaScript 语法 |
| `node tests/progression/astral_engine_p402.js` | 退出码 0，6/6 | 配置、v35→v36 原文保护、单笔实付和重复动作、权限/保存失败回滚、坏档与未来档保护 |
| `node tests/progression/astral_engine_browser_p402.js` | 退出码 0，Edge 13/13 | 实际加载顺序、未研究伪点击、旧档浏览器迁移、真实按钮实付、100 倍选择与重载、训练首步 `840/100=8.4ms`、320/360px 无横向溢出、无浏览器异常 |
| `git diff --check -- config.js math.js ui.js index.html` | 退出码 0 | 差异空白检查 |

Edge 测试从 P401 已付兵装 v35 档加载，然后**在隔离浏览器夹具中**把Ⅱ–Ⅴ阶密卷使用数各设 500、知识设为 1000 亿、勋章设为 3000 万，验证真实 UI 的研究与保存路径。这只证明达到条件后的动作和首步计时；它不证明自然获得 2000 张高阶密卷、知识生产时间、1000 亿知识可付或后续奇点链已闭合。当前存档自然知识仓仍远低于该单笔门，整体成长曲线需主任务继续验证。

回退此切片须同时回退运行代码与版本号；**旧版运行代码读到 v36 主档会按未来版本保护，不能将“旧版忽略字段”当作无损回滚**。恢复旧版运行时，应先从 v35 独立迁移前副本或受控导出按已验证的迁移流程操作。
