# P57 近战站位与神战边界复核（2026-09-24）

文档目标仍是先按《放置时代》成长骨干接通十时代难度与资源回流，像素美术和名称服务《放置帝国》：机械期使用工造、机巧、电磁，后期挑战使用神祇、神核等西幻语言。P56代码和真实付款已给出电磁步枪、狙击枪、电磁甲，但固定四团把蒸汽装甲兵放在中排，并据此记录警戒值3000失败。本批先复核站位，不改敌方强度或存档费用。

## 代码规则与本次决定

当前`math.js`的`isRanged()`只把弓／法视为远程；`getTarget()`在近战兵不在前排时返回`null`，驻军的`getGarrisonTarget()`也作相同判断。前排倒下后，`shiftRows()`／`shiftGarrisonRows()`会把中排推进前排，届时近战才可主动攻击。编队动作允许中后排放近战，这对预备承伤可用，但旧界面未说明其在该排时无法出手。P56中排装甲兵虽然持有蒸汽装甲枪，在前排仍存活时无法发挥输出；此前战败是**那一支编队**的结论，不能推为满级装备上界。

本批仅在远征／驻军编队卡和中后排编入弹窗说明「近战兵只在前排主动攻击；中后排待前排倒下推进后才可出手」，并在非前排近战候选旁标「在本排时无法主动攻击」。不禁止旧阵容、不自动搬兵、不调整战斗公式、装备加值、Boss倍率、奖励、人口、产速或`rts_save`。`index.html`缓存号V15→V16，脚本顺序仍config→levels→sprites→math→garrison→technology→ui；v24存档结构不变。开发探针加`--front-armor`、`--gold-reserve`两个显式对照参数，其中前者仅调用现有`openFormModal`／`confirmForm`把装甲兵放前排，后者逐级建黄金马厩、产金、排队招募黄金重骑兵，未给玩家代码新增兵种或数值。

## 同档实付战斗账

输入`%TEMP%\p56-armor3-paid-save.json`是P56从第45关真实旧档一路研究、锻造并重载后的v24快照：第5208578在线秒、杀戮警戒值3000、勋章169184、神核299、电磁甲3级、步枪和狙击枪各1级。探针固定`Math.random=0.5`并即时执行战斗回调；岗位生产、训练、装备、编队、胜利奖励和存档使用真实动作。单位分别为在线秒、兵员人数、生命、勋章与神核个数；战斗动画、真人点击和离线时钟未计。

| 同档路线 | 警戒值 | 出战人数 | 结果 | 战后入库 |
|---|---:|---:|---|---|
| P56原站位：合金／电磁前排，装甲中排，弓兵后排 | 3000 | 161 | 第21回合败，Boss余517/1034HP、我方余1人 | 无 |
| 仅把装甲改到前排，其余装备和人数不变 | 3000 | 161 | 第13回合胜，77人存活 | 勋章+1560、神核+39，警戒值→3100 |
| 同四团补员再战 | 3100 | 161 | 第21回合败，Boss余2HP、我方余1人 | 无 |
| 在此前胜利档实训青铜／铁／白银各15人，装甲仍前排 | 3100 | 206 | 第21回合胜，86人存活 | 勋章+1584、神核+39，警戒值→3200 |
| 同七团补员再战 | 3200 | 206 | 第24回合败，Boss余43HP、我方余1人 | 无 |

另一独立分支从同一输入实付步枪1→5级，逐次钢1万＋神核4共60次，合计钢60万、神核240，电磁兵攻击92→96；七团前排装甲路线仍止于3200，敌余24HP。沿该失败后的保档实付狙击枪1→3级，共26次、钢26万、神核104，攻击96→98；同七团3200再败，敌余8HP。新档内资源不足时先经现有岗位按秒积累，探针每步检查实际扣费和v24重载。这里的个位数敌血只说明该固定随机序列接近临界，不能说真实玩家胜率已达标，也不能靠伪造几次胜利推算80万勋章。

条件把黄金重骑兵替换入前排并未改善这组阵容：实付扩马厩、产金并补到40人后，步枪5级／狙击枪3级的3200战仍败，敌余335HP。该个案说明编队顺序和承伤变化会改变结果，不证明黄金兵总体无用。母本另有电磁兵三维`ArmsUP` 340008／341008／342008，配置每投入钢4000，源码`armsUP`满1000进度才升一星且付款还乘等级系数；本批没有把这些静态值直接写进我方，以免在军力公式和可负担性未校准时造出假增长。

复现主要分支（仓库根目录PowerShell，输入快照来自P56实付链，不属于仓库初始存档）：

```powershell
node tools/verify/probe-medal-stage45.js --save="$env:TEMP\p56-armor3-paid-save.json" --domain=medal --battles=30 --replenish --front-armor --electric-reserve=40 --snapshot-final="$env:TEMP\p57-front-armor-frontier-save.json"
node tools/verify/probe-medal-stage45.js --save="$env:TEMP\p56-armor3-paid-save.json" --domain=medal --battles=30 --replenish --front-armor --aux-reserve --electric-reserve=40 --snapshot-final="$env:TEMP\p57-front-armor-aux-frontier-save.json"
node tools/verify/probe-electric-gear-route.js --save="$env:TEMP\p56-armor3-paid-save.json" --key=electroRifle --target-level=5 --snapshot-final="$env:TEMP\p57-rifle5-paid-save.json"
node tools/verify/probe-medal-stage45.js --save="$env:TEMP\p57-rifle5-paid-save.json" --domain=medal --battles=30 --replenish --front-armor --aux-reserve --electric-reserve=40 --snapshot-final="$env:TEMP\p57-front-armor-rifle5-frontier-save.json"
node tools/verify/probe-electric-gear-route.js --save="$env:TEMP\p57-front-armor-rifle5-frontier-save.json" --key=electroSniper --target-level=3 --snapshot-final="$env:TEMP\p57-sniper3-paid-save.json"
node tools/verify/probe-medal-stage45.js --save="$env:TEMP\p57-sniper3-paid-save.json" --domain=medal --battles=1 --replenish --front-armor --aux-reserve --electric-reserve=40
```

六步均退出0；每步中的战斗失败行是实际失败结果，不是脚本失败。新交互经`node tests/progression/era_chain_browser.js`真实Edge/CDP在360／400宽度检查远征／驻军提示、两种弹窗候选和版宽，最终文案494/494退出0。首次回归曾有两次Edge/CDP响应超时，随后一次完整运行492通过、2项检查失败；修正时又核到中排会在前排倒下后推进，文案已写明，并在最终版重跑494/494。`node tests/ie001/run.js`96/96、`node tests/progression/electric_gear_chain.js`6/6、`node tests/progression/formation_identity.js`3/3、`node tests/ie001/browser_smoke.js`43/43，均退出0。`node --check math.js`、`ui.js`、`tools/verify/probe-medal-stage45.js`和浏览器脚本均退出0；`git diff --check`退出0，仅既有换行提示。Edge一度无法及时清除独立临时profile，浏览器验证本身退出0；实体Android/WebView尚未运行。

本地`master`基线／最终HEAD均为`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，原有大量未提交内容保留，未提交、推送或部署。参考快照`98571e38801f71bfdbb982a626e0e58f510abb98`实际Git日期2026-05-17，与AGENTS写的2026-09-18不同。AGENTS提到的`00_README.md`、`03_长期运营优化方案.md`、`04_实施计划.md`、`05_验证灰度与回滚.md`及未获得的`01_现状审计.md`、`02_对标拆解_放置时代可迁移机制表.md`目前仍不存在，本批没有声称读过。回退只撤本批编队文案、V16缓存号、探针参数、浏览器检查及v1.58/P57文档增量；v24存档无新字段或迁移，旧阵容和既有材料不需要转换。保留P56实付快照及本批胜利快照，勿用旧v23代码直接写回v24主档。
