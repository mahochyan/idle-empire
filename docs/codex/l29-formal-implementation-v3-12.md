# v3.12｜第 29 关法师波次试改与交付复查

第 29 关首次法师波次曾在两份已付 73 兵档的逆序前排固定流 8、9 中造成全军覆没；P218 的隔离试算显示，把法师三团由 `[13,10,6]` 缩为 `[11,8,5]`，是已测候选里减幅最小且让该阵型 16 条预设流全部获胜的一组。此批将该数值写入正式 [levels.js](../../levels.js)，并把早期军镇章节的关卡名／描述改为「帝国军校学徒／军校学徒随步弓骑混编，以法术支援前线」。步／弓／骑各团、Boss、奖励、战斗公式、人口和存档格式都未改；没有触碰并行的 UI 美化或素材。

## 本次改动与事实基线

| 项目 | 改前工作树 | 本次结果 |
| --- | --- | --- |
| 第 29 关名称／描述 | 学徒结社／强大的魔法能量涌动 | 帝国军校学徒／军校学徒随步弓骑混编，以法术支援前线 |
| 第 29 关法师三团 | `[13,10,6]`，29 人 | `[11,8,5]`，24 人 |
| 其余敌阵／奖励 | 步、弓、骑各 `[13,10,6]`；木 1403／石 1063／粮 975 | 保持原值 |
| 源 SHA-256 | `levels.js` `01f3d5caa2124e236b96c93c31090bf4e015c0b826a9f6662b56240960585c25` | `6762169e213dce8ce806fc08799c28a3431cf6f6dca2058d993ab56aab8f3e95` |

仓库为 `master`，基线／最终 HEAD 均为 `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；共享工作树原有大量未提交代码、文档、UI 与美术改动，均保留。`index.html` 当前业务脚本顺序确认为 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js`，视觉层加载在前。项目规则中的参考提交 `98571e38801f71bfdbb982a626e0e58f510abb98` 本地提交日期实际为 2026-05-17，与规则写的 2026-09-18 不一致；没有将其当作回退目标。背景方案不是实现证据。

修改清单：正式玩家配置仅 [levels.js 第 29 关](../../levels.js) 一行；[策划文档](../../策划文档.md) 升至 v3.12，保留历史版本并分记人口、难度和未完成项；新增 P225 T1 正式复核的 [探针](../../tools/verify/probe-live-l29-t1-formal-p225.js)、[数据](reports/data/p225-live-l29-t1-formal.json)、[报告](live-l29-t1-formal-p225.md)。同批只读验证还生成 [P223 Edge 报告](live-l29-formal-browser-p223.md)与[P224 T2 报告](formal-l29-l31-review-p224.md)，各有独立可复现探针和 JSON。P217／P218／P219／P220／P221／P222 属改前或隔离试算证据，不能被误写为当前正式配置的直接运行结果。

## 正式验收

| 验收项 | 实际结果 | 判定 |
| --- | --- | --- |
| 旧档直接载入新配置 | P223 旧 T2 战备档、P224 两份旧 T2 战备档、P225 两份从 L21 实付重建的旧 T1 战备档均 `loadSaveAndApply().status=ok`，可保存重载 | 通过，限上述档 |
| 正式数值与隔离预测 | P224 的 64 场 T2、P225 的 32 场 T1，胜败、回合、敌余 HP、随机次数和兵种战损逐场等于 `[11,8,5]` 隔离候选 | 通过 |
| T2 第 29 关 | 原阵 14/16 胜，流 8／14 仍全损；逆序阵 16/16 胜。四条旧档胜后可实付补兵并过 L30、L31；最重补军 1731 模拟在线秒，付款后粮最低约 0.064 | 局部改善，军粮仍脆弱 |
| T1 第 29 关 | 两来源各 11/16 胜，流 3／4／7／8／13 仍全损。流 2 胜损 65、实付补兵 1457 秒后胜 L30、L31；流 3 全损后补齐 1589 秒，同阵同流重试仍全损 | 未闭合 T1 失败出口 |
| Edge 真实页面 | P223 从旧档合法编队的流 1／8／9／15，HD2D、视觉回退和同档 Node 的首回合、随机轨迹、奖励及去时间戳完整战后档一致；八场 Edge 均显示「帝国军校学徒」、无异常或缺失资源 | 通过，限该四流与冻结视觉文件 |
| 章末职责和仓容 | 新 L29 初始 111 HP／1071 攻击质量，L30 Boss 49／641；P224 四路 L30 木实入 0、石实入 6，L31 一回合零损 | 未完成曲线设计 |

上述 16 条是预先规定的确定随机流，两份来源的同阵同流结算相同，不能换算成独立玩家样本或胜率。T1／T2 路线使用不同人口、岗位、军种和历史输入档，不能把两者的耗时当单变量比较。Node VM 的 `tests/progression/harness.js` 模拟 DOM、localStorage 与异步计时器，默认关闭 `garrisonTick()`；其模拟在线秒不含真实操作和离线时钟。P223 则为真实 Edge 页面，但仅测一份 T2 档四流，未覆盖 Android WebView、T1 浏览器或连续 L30→31。P220 曾在改前胜档复核随机驻军造成 0—8 秒补军延迟，此数不能直接转借到本次新胜档。

## 运行记录

下列命令本批实际运行，退出码均为 **0**：

| 命令 | 通过内容 |
| --- | --- |
| `node --check levels.js`、`git diff --check -- levels.js` | 第 29 关配置语法和已跟踪 diff 空白检查 |
| `node tests/progression/combat_order.js` | 同速洗牌与远征／训练／驻军 5 项 |
| `node tests/progression/combat_async.js`、`node tests/progression/combat_guards.js`、`node tests/progression/garrison_settlement.js` | 异步写回 5 项、动作守卫 13 项、护盾／战损／驻军 6 项 |
| `node tests/progression/campaign_enemy_units.js`、`node tests/progression/campaign_enemy_labels.js`、`node tests/progression/industrial_theme_names.js` | 百关敌阵初始化、标签与主题命名 |
| `node tests/progression/cavalry_wind_semantics.js`、`node tests/progression/population_first_clear_reward.js` | 骑兵能力 15 项、拓居令与保存 6 项 |
| `node tests/ie001/run.js` | 存档、迁移、0 值、未来档拒写、离线与经济等 96 项 |
| `node --check tools/verify/probe-live-l29-formal-browser-p223.js`、`node tools/verify/probe-live-l29-formal-browser-p223.js` | 8 场 Edge + 4 场同档 Node；45 项 SHA／名称／结算复核，见 P223 报告 |
| `node --check tools/verify/probe-formal-l29-l31-p224.js`、`node tools/verify/probe-formal-l29-l31-p224.js` | 64 场正式 T2、4 路付费续关；40 项 SHA 与链接复核，见 P224 报告 |
| `node --check tools/verify/probe-live-l29-t1-formal-p225.js`、`node tools/verify/probe-live-l29-t1-formal-p225.js` | 32 场正式 T1、两路付费恢复／续关；探针两次输出相同 JSON SHA `4c8e23b072201bea36b7d1083d44247b0254933aea5abae57c2f8d5a4383819d` |

P223 使用的并行视觉输入 SHA 中 `hd2d.js` 为 `bc3d274cadf3b80017fd18985485d93c6a42295f52a82e5fa15c4892c760c758`；若其它 agent 之后继续修改页面或视觉文件，P223 仅证明当时冻结版本的浏览器一致性。未运行 Android 实机，未验证全历史存档、全随机空间、离线补军、实时驻军对新胜档的影响。未发现本次所列检查的新增失败；改前 P215／P218 等探针若含旧 `levels.js` SHA 守卫，现应作为历史记录，不能直接重跑并把守卫失败误报为游戏回归。

## 存档、风险与回退

本次不增加 `S` 字段，不变更 `rts_save` 序列化／迁移，也不追发或删除旧胜场和奖励。旧档读取的是新关卡配置；玩家在改前已经通过第 29 关的进度照旧留在档中。实测兼容范围是 P223/P224/P225 指明的旧战备档与新生成检查点，不能推及所有历史格式。第 29 关胜败改变会让随后战损、奖励与补兵轨迹改变，属于有意的玩法数值变化，不应把旧结果直接拿来断言新结果。

最大的未解问题是 T1 仍有五条固定流全灭，T2 原阵仍有两条；一次重兵损失后粮食可降至接近零，第 29 关依然比第 30 关 Boss 更强，关底木石奖励在所测高库存路线被仓容截断。完整的多策略人口—岗位—材料—军粮—战斗曲线尚未验收，原创玩法保持后置。

本地回退仅恢复 [levels.js 第 29 关](../../levels.js) 为原名「学徒结社」、原描述「强大的魔法能量涌动」与法师 `[13,10,6]`，保留本轮之前的其它未提交修改；[策划文档](../../策划文档.md)的 v3.12 与 P223—P225 报告可保留为变更记录并标明已回退。回退后应重跑战斗／存档测试及目标旧档，不能把“旧代码忽略新字段”当成普遍回退安全承诺；本次本身没有新字段。未提交、未推送或部署。
