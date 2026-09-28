# 人口状态 v4 存档迁移审计（2026-09-23）

本稿是只读审计与实施建议，不代表以下 v4 规则已经生效。基线为 `master`、`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；工作区原有 `config.js`、`math.js`、`ui.js` 等未提交改动，均未触碰。已读取 `AGENTS.md`、`CLAUDE.md`、`index.html`；实际加载顺序仍为 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js`（`index.html:1073-1082`）。本审计读文件时，人口仍由 `S.tick` 派生，存档版本选择仍在 `CFG.save.v3`；并行实现正在进行，实施者须以最终工作区重新核对行号。

## 现状与必须改变的路径

| 路径 | 当前事实 | v4 影响 |
|---|---|---|
| 新局/容量/人口 | `math.js:8-37` 的 `S` 没有实际人口字段；`math.js:73-87` 用 `S.tick` 和 **当前** `townLv` 反推人口，上限来自固定 `CFG.town[].maxPop`。 | 升城后旧 tick 追溯生人；离线 `offlineAdvanceSec()` 递增 tick 也补人。须改为独立持久化人数与在线增长进度。 |
| 保存/版本 | `serializeSave()` 在 `math.js:482-489` 手动列字段；`targetSaveVersion()` 在 `math.js:473` 由 `CFG.save.v3` 决定 v2/v3。 | 新人口字段必须进入序列化。读取 v4 的能力不能随人口玩法开关或旧 `v3` 开关下降，否则已写 v4 档被误判为未来档。 |
| 校验/迁移/应用 | `validateSave()` 约 `491-531`；`migrateSave()` 约 `534-558`；`applySaveToS()` 约 `560-563`。旧字段多用存在性补齐，合法 0 保留。 | v4 必须要求人口字段且严格校验；v0–v3 才补人口。迁移后的候选应再次校验，再一次性应用。 |
| 启动加载 | `loadSaveAndApply()` 约 `632-651` 已先验证原文，但在迁移前副本写失败及迁移主档写失败时仍会 `applySaveToS(m.d)`，然后进入只读保护。 | 与 `AGENTS.md`“成功前不能污染运行中的 S”冲突。候选对象转成待写文本，保护副本和主档成功后才应用 S；失败保留原 S、原文和只读保护。既有 `S08b` 测试目前期待内存先应用，需按新合同更新，不得用旧断言证明原子性。 |
| 备份/导入/恢复 | `writeSave()` 先 `backUpMaster()` 再写主档；`commitSaveData()` 先写 PRE，再备份，最后写主档；`restoreBackupByText()` 先检查文本。`commitSaveData()` 本身却不重新校验传入文本。 | v4 导入确认须再验证/迁移候选，不能只依赖 UI 先前的预览；任何失败不得改 S 或主档。`backUpMaster()` 读 backup_1 失败时目前继续写 backup_1，应视为失败，避免覆盖可能有效但暂时不可读的备份。 |
| 导出/重置/UI | `inspectSaveText()` 的摘要版本用常量 `SAVE_VERSION=2`，当前 v3 也可能显示 v2；`resetAllSaves()` 只列 4 键；`ui.js:868-944` 显示保护、导出、导入、恢复与重置。 | 摘要应显示原版与目标版/人口冲突；若增加专用 v4 原文副本，导出、重置确认和键列表都须覆盖它。 |

只读探针使用真实 `tests/progression/harness.js` 加载游戏实现，退出码 0：`tick=0, townLv=1, popAlloc=10` 时派生人口 4、容量 10；`tick=0, townLv=4, popAlloc=15` 时派生人口 4、容量 40；`tick=10, townLv=4` 时派生人口 26；`tick=3456, townLv=4` 时派生人口 40。这证明迁移不能简单把派生值当作全部旧档的真实可用劳力，更不能裁剪已分配人数。

## 推荐的 v4 数据合同

建议在 `S` 与存档中固定写入 `population:{count,progressSec,legacyCap,pendingLegacyCap}`。`count` 是实际人数，`progressSec` 是下次十秒增长已累计的**在线**秒数，`legacyCap` 是旧城镇体系已经取得的容量保底，`pendingLegacyCap` 是迁移时已付费、尚在计时的旧城镇升级完成后应兑现的容量（没有则为 0）。新聚落等级可用 `S.buildings` 中的新建筑键保存，不必另造第二份等级状态；新增键先进入 `CFG.buildings`，否则旧校验器会把合法建筑判作未知。新局 `population={count:0,progressSec:0,legacyCap:0,pendingLegacyCap:0}`、`popAlloc` 合计 0；若采用方案中的 30 启动地契，只给新局，老档缺 `res.deed` 仍补 **0**，已存 0 不得变成 30。数值名称可调整，但以下语义不能缺项。

1. **旧档迁移在候选副本中完成。** 无版本、v1、v2、v3 均按原有字段校验后补齐旧结构，再补人口并升到 v4；v4 缺 `population` 或字段非法须保护，不能当旧档补默认。只用 `in`/`??` 判缺，不用 `||`：`count=0`、`progressSec=0`、`res.deed=0` 均是合法值。旧人口配置若改变，应使用写明的旧版常量/旧城镇容量表，不以新的聚落上限反推旧人数。
2. **历史可用劳力采取不减员策略。** v0–v2 的代码 `popFree=maxPop−popAlloc`，没有增长人数；v3 才按 tick 派生，且档内没有保存当时 `CFG.pop.growth` 的开关值。因此严格无损无法精确重建每份 v3 档未分配的人数。保守规则是迁移所有 v0–v3 档时 `legacyCap=旧城镇等级对应旧上限`，`count=max(legacyCap,sum(popAlloc))`，`progressSec=0`。这可能一次性给部分 v3 旧档填满原有容量，但保证关闭过人口增长的档、tick 很低但已有分配的档不会失去原可用岗位；新局仍走从 0 开始的曲线。若产品改选 `max(旧 v3 派生值,sum(popAlloc))`，必须明确它是会减少部分功能关闭旧档未分配人口的取舍，不能称为无损迁移。旧 `popAlloc` 若为分数或其和溢出安全整数，应报冲突并保护原文，不能暗中取整。
3. **已经付费的城镇升级照常兑现。** 原 `townUpgrade`、计时、已扣的地契和科技点原样保留；迁移时若存在升级，记下旧表下一等级的 `pendingLegacyCap`，但不提前提高当前容量或实际人数。`advanceBuildingsBy()` 完成升级后将 `legacyCap=max(legacyCap,pendingLegacyCap)`，清零 pending；仍不直接给 `count` 加人。旧档已获得的 `legacyCap` 与当前人数即使高于新聚落公式也不裁剪；显示冲突并禁止新增分配，直至新容量追上。不能用 `maxPop=max(公式,count,已分配)` 隐藏超额冲突。
4. **v4 校验严格且不毁档。** `count`、`legacyCap`、`pendingLegacyCap` 为有限非负安全整数；`progressSec` 为 0–9 的整数（若十秒周期以后可配置，则以当版固定周期验证）；对象四键必备。`count>maxPop()` 或 `sum(popAlloc)>count` 是历史/配置冲突，保留值并阻止新增分配，不能在读入时 clamp。重复迁移后字段和值应完全相同，最多保存时间戳变化。
5. **增长只由在线事件推动。** `tick()` 的资源/粮食结算后，粮食充足才累计 `progressSec`，满 10 秒按当时规则增加 `count` 且不越容量。扩容只改变容量；不得再用 `S.tick`、`ts` 或更高的 `townLv` 重算已过去的十秒。`offlineAdvanceSec()` 可以继续推进经济与 `S.tick`，但不能推进 `progressSec/count`；离线写入失败的 `beforeState` 回滚也必须包含人口对象。达到十秒发生人数变化时应立即持久化，至少不让下一次普通自动保存之前的完整生人事件无声丢失。
6. **功能关闭与旧代码回退分开。** 关闭人口增长只暂停增长，不从 v4 存档删 `population`、`S.buildings` 聚落等级或已领记录；读写仍支持 v4。旧 v3 代码不能读取 v4 主档，且其旧 UI/旧模型无法表达新聚落进度；只能用升级前原文副本回退到当时进度，或编写经过校验的降级工具。不要声称“旧版忽略新字段即可安全回退”。

现有 `rts_save_premigration` 会被下一次迁移、导入或恢复覆盖。为保住已有 legacy→v3 原文副本，建议 v4 迁移另写独立 `rts_save_premigration_v4`，失败则中止升级；普通自动备份不得动它。若引入该键，`resetAllSaves()`、设置页的重置说明、导出/恢复入口和测试须一起更新。写入顺序为：读取并验证主档原文 → 在独立候选上迁移及复验 → 保存可手动导出的原始 v3 文本 → 备份可验证的当前主档 → 写候选 v4 主档 → 最后 `applySaveToS()` 和更新时间戳。任何一步失败均保留原主档、原运行状态，进入保护模式；不可将 `serializeSave()` 依赖已应用 S 作为先写后应用的理由，应提供候选序列化函数。需要注意 localStorage 不提供跨键事务：备份槽可能留下部分写入，但主档不得被覆盖，残留需在返回值与测试里如实体现。

## 精确修改点与测试

- `config.js`：新局人口、零初始分配、启动地契和聚落容量配置；保留旧版容量常量供迁移，玩法开关不控制可读存档版本。`index.html` 无需改脚本顺序。
- `math.js:8-115`：`S.population` 默认、`maxPop/popCurrent/popFree/popGrowthPer10s`、增长节拍与镇升级保底；`math.js:482-652`：序列化、严格校验、候选迁移、原子加载、备份与保护；`math.js:755-787,945-988`：离线不生人、在线每十秒事件；`math.js:801-850`：导入提交复验、原始 v4 前副本、定向重置；`math.js:1110-1135`：升级和新增岗位的实际人口/容量检查。
- `ui.js:28,57-105`：显示“已分配/实际/上限、粮食暂停、增长进度、历史超额冲突”；`ui.js:868-944`：v4 预览摘要、专用原文导出、重置键清单；`ui.js:1006-1012`：加载失败后 `settleOffline` 不得写档（现有 `_saveProtected` 闸口可保留）。
- `tests/ie001/run.js`：`S01/S02/S04/S05/S06/S07/S08b–g/S09/S10/S12b/R01/R02/F01–F06/C01–C03/L03–L06` 中涉及版本、字段集、原子加载、人口派生和重置键数的断言须按新合同修订；`F06` 的未来版本由 v4 改 v5，`W03` 的字段集增加 population。保留真正与新人口规则无关的旧安全断言，不以删断言求绿色。
- 新增真实函数回归：新档 0 人、30 地契与 0 分配；v0/v1/v2/v3→v4 各一次及二次幂等；旧 0 值、旧超额分配与 `tick=0`、旧城镇升级中；升级完工只增容量不追溯人数；粮尽暂停与恢复；在线十秒生人、离线 24 小时不生人；导入/恢复 v3 与 v4、未来 v5、坏 v4；PRE/备份/主档逐键写入失败和备份读取失败；功能关闭后人口/聚落等级往返；刷新和浏览器按钮冒烟。VM 存储替身不等于真实浏览器测试。

本审计只运行 `git status --short`、`git branch --show-current`、`git rev-parse HEAD`、`rg`/`Get-Content`/`git show` 及上述只读 Node VM 人口探针，命令均退出 0；没有运行完整回归或浏览器测试，也没有修改游戏代码。参考快照 `98571e38801f71bfdbb982a626e0e58f510abb98` 的实际提交日期为 2026-05-17，与 `AGENTS.md` 所述 2026-09-18 不一致；实施以本轮当前工作区为准。
