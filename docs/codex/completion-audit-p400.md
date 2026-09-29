# P400｜成长曲线验证收尾与未完成项

基线为 2026-09-30 `master` / `202dbda1d0e7085b84a5ad0b1dd653aa4fdd27d9`。本轮只扩展开发侧实战探针、逐动作账本和源节点审计，不修改玩家运行代码、UI 或美术；并行视觉任务的工作区文件保留原状。百关是高难主线，拓境是时代材料与发展线，人口保底不依赖关卡，前段机巧、后段西幻，原创新玩法仍后置。

| 《策划文档》§8.9 交付物 | P400 新证据及结论 | 判定 |
| --- | --- | --- |
| 母本证据与映射 | [后量子源节点](terminal-source-map-p400.md)核实 450124/224/924/025/125/225/325 的前置、费用和可见回调。450125/225 所见按钮无战斗／奖励回调，450325 有 20 万米深度和 5 张门票前置，但奖励未核实；不为它们编造收益。 | **部分**：后段区域回报和我方场景仍缺。 |
| 全依赖图 | [后量子同档实付](armament-natural-route-p400.md)从 P397 已付量子档支付 50 亿知识／500 万勋章研究，随后逐兵种攻击／生命各实付一级、真战胜利并重载，消除 P399 的条件夹具付款缺口。 | **部分**：1000 亿次元引擎、10 万亿奇点和后续区域仍无我方可付链。 |
| 全时代内容表 | P400 源地图明确 450924 可证效果只是 100 倍战斗播放；终局源 450325 还需额外 50 万亿知识／3 亿勋章。 | **部分**：终局区域、奖励、单位、城镇景及完整主题内容未完成。 |
| 数值账本 | [拓境村落](regional-essence-frontier-p400.md)在同一 43 人有价档连续赢 27 场，每胜实付补员，第 28 场首败；[四策略](four-strategy-l29-frontier-p400.md)各自到第 28 关并在第 29 关测出低阶阵容战力台阶。 | **部分**：跨时代同档净收益与更高区域材料供给尚未闭合。 |
| 曲线校准 | 四线第 21–28 关实胜，第 29 关 60 人及恢复后 70 人均败；经济线真付游侠 T1 后仍败。后量子 50 亿兵装自然路线有实付存在性，但等待时钟长。 | **部分**：银兵、T2、区域精魄、骑法等合法出口和全主线高难仍未验收。 |
| 美术与 UI 映射 | 本轮无玩家视觉改动，继续沿用 P399 青铜守卫动作及现有隐藏未解锁兵种规则；并行 UI 美化未并入本批。 | **部分**：后期西幻场景与全时代资产清单仍缺。 |
| 实施与兼容 | P400 不改变 CFG/S/B 或存档版本；探针从旧档迁移到 v34、记录迁移前原文、真实扣款、保存重载，运行文件前后散列一致。 | **本批证据通过；完整实施仍部分**。 |
| 50 小时及四策略 | 四份独立档到第 28 关；短会话线累计结算748,800离线秒。兵装路线在P397原档之后又累计模拟离线1,299,873秒、在线2,984秒，但不能与“有效游玩50小时”直接混同。 | **未完成**：没有全时代四策略与第 91–100 关全科技同档终局验收。 |

P400 的首败是给定低阶阵容和固定随机流下的**战力边界**，不是全玩家胜率或第 29 关不可通关。四策略未试银兵、T2、区域精魄或骑法组合；村落未试强化阵容和自然驻军。相应地，不据这些探针直接削弱百关主线或许诺拓境无限精魄。后量子路线的模拟离线累计与玩家主动操作时间是不同单位，仍需明确设计目标后按同档里程碑校准。

独立收尾回归在 Windows PowerShell / Node v24.19.0 / Edge headless CDP 下串行运行，实际退出码均为0：99/99 非浏览器进度脚本；`node tests/ie001/run.js` 96/96；`node tests/ie001/browser_smoke.js` 52/52；`node tests/progression/development_border_browser.js` 57/57；`node tests/visual/browser_smoke.js` 217/217、异常0；`node tests/visual/archer_t1_actions_browser.js bronze_guard` 26/26；`python assets/art/source/generated/units/actions/pack.py --check` 检查36套 full/compact 动作图集；`node tests/visual/assets.js` 检查60单位、53头像、9时代场景、42建筑。P400新增区域、四策略、量子兵装探针及语法检查也均退出0。拓境 Edge 用注入的研究/兵力夹具验证交互，不是自然成长证据。`config.js`、`math.js`、`ui.js`、`index.html`、`hd2d.js` 的前后散列完全相同。IE001 Edge 有一条临时 profile 清理失败日志，未影响游戏断言；视觉测试另生成6张青铜守卫 QA 截图，留在工作区且不并入本批。

99项脚本的实际集合由 PowerShell `git ls-files tests/progression/*.js` 取得，排除文件名含 `browser` 的脚本和 `tests/progression/harness.js`，对余下每个文件分别执行 `node $file` 并检查 `$LASTEXITCODE`；结果 TOTAL=99、OK=99、FAILED=0。专项命令另为 `node tools/verify/probe-regional-essence-sustainability-p399.js --paid-refill --attempts=50`、`node tools/verify/probe-four-strategy-l40-p400.js`、同命令加 `--tier1-economic`、`node tools/verify/probe-armament-natural-route-p400.js` 与 `node tools/verify/probe-armament-invested-p400.js`；这些以及对应 `node --check` 均退出0。此为 VM 逻辑回放，浏览器冒烟证据另列如上。

回退本轮只需移除 P400 探针、报告和隔离数据，并把区域探针恢复到固定 15 次版本；玩家 v34 主档没有被本轮工具覆盖。旧 v33 游戏代码仍不能直接读 v34 主档，若回退 P399 运行代码，必须先备份并核对恢复方案。Android WebView 真机、真实玩家操作耗时和随机驻军未验。本轮没有新的发布版运行文件。
