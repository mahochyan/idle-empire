# P217｜第 29 关固定流 8、9 的真实 Edge 败局复核

结论：P215 在 Node VM 中发现的前排逆序阵固定流 8、9 全损，已在真实 Edge 页面复现。两流的 HD2D 开启、视觉回退、以及从**同一浏览器形成的完整战前档**启动的 Node VM，初始兵团、随机调用次数与前 32 次值／调用点、首回合完整日志、胜败、回合、战损、奖励，以及仅删除 `ts` 的完整战后存档逐项一致。故这两条固定流的失败不是单由 Node 排序语义或 HD2D 视觉层造成；这仍不代表真实玩家胜率。

## 输入和页面路径

当前 `master`，HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。P201 `t2SecondBack73` 来源流 1 的第 29 关实付 73 人完整战前档 SHA-256 为 `ecec78193a69954510eaac3827bb9b5e2b8323691e9f08dbadb3571086f43e5f`；已经通关到第 28 关，拥有青铜刀盾兵 15、猎风弩骑 15、民兵 15、游侠 28。P217 在隔离的 Edge profile 通过本地 HTTP 加载当前 `index.html`，真实点击战斗页和编队弹窗，排成前排“民兵 15 → 猎风弩骑 15 → 青铜刀盾兵 15”、后排两个游侠团 13＋15。页面逐项检查槽位、可选兵种、库存、人数、资源、队列和第 29 关敌阵，然后保存重载。流 8、9 浏览器形成的战前档 SHA 分别为 `6822e56625a0a01d7f915ee6ed32129781c5b544a988a4491e1d9bc5dd9403ee`、`75ffa5760e7d84882ccd4f146a127fd2688cc1c102730b2555e448ff86209f25`；两档相互只差 `ts` 与新编队槽位的 `id`，作战业务状态相同。它们与 P214 来源流 1 的战前档也只差这些字段，因此不是补兵或资源注入后的新起点。

每条流的 HD2D 与回退场分别从该流同一完整战前档重载。页面真实点击 4 倍速并启动异步 `openBattle()`；回退场只在隔离页面令 `HD2D.mountBattle()` 返回 `false`。测试在旧档加载阶段冻结档内时间戳，加载后恢复时钟，暂停后台 `setInterval(tick)`，保留战斗 `setTimeout`。随机源为 P201/P215 的 xorshift32 `(flow*1009+29*9176)>>>0`，开战时随机调用均为 0。Node VM 复核直接加载这份浏览器形成的战前档，未另造阵容。无 CFG、战斗函数、资源、兵力、胜场或玩家存档改写。

## 逐流结果

| 固定流 | 三路径共同结果 | 随机调用 | 去 `ts` 的三路径完整战后档 SHA-256 |
|---:|---|---:|---|
| 8 | 败，第 3 回合，损 73／73；敌余 40 HP；无奖励、无战功 | 207 | `5d6d6900127a3812ba9c3ec8e1da7a22d848c89d253acb5fc956d373f7124534` |
| 9 | 败，第 5 回合，损 73／73；敌余 12 HP；无奖励、无战功 | 215 | `5d6d6900127a3812ba9c3ec8e1da7a22d848c89d253acb5fc956d373f7124534` |

两条败局都保留第 28 关为最高通关、`S.tick=19269`，士兵归零、编队清空。虽然敌余 HP 和回合不同，战后持久化状态相同，因此两行存档 SHA 相同。两流首回合各有 22 条攻击消息；流 8 首次出手是敌方侍从骑士，流 9 是我方猎风弩骑。Edge 与 Node 的这些消息及其顺序逐字相同；首个 RNG 调用都在 `math.js:3343:37` 同速洗牌，流 8、9 的首值分别为 `0.22427104087546468`、`0.3010317301377654`。前 32 次值与调用点、全程按调用点汇总也一致。四场 Edge 均无未捕获异常、console error 或缺失资源；HD2D 场存在画布与 `hd2d-active` 类，回退场二者均不启用。

P215 的同源逆序阵 Node VM 结果也分别为流 8 败／第 3 回合／损 73／敌余 40／207 次随机调用，以及流 9 败／第 5 回合／损 73／敌余 12／215 次随机调用；两流 22 条首回合攻击消息逐字一致。本报告**不**声称 P217 与 P215 的完整战后档逐字相同：P215 的 VM 编队战前档与浏览器新形成的档有编队 `id` 和时间等差异；完整存档相等断言仅针对 P217 内同一战前档的 Edge HD2D、Edge 回退与 Node VM 三条路径。

## 指纹、验证和边界

- 测试中的正式战斗源码 SHA-256：`math.js` `6335736ad922dd51b9f231e28cc286215074add83c74e0cc5b067baf3f449695`、`garrison.js` `c3793840886aac466dd25ede4ffd407adf726b618dee81d13f1c6c0f8970b167`。UI／视觉输入：`index.html` `94d2a7167e042a823b65756c746f59e93b4b716436d58d0787ced848dad1baf2`、`ui.js` `9c66de41bffdf8074656f004cf1f263d3945c3c1b1d23f98fd02ef5d9213314f`、`hd2d.js` `19ad4ce60deb9dbb270cc28212201238593606872d570a476124011870252636`、`visual.css` `7ea6939505c94b1cf6956e898fda9e7984ded63abc5a4819c38787bdecc96e0c`。JSON 记录全部 17 个输入指纹，探针在结算后再次核对它们，运行后只读复核仍全部相同。
- 环境为 headless Microsoft Edge `Edg/153.0.0.0`，独立临时 profile，`--enable-unsafe-swiftshader`；辅助 Node `v24.19.0`／V8 `13.6.233.17-node.51`。`index.html` 真正加载 Three、VFX、HD2D 及 `config → levels → sprites → math → garrison → technology → ui`，没有用 DOM VM 冒充浏览器结果。AGENTS 指向的参考快照 `98571e38801f71bfdbb982a626e0e58f510abb98` Git 日期实测为 2026-05-17，不是本批回退目标。
- `node --check tools/verify/probe-live-l29-browser-fail-p217.js`：退出码 0；`node tools/verify/probe-live-l29-browser-fail-p217.js`：退出码 0，真实 Edge 四场、Node VM 两场。运行后独立只读 SHA 审计覆盖 17 个输入、两份战前档和 12 份浏览器／Node 原文与去时间戳战后档检查，共 31 项，退出码 0。探针 SHA-256 `dff5ac0cd660d406a2aa0145c81d3accbb91e44f8928644a5186eba4e12e496c`，JSON SHA-256 `475ae67c46d7c5e1a6d55d23dc44764caf4aa7d52c06fbf8c0efc7593b71fc9b`。
- 本批只新增探针、JSON 和报告，未修改玩家运行代码、存档结构、策划文档、UI 或美术。它覆盖两条固定流和一份实付来源档，不覆盖 Android WebView、所有浏览器、全部关卡或玩家胜率；P214 已另测胜局流 1、15 和驻军。若并行 UI 后续改变，本报告只对上述冻结的视觉指纹负责，应以新版本重新跑探针。撤销 P217 只需移除这三份开发侧文件，保留共享工作区其他改动。

数据：[`p217-live-l29-browser-fail.json`](reports/data/p217-live-l29-browser-fail.json)。探针：[`probe-live-l29-browser-fail-p217.js`](../../tools/verify/probe-live-l29-browser-fail-p217.js)。
