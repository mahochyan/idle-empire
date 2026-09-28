# P87：远征／驻军共用余伤累积与十星攻击复核

- 日期：2026-09-24
- 分支／代码基线：`master` / `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`
- 代码最终 SHA：`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`（HEAD不变，本地工作区修改）

## 设计依据与本次改动

P86真实实付档显示，铁枪攻击从1星12点升至10星23点时，守御4500的12组固定种子仍都是47次命中／80点铁枪伤害。单次伤害公式含比例乘区，但其小数先被`Math.floor`抹去，再叠固定-3～+3整数扰动；高防和小兵团样本下，十星乘区经常无法落到实际伤害上。

本次保留原整数伤害下限、-3～+3扰动、暴击和随机调用顺序，只补偿向下取整遗失的raw小数：共同的`finalizeCombatDamage`在攻击者的本场战斗单位上累积小数余伤，累计满1时给本次伤害加1并保留余数。`math.js:calcDmg`与`garrison.js:calcGarrisonDmg`调用同一函数；余数只挂在B战斗单位，不写入S或`rts_save`。明确被格挡的0伤攻击仍消费原伤害随机步，但最终严格为0，避免旧公式在正向扰动时把“格挡”变成1～3点伤害。

曾以连续小数HP、移除最低伤害和整数噪声做过对照，但同一12种子样本的铁枪总伤从旧式80／80降到7.413／14.207，且部队总损兵由1412升至1450；这会无依据地重定整套伤害量级，因此未采用。当前余数方案更保守：完整保留旧整数伤害基线，只恢复被取整丢掉的部分。

## 实际战斗证据

使用P86同一铁枪十星付款v31快照，控制攻击星数为1或10，固定种子1～12，通过真实守御战斗异步回调各跑一组；各场战斗的奖励与损失均不写回快照。对照汇总：

| 公式版本 | 铁枪星数 | 命中次数 | 12场铁枪总伤 | 12场我方总损兵 | 守御胜场 |
|---|---:|---:|---:|---:|---:|
| P86旧取整 | 1 | 47 | 80 | 1412 | 0/12 |
| P86旧取整 | 10 | 47 | 80 | 1412 | 0/12 |
| P87余数累积 | 1 | 47 | 83 | 1465 | 0/12 |
| P87余数累积 | 10 | 47 | 92 | 1465 | 0/12 |

P87内，十星铁枪伤害在12组配对中均不低于一星，8组增加、4组持平；总伤增加9点（相对本组一星的83点约+10.8%），但仍没有突破守御4500。新旧公式两边总损兵累计相差53人，受到双方伤害余数累积和后续目标／随机路径变化影响；这组固定种子不足以评估全局难度，后续必须跨兵种、警戒值、阵型和胜负边界继续校准，不能宣称战损改善。

逐种子现行数据、上一批哈希固定旧数据和输入快照SHA见 [`p87-iron-arms-damage-precision.json`](reports/data/p87-iron-arms-damage-precision.json)。P86旧对照报告保持原样，SHA-256仍为`34174c5c18133842e93b30d048a4025d8fe6df427ccc744ef9407007e8f33370`。

## 验证、兼容和回退

新增`tests/progression/combat_damage_precision.js`直接调用真实远征／驻军伤害函数，验证12→23攻击的余数追加、两路相同输出、跨兵员生命阈值才扣人、明确格挡保持0，以及保存档不出现`damageRemainder`。

| 实际命令 | 结果 |
|---|---|
| `node --check math.js`、`node --check garrison.js`、`node --check tests/progression/combat_damage_precision.js`、`node --check tools/verify/probe-iron-arms-fractional-damage-p87.js` | 各退出0 |
| `node tests/progression/combat_damage_precision.js` | 3/3，退出0 |
| `node tests/progression/combat_guards.js` | 13/13，退出0 |
| `node tests/progression/combat_shield.js`、`node tests/progression/soldier_vitals.js`、`node tests/progression/formation_identity.js` | 7/7、4/4、3/3，均退出0 |
| `node tests/progression/garrison_settlement.js`、`node tests/progression/combat_async.js` | 6/6、5/5，均退出0 |
| `node tests/progression/arms_up.js`、`node tests/progression/arms_up_era.js` | 4/4、7/7，均退出0 |
| `node tests/ie001/run.js` | 96/96，退出0 |
| `node tests/progression/combat_shield_browser.js` | Edge/CDP 360／400px 8/8，无横向溢出或浏览器异常 |
| `node tests/progression/metal_browser.js` | Edge/CDP 360／400px 13/13；缓存V25、脚本顺序及资源页通过，无横向溢出／异常 |
| `node tests/progression/nuclear_browser.js` | Edge/CDP 360／400px 8/8；缓存V25、脚本顺序及核能兵营页面通过，无横向溢出／异常 |
| `node tools/verify/probe-iron-arms-fractional-damage-p87.js` | 重复运行退出0；报告SHA-256为`95c97b60e4967f38c121998d97bffc1d1dc42c6ee5c58c7f3d2c282a1e20a304` |
| `git diff --check` | 退出0；只有工作区既存LF／CRLF提示 |

本批未增加持久字段，存档schema仍为v31；因`math.js`／`garrison.js`有玩家运行代码改动，`index.html`缓存版本从V24升到V25，促使部署端重新获取脚本。缓存自检同步更新到V25。没有读取或写入用户浏览器主档；Node探针使用隔离VM，Edge烟测使用临时profile。P86路线档只作开发夹具，不能据此宣称新档可达或50小时曲线已通过。回退本批仅撤`math.js`／`garrison.js`余数结算、缓存号调整、专项测试、P87探针／数据与本报告／台账／策划增量；不触碰P86付款输入、用户主档、普通备份或迁移前原文副本。
