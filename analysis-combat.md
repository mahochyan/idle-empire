# 战斗与难度数值系统逆向报告

> 目标：`_analysis/deob_main.js`（3.0MB 单行，反混淆文本，**从未执行**）
> 字符串经 `deob_main_strings.json` 解析；数字均为十六进制字面量（下文已全部转十进制）
> 计算类成长曲线全部来自 `Math["pow"]` / `Math['pow']` 共 13 处（其中 11 处为玩法、2 处为 gsap 缓动）
> 所有【推断】标记为无直接代码证据、仅由数据结构或命名推断的结论
> 分析辅助脚本：`_analysis/curve0.js`(正则/切片) `curve1.js`(方法表) `curve2.js`(阶梯函数解析) `curve3.js`(brace 匹配+hex→JSON) `curve4.js`(表规范化+提取) `curve5.js`(曲线拟合) `curve6.js`(补查) `curve7.js`(七日网格)；产物 `db_base_norm.json` `db_cfg.json` `out_*.txt`

---

## 0. 顶层结论（一句话）

**伤害 = 减法护甲模型**：`基础 = max(ATK − 有效防御, 0.2·ATK)`（保留 20% 破甲保底），再连乘暴击/增伤/易伤百分比、护甲减免（上限 90%）、真伤独立通道；命中/暴击/格挡为**减法概率 + 分段随机种子**判定。**怪物成长 = 基表 × 品质百分比 ×(1 + 杀戮值线性加项)× 杀戮值阶梯倍率**，杀戮值阶梯倍率是**超指数橡皮筋**（×1→×180）。七日战争为**多因子连乘（节点base × 品质degree ×(1+战力/100)× 战力分段 × 信仰对立 pow(1.33,ratio)）**，对立比越悬殊难度爆炸。

---

## 1. 伤害管线总览

偏移锚点（方法定义 `'key':"name"`）：

| 方法 | 偏移 | 作用 |
|---|---|---|
| `hurtValue` | @2497443 | 伤害分发总入口，按 `hurtType` 分流 |
| `hurtCalc` | @2498425 | 双护盾吸收 → 扣血 |
| `adHurt` | @2499273 | 物理（hurtType 1/5） |
| `apHurt` | @2501468 | 魔法（hurtType 2） |
| `tHurt` | @2503657 | 真实伤害（hurtType 3） |
| `fixHurt` | @2504172 | 固定伤害（hurtType 4） |
| `isDodge` | @2504237 | 命中判定 |
| `isCrit` | @2504684 | 暴击判定 |
| `isBlock` | @2504961 | 格挡判定 |
| `attack_process` | @2582049 | 单次攻击流程（闪避→格挡→暴击→伤害→护盾） |

### 1.1 分发结构 `hurtValue` @2497443
```
switch(hurtType){ 1→adHurt, 2→apHurt, 3→tHurt, 4→fixHurt, 5→adHurt(再分支) }
```
证据（@2497619~2497901）：`this["adHurt"](...) : ... this["apHurt"](...) : ... this["tHurt"](...) : ... this["fixHurt"](...)`。配置端 `db_cfg` 攻击技能表 7101001~7103xxx 全部 `hurtType=1, atkPer=1, atkCount=1`（普攻/将魂技能基线），说明 hurtType 由具体技能/词条配置注入。

### 1.2 物理伤害 `adHurt` @2499273（原文节选 @2499xxx~2501xxx）
```
defPer = cfg[id].defPer                       // 兵种护甲生效系数(百分比)
PPenEff = clamp(PPenEff,0,1); XPenEff=clamp(...)     // %穿甲(物/混)
effDef = max(0,(pDef − PPenValue − XPenValue)·(1−PPenEff)·(1−XPenEff)·defPer)
if(penFlag==1) effDef=0                        // 破甲标记：防御清零
if(target.iceFlag==1) effDef=0                 // 冰冻：防御清零
if(!blocked){                                   // 未格挡
    base = max(ATK − effDef, 0.2·ATK)           // ★减法+20%保底
}else{                                          // 格挡分支
    BlockEff = clamp(BlockEff, 0.2, 0.7)
    base = (crit?1.2·ATK:ATK − 2.5·effDef)·(1−BlockEff) − (0.25·effDef + BlockValue)
    base = max(base, 0.1·ATK)                   // ★格挡后仍保底 10%ATK
}
critMult=1; critVal=0; if(crit){critMult=max(CritEff,1.2); critVal=CritValue}
D = base
  ·(1+HurtPer)·(1+HurtPer2)·(1+PHurt)          // 增伤%（三条独立）
  ·(1+DeepEff)·(1+0.1·tearFlag)                 // 深海增伤 + 撕裂(每层+10%)
  + CritValue
D = D·max(HurtR补,0.3)·max(HurtR2补,0.3)·(1−PHurtR) + DeepValue   // 减伤%各保底0.3
D += PExValue; D −= PReValue                    // 附加/减免固定伤
D ·= cfg[id].atkCount                           // 攻击段数(多段)
armorCut = clamp(armor − penetrate, 0, 0.9)     // ★护甲减伤上限90%
D ·= (1 − armorCut)
if(campID==0 && keyCount[1]==2) D·=0.8          // 新手/特定关卡 20% 削弱
return max(0, floor(D))
```
> **关键：`max(ATK−def, 0.2·ATK)`** 是"减法护甲 + 20% 强制穿透保底"，**不是** `def/(def+K)` 的 diminishing 模型。格挡时护甲改按 `2.5×` 权重参与且额外扣 `BlockValue`。`armor` 是另一层独立百分比减伤（与 def 分开），上限 90%。

### 1.3 魔法伤害 `apHurt` @2501468（原文 @2501xxx）
与 adHurt 同构，差异：
- 用 `mDef` / `MPen*` / `MHurt` / `MHurtR`（魔抗通道）
- 格挡公式**完全一致**（也用 2.5·effDef、BlockEff、BlockValue）
- 多一个易伤 buff：`hurtFlag==1` 时遍历 `buffList2`，对 `uniqueName=="hurtFlag"` 的 buff 叠层，`×(1+0.1·stack)`（每层受击 +10%）
- 结尾 **无** armor 层、**无** campID 削弱、**无** `Math.floor`（保留浮点），且 `return max(0,D)`

### 1.4 真实伤害 `tHurt` @2503657（原文全文）
```
D = ATK ·(1+HurtPer)·(1+HurtPer2)·(1+THurt)
      ·max(1−HurtR,0.3)·max(1−HurtR2,0.3)·(1−THurtR)
return max(D, 1)
```
真伤**绕过所有防御/护甲/格挡/暴击**，仅吃"最终增伤%(HurtPer/HurtPer2)"和"最终减伤%(HurtR/HurtR2/THurtR)"，保底 1 点。

### 1.5 固定伤害 `fixHurt` @2504172
```
function(x){ return x; }   // 原样返回传入值，无任何修正
```

### 1.6 双护盾吸收 `hurtCalc` @2498425
逐字原文（见附录 A2）：若 `shield1<=0&&shield2<=0` **或 hurtType∈{3,4,5}** → `hp -= D`（**真伤/固定伤/type5 完全绕过护盾直扣血**）；否则若 `shield1+shield2 >= D`：`shield2 -= D`，溢出量 `abs(shield2)` 转入 `shield1`，末置非负；护盾总量不足时走 else 直接扣血分支。
```
shield = shield1 + shield2
if((shield1<=0 && shield2<=0) || hurtType∈{3,4,5}) hp -= D     // ★真/固/5 穿盾
else if(shield >= D){ shield2 -= D; if(shield2<0){ shield1 -= abs(shield2); shield2=0 } }
```
护盾优先级 **shield2（外层）先于 shield1**，溢出穿透。**hurtType 3/4/5 无视护盾**是与 §1.4 真伤定位一致的关键数值决策。

---

## 2. 命中 / 暴击 / 格挡（概率判定）

统一使用带种子的分段 RNG `battleHandle.per(p)`（@1011987）：`per(p) = (seededIntCeil(100) <= p)`，即掷 1~100 均匀整数，`<=p` 为真。种子 `player.perSeed[i]` 按用途分通道（0x3=通用, 0x4=千分, 0x9=将魂, 0x5/0x6=万分/十万分），保证伪可复现。

| 判定 | 偏移 | 公式（hex→dec） |
|---|---|---|
| **命中** `isDodge` | @2504237 | `hitFlag==1&&dodgeFlag==0 → 必中`；`dodgeFlag>=1` 消耗一层并强制可被闪避；否则 `p = max(Hit − Dodge, 0.3)`，`return !per(p)`（闪避概率 = 1−p） |
| **暴击** `isCrit` | @2504684 | `critFlag==1 → 必暴`；`hurtType∈{3,4}(真/固定) → 永不暴`；否则 `return per(Crit − CritR)` |
| **格挡** `isBlock` | @2504961 | `hitFlag==1&&blockFlag==0 → 不可挡`；`hitFlag==0&&blockFlag==1 → 必挡`；`hurtType∈{3,4} → 不可挡`；`p=min(Block − BlockR, 0.7)`，`return per(p)`（**格挡概率上限 70%**） |

> 概率均为**攻防减法**（`攻方属性 − 守方抗性`），再夹到 `[0.3, ...]` 或 `[..., 0.7]`。闪避率、格挡率、暴击率都靠"堆攻方命中率抵消守方闪避"实现收益递减。

### 2.1 攻击流程 `attack_process` @2582049（异步 generator 节选 @2582xxx~2583xxx）
```
atkBeforeTime 技能 →
if(isDodge) { 飘"闪避"(blue); dodgeTime 技能; return }   // 闪避直接结束
if(target.hp<=0) return
是否格挡 = isBlock; 是否暴击 = isCrit
D = hurtValue(type, ATK·atkPer, ...)                      // 见 §1
hpBefore=hp; hurtCalc(D) → 计算实际掉血(hpBefore−hp)
加仇恨值 damageValue; 触发 killTime/hurtedTime 技能
```

---

## 3. 战斗单位属性装配

### 3.1 单位实例 `getFighter(id, per=1)` @2618102（原文节选）
```
f = new Fighter()
f.maxHp0 = getMaxHp(id) · per      // ★难度倍率 per 直接乘进基础值
f.atk0   = getAtk(id)   · per
f.pDef0  = getPDef(id)  · per
f.maxHpEnter = f.maxHp(); f.atkEnter = f.atk()   // "进场值"快照(供技能引用%)
f.armor = getArmor(id); f.penetrate = getPenetrate(id)
f.attackNormal = cfg[id].attackNormal            // 普攻技能id(7101xxx族)
```
调用点：`getFighter(id, _0x64742)`（@2612798 等 7 处），`_0x64742` 即 `getPer()` 返回的七日难度倍率。→ **七日难度是"把怪物基础三维整体乘 per"**。

### 3.2 三维合成公式（含 Buff 层）`attri(type)` @2505xxx
```
atk = (atk0·(1+atkPer) + atkValue)                       // 第1层:基础+加法
        ·(1+atkPer3)                                      // 第2层:独立百分比乘区
        ·(1+atkPer2) + atkValue2                          // 第3层:二次加区
        (+atkDis)·(1+atkDisPer)                           // 距离衰减
atk = max(0, floor(atk))
```
四维 atk/pDef/mDef/speed 共用此三段式：`基础×(1+每层%)×(1+独立%)×(1+二级%)+固定值`。maxHp 独立：`maxHp0·(1+per)+value)·(1+per2)+value2`。

### 3.3 兵种子属性 getter（@2440293~2446231，均为 `get + X + Init`）
`Hit/Dodge/Block/Crit/CritR/CritEff/PHurt/MHurt/THurt/MoreAtk/Revive/armor/penetrate/defPer/atkCount/atkRange`。基表来源 `db_cfg` 兵种卡（如 6101001 轻步兵 `{unitType:1, armor:0.2, attackNormal:7101001}`；6101004 重甲兵 `armor:0.6`；6101003 长枪兵 `penetrate:0.3`）。**armor 是兵种固定值 0~0.6**（0.6=减伤 60%），penetrate 抵消之。

---

## 4. 怪物生成公式（四套 + 扩展）

生成入口分布 @1383847~1402700（`fmt_mon.txt`）。全部结构：
```
Stat(base) = cfg[tpl].Attri.X                        // 模板基础三维
           × cfg[quality].X / 100                     // 品质百分比(善/普/恶 or pageLv)
           × (1 + cfg[580000].AddX/100 · killValue/100)   // 杀戮值线性加项
           × getKillPerMonster(killValueID)           // 杀戮值阶梯倍率(橡皮筋)
```
| 生成器 | 偏移 | 用途 | 特有项 |
|---|---|---|---|
| `getMonsterDataS` | @1384320 | 小型战(郊外) | 品质=evilID[善590001/普590002/恶590003]，Num 加权 |
| `getBossDataS` | @1386048 | 小战Boss(郊外异兽) | 单体高倍 |
| `getMonsterDataM` | @1387468 | 中型战(边疆) | evilID[坚/怨/怒] |
| `getMonsterDataB` | @1389106 | 大型战(外域) | bigWarLv 层 |
| `getBossDataB` | @1390808 | 大型战Boss | — |
| `getMonsterDataGod` | @1392326 | 神域 | 见 §4.1 |
| `getMonsterDataGod_SS` | @1393978 | 神域·终 | 逐级**线性**加值 |
| `getMonsterData_superGod` | @1396587 | 超神 | **全维 ×2^(killValue/10000)**（基表 id=540099） |
| `getMonsterData_general` | @1397261 | 将魂异兽 | HP×1.4^n, ATK/DEF×1.2^n, Num×1.3^n（n=KillValue/1000） |
| `getMonsterData_superWar` | @1399240 | 超战 | ATK×1.1^n, HP×1.2^n |
| `getMonsterData_OldSun` | @1400466 | 旧日远征 | `getMeterPer×getMeterLvPer×getShowLvPer` |

### 4.1 神域超神 superGod（唯一含 `Math.pow` 的怪物倍率，@1396587）
```
per = Math.pow(2, killValue/10000)     // 每 10000 杀戮值 全维×2
```
基表 id = `0x83dc3` = **540099**（`db_cfg` 主神模板）。→ 杀戮值 1 万时 ×2，2 万时 ×4……**指数橡皮筋**。

### 4.2 将魂异兽 general（@1397261）
```
n = KillValue/1000
HP  = base·1.4^n      ATK = base·1.2^n
DEF = base·1.2^n      Num = base·1.3^n
```

### 4.3 旧日远征 OldSun（@1400466 + §7）
`per = getMeterPer(meter) · getMeterLvPer(meter) · getShowLvPer(lv)`，见 §7.2。

---

## 5. 杀戮值（KillValue）动态难度 — 橡皮筋核心

`getKillPerMonster` @1373493 为**阶梯查表**（`out_stepfuncs.json` 解析结果，from~to→倍率）：

| 杀戮值区间 | 怪物倍率 | | 区间 | 倍率 |
|---|---|---|---|---|
| 0~499 | ×1（基线） | | 3000~3499 | ×4 |
| 500~799 | ×1.2 | | 3500~3999 | ×5 |
| 800~999 | ×1.4 | | 4000~4499 | ×6 |
| 1000~1499 | ×1.6 | | 4500~4999 | ×7 |
| 1500~1999 | ×1.8* | | 5000~5999 | ×10 |
| 2000~2999 | ×3 | | 6000~ | ×20 |
| — | | | 7000 / 8000 / 9000 | ×30 / ×40 / ×50 |
| 后续段 | 60→70→80→90→100→120→140→160→180（至 13000） | |

（*1500~1999 段源码有重复分支 1.8 与 2.2，2.2 为死分支）

`getKillPerReward` @1375671 **封顶约 ×8** → **怪物变快变强、奖励增长封顶**，这是"进度随杀戮值指数放缓"的核心闸。合成曲线（`curve5.js`，AddATK=5）：

| 杀戮值 | killPer | 综合 ATK 倍率 |
|---|---|---|
| 0 | ×1 | 1.0 |
| 1000 | ×1.6 | 2.4 |
| 3000 | ×4 | 10.0 |
| 5000 | ×10 | 35.0 |
| 8000 | ×40 | 200.0 |
| 12000 | ×140 | 980.0 |
| 13000 | ×180 | 1350.0 |

`killValue 580000`：`{Init:0, Rate:[4000,2000,1000,0], Value:100, AddHP:5, AddATK:5, AddDEF:5, AddAmount:15, GetPer:40}`。

---

## 6. 七日战争（Seven War）难度曲线 — 多角度

### 6.1 节点解锁链 `isShowMonster` @1438845（原文 @2882071 同族）
节点：魔王 8101001~8101007（七宗罪：路西法/傲慢→阿斯莫德/色欲），天使 8102001~8102007（七美德）。解锁条件：`前一节点 battleValue >= 1000` **且** 对立信仰战力比 `ratio >= {1.6,2.5,3.5,4.5,6}`（镜像适用于天使）。→ **想挑战更强阵营，必须把对立阵营刷到 1.6~6 倍战力**。

### 6.2 战力对立曲线（唯一直接 pow 难度，@1440464 / @1440709）
```
getFiendWarPer / getAngleWarPer:  Math.pow(1.33, fiendVal/angleVal) − 0.33   // 攻击加成
getFiendMedalPer / getAngleMedalPer: Math.min(Math.pow(1.2, ratio) − 0.2, 5) // 勋章加成(封顶5)
   且 ratio>10 时 → 强制回落为 1   // ★过度偏向一方反而奖励归零(逼均衡)
```
| ratio | 攻击 pow(1.33,r)−0.33 | 奖励 min(pow(1.2,r)−0.2,5) |
|---|---|---|
| 1.0 | 1.00 | 1.00 |
| 1.6 | 1.53 | 1.15 |
| 2.5 | 2.60 | 1.93 |
| 3.5 | 3.97 | 2.90(封顶前) |
| 4.5 | 5.85 | 4.00 |
| 6.0 | 9.85 | 5.00(封顶) |
| >10 | — | **1.00(重置惩罚)** |

`getMedalDay = floor(1.5 · battleValue · medalPer)` @1441586。

### 6.3 总难度倍率 `getPer` @2615038（原文全文，最关键的合成器）
```
per = 节点base{ 8101007/6=1, 1006/6=1.2, 1005/6=1.5, 1004/6=1.8, 1003/6=2.2, 1002/6=2.5, 1001/6=5 }
per *= cfg[lvID].degree                              // 品质等级倍率(见6.4)
per *= 1 + 0.1·floor(battleValue/100)                // 战力线性: 每100战力+10%
per *= bracket(battleValue)                          // 战力分段台阶:
     bv<1000→1 | <3000→1.2 | <10000→1.3 | <30000→1.4
   | <50000→1.5 | <70000→2 | <95000→3 | else→10000  // ★95k后暴涨1万倍(数值爆炸墙)
if(fiend/angle>=10 || <=0.1) per *= 10000            // ★极端偏向→难度墙×10000
per *= (本阵营占优时 getFiendWarPer/getAngleWarPer)  // 见6.2
```
网格计算见 `out_seven_grid.txt`。单节点（阿斯莫德 base=1）随战力增长：

| battleValue | 合成 per |
|---|---|
| 1000 | 2.4 |
| 10000 | 15.4 |
| 30000 | 46.5 |
| 50000 | 102.0 |
| 70000 | 213.0 |
| **95000** | **9.6e5**（跨入 ×10000 墙） |
| 120000 | 1.21e6 |

→ **95k 战力是一道人为数值墙**：跨过前难度线性可控，跨过瞬间 ×约4500，是典型的"付费/练度检查点"。

### 6.4 品质等级 pageLv 9101001~9101015（15 级难度，`db_cfg`）
| id | chName | degree | rewardPer | limitNum(门槛) | rateQ |
|---|---|---|---|---|---|
| 9101001 | 有手 | 1 | 1.0 | 0 | 500 |
| 9101002 | 容易 | 1.2 | 1.1 | 0 | 1000 |
| 9101003 | 简单 | 1.5 | 1.2 | 0 | 800 |
| 9101004 | 普通 | 3 | 1.3 | 1000 | 500 |
| 9101005 | 困难 | 5 | 1.5 | 2000 | 300 |
| 9101006 | 专家 | 7 | 1.6 | 4000 | 200 |
| 9101007 | 极限 | 8 | 1.0 | 6000 | 250 |
| 9101008 | 至暗 | 13 | 2.0 | 10000 | 100 |
| 9101009 | 深渊 | 20 | 2.5 | 20000 | 50 |
| 9101010 | 噩梦 | 22 | 2 | 30000 | 50 |
| 9101011 | 炼狱 | 35 | 2 | 50000 | 30 |
| 9101012 | 绝境 | 60 | 2 | 100000 | 20 |
| 9101013 | 折磨 | 120 | 2 | 300000 | 10 |
| 9101014 | 无解 | 500 | 2 | 500000 | 5 |
| 9101015 | 归零 | 5000 | 2 | 1000000 | 1 |

`degree` 增长：1→1.2→1.5→3→5→7→8→13→20→22→35→60→120→500→5000（**尾部 ×100 跳变，归零=×5000**，几乎不可能自然通过）。`rateQ`=随机权重（越高越常出现），`limitNum`=玩家战力门槛。

### 6.5 七日节点全字段（`db_cfg` 8101001 路西法）
```
{race:1,color:1,rateQ:100, heroList:[8201007,1], frontList:[8203007,20], backList:[8202007,10],
 warMax:[8,4], reID:1101017, char2:"傲慢", limit:50000,
 NeedHP:300, NeedATK:30,          // ★推荐战力门槛(进关检查)
 HP:150, ATK:25,                   // 每档成长基
 HPper:1000, ATKper:1000,          // ★每1000档 = +100%(线性1:1成长)
 rand:54, generalID:330081}
```
`HPper/ATKper` 消费点 @1521827（`armyList[...]["HPper"]/100`）：HP 线性加成 `base·HPper/100·flag`。`limit:50000` 是该节点每日战力封顶。

### 6.6 精华喂料成本 `jingNeed` @2032938（`curve5.js` 计算）
`cost_i = 10·(i+1)·2.5^i`（i=等级）：
| i | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| 成本 | 10 | 50 | 187 | 625 | 1953 | 5859 | 17090 |
→ **2.5 指数喂料墙**，是七日战争养成（rune/angle-fiend）的主要时间闸。

### 6.7 刷新次数（免费+付费刷新的证据）
- `battleRefresh001` @1442105：随 `getAllValue` 5→7→9→12→15→20→25→30→40（免费刷新上限随进度增长）
- `battleRefresh002` @1442642：1→2→3→4→5（第二货币刷新）
- `getAngleWarPer` 与 `rewardPer` @1442980：`(1+0.1·floor(bv/100))·{≥1000:1.2,≥5000:1.5,≥10000:1.8,≥20000:2.2,>50000:2.5}`
- `sevenDay()` @2021716：每日从 `cfg[910]`(品质) 按 rateQ 且 `getAllValue>=limitNum` 门控 roll `lvID`；从 `cfg[810]`(节点) 按 `isShowMonster`+rateQ roll `monsterID`。
- 时间重洗/回退 `reBack` @2026783【推断为"回溯/重置"付费点，用于重置七日进度重刷奖励】

---

## 7. 旧日远征（Old Sun War）数值曲线

### 7.1 棋盘掉落与 SAN 消耗（4 个 `Math.pow` @1381644~1383334）
四方向资源 `getSunRateTop/...` 与 SAN 消耗 `needSan` @1381306：
```
top : 5·(1+0.1·TopAndLeft/100)·pow(1.15|1.3|1.4|1.6 [meterLv])·pow(1.3, floor(TopAndLeft/10))
down: 8·(1+0.05·RAB)·pow(1.2|1.5|1.8|2.1 [meterLv])·pow(1.4, floor(RAB/5))
left: 4·(1+0.02·TL)·pow(1.3)·pow(1.3, floor(TL/10))     // pow(0.9,·) 递减修正
right:2·(1+0.01·RAB)·pow(1.4)·pow(1.2, floor(RAB/5))
```
meterLv 分档 `getMeterLv` @1402271：`meter 0-9→1, 10-99→2, 100-999→3, 1000-9999→4, 10000-99999→5, 100000-999999→6, ≥1e6→7`。
`getMeterLvPer = 1.4^(lv−1)` @1402271。

### 7.2 旧日怪物强度合成 `getMeterPer` @1401603（分段线性×十进制档）
```
lv = getMeterLvPer = 1.4^(lv−1)
per = 段内线性 + 跨十进制档 ×1.4^:
  meter 0-9:     (1+0.05·d)
  10-99:         (1.5+0.08·floor(d/10))
  100-999:       (2.3+0.1·floor(d/100))
  1000-9999:     (3.3+0.12·floor(d/1000))
  10000-99999:   (4.5+0.15·floor(d/10000))
  100000+:       (6+0.18·floor(d/100000))
getShowLvPer: 0-10:1+0.05·lv; 11-14:1.5+0.1(lv−10); 15-16:1.9+0.3(lv−14)
```
合成样本（`curve5.js`，type=0）：

| meter | 合成倍率 |
|---|---|
| 0 | 1.00 |
| 9 | 1.45 |
| 10 | 2.21 |
| 99 | 3.11 |
| 100 | 4.70 |
| 999 | 6.27 |
| 1000 | 9.38 |
| 9999 | 12.02 |
| 10000 | 17.86 |
| 100000 | 33.24 |
| 999999 | 40.98 |

→ 每跨一个十进制档 ×1.4，档内线性爬升；整体近似 **1.4^log10(meter) ≈ meter^0.15** 的极缓幂律。SAN 消耗曲线（top）随 meterLv：lv1→lv7 从 5 涨到 37.6（TL=0），TL=90 时到 3992 → **深潜 SAN 成本指数上升**。

---

## 8. Math.pow 全 13 处清单（成长曲线定位）

| # | 偏移 | 用途 | 公式 | 类型 |
|---|---|---|---|---|
| 1 | @867194 | gsap 小数工具 | `pow(10,·)` | 非玩法 |
| 2 | @886637 | gsap Expo 缓动 | `pow(2,·)` | 非玩法 |
| 3 | @1381644 | OldSun top 资源 | `pow(1.15/1.3/1.4/1.6,·)·pow(1.3,·)` | 资源成长 |
| 4 | @1382140 | OldSun down | `pow(1.2/1.5/1.8/2.1)·pow(1.4,·)` | 资源成长 |
| 5 | @1382600 | OldSun left | `pow(1.3)·pow(1.3,·)` | 资源成长 |
| 6 | @1383091 | OldSun right | `pow(1.4)·pow(1.2,·)` | 资源成长 |
| 7 | @1396587 | superGod 怪倍率 | `pow(2, kv/10000)` | **怪物指数** |
| 8 | @1402271 | getMeterLvPer | `pow(1.4, lv−1)` | 旧日成长 |
| 9 | @1440464 | 七日攻击对立 | `pow(1.33, ratio)−0.33` | **难度对立** |
| 10 | @1440709 | 七日攻击对立(镜像) | `pow(1.33, ratio)−0.33` | **难度对立** |
| 11 | @1440954/@1441270 | 七日勋章对立 | `pow(1.2, ratio)−0.2` | 奖励对立 |
| 12 | @1558758 | 计量条沉没成本 | `pow(10, lv−1)` | **成本墙(10^n)** |
| 13 | @1708501 | BottomRunBattle 门槛 | `MeterMaxCount>=pow(10,lv−2)` | **门槛(10^n)** |

（注：general/superWar 的 1.4^n / 1.1^n 用 `Math['**']` 或循环乘，未落入上述 13 处；`@2033344` 附近 `pow(2.5,i)` 为七日 fiend/angel 值 1e9 级喂料，与 §6.6 同源。）

---

## 9. 战斗力 / 推荐战力

**注意**：`getPower` @1423540 **不是战斗力**，是**体力/行动点**系统：
```
Power[0] += ceil(x/3)          // 恢复
Power[1] = 100 + ScienceList[0x704ee]·cfg[460014].Get[1]   // 上限=100+科技加成
```
`addPower` @1789328 类似（每 tick +1，赛季 +3）。

**推荐战力**的真正来源是节点/技能的 `NeedHP/NeedATK`（见 §6.5），由 `getFighter` 的 per 倍率与节点配置共同决定，而**非**单一"评分公式"。兵种面板显示的综合属性来自 `getArmyInitHP/ATK/DEF` @1295562~1296317：
```
initATK = getArmyInitATK: (base + 量子/科技加值)·(1+armsUP/100)·superArmyPer(...)
```
`getPowerPosValue` @1305152 = 所有已解锁 PowerPos 位对兵种的 `getValue·superArmyPer` 求和（加点→全兵种百分比放大）。`isPow`@1305788~ 是资源→军队的每日自动转化阈值门（`3000+800·EveryDayNew` 等，控制暴兵速度）。

**综合战斗力量级**（`adjustArmyATK/HP/DEF` @1288639~1296700）为多区连乘：
```
ATK = (base + Σ量子 + Σ科技)·(1+ ArmsUP/100)·(1+ powerPos%)·(1+ 将魂GodPer%)·(量子段乘积)
量子段 getQuantumATK @1284093:  ATK/5 · Π(LevelNum_i/10000)   // 每级量子×倍率/10000(如10000=×1, 分段)
```

---

## 10. 关键配置数据表（hex→dec 已转）

### 10.1 兵种基表 `army`（节选，`db_base_norm.json`）
| id | 名称 | MaxHP | ATK | DEF | 招募成本 |
|---|---|---|---|---|---|
| 370001 | 轻步兵 | 100 | 12 | 0 | 粮200+木100 |
| 370002 | 刀盾兵 | 200 | 10 | 0 | 粮300 |
| 370003 | 长枪兵 | 150 | 20 | 0 | 粮500 |
| 370004 | 重甲兵 | 300 | 15 | 5 | 粮800 |
| 370005 | 重骑兵 | 350 | 30 | 0 | 粮1000 |
| 370006 | 特种兵 | 550 | 40 | 0 | 粮1500 |
| 370007 | 装甲兵 | 650 | 35 | 5 | 三资源各2000 |
| 370008 | 电磁兵 | 280 | 55 | 0 | 三资源各8000 |
| 370009 | 宇航兵 | 400 | 40 | 0 | 三资源各8000 |
| 370010 | 未来战士 | 750 | 35 | 0 | 三资源各8000 |
| 370013 | 龙骑兵 | 1000 | 32 | 0 | — |
| 370014 | 末代骑士 | 2000 | 25 | 0 | — |

### 10.2 Boss vs 普通怪倍率（smallWar，`curve6.js`）
| 普通→王 | HP× | ATK× |
|---|---|---|
| 野猪→野猪王 | 16.0 | 4.50 |
| 蛮牛→蛮牛王 | 20.0 | 4.67 |
| 毒蛇→毒蛇王 | 48.0 | 10.6 |
| 白虎→白虎王 | 16.0 | 6.00 |
| 玄龟→玄龟王 | 37.5 | 3.00 |
| 蛟龙→蛟龙王 | 12.5 | 6.00 |
- 神域：守卫 HP5000 → 主神 540099 HP5e7 = **×10000**，ATK ×20
- 超战 1星→9星：HP **×9.5**
→ **Boss HP 普遍是精英怪的 12~48 倍、主神级达 1e4 倍**，ATK 只 3~11 倍 → Boss 战考的是持续输出(练度)，非秒杀阈值。

### 10.3 世界战斗王朝名 & 建筑（`worldBattle` 520xxx）
王朝 520001~520013：清/明/元/宋/唐/隋/晋/汉/秦/周/商/夏/上古（倒序文明退化，`Type=52`）。建筑 `EXCost`：主城/狩猎场/事件=100000，钱庄=50，炼丹=100，聚宝=150，将魂=200，量子=500，能源=300。

### 10.4 神域守卫/主神（`godWar`）
| id | 名称 | HP | ATK | DEF |
|---|---|---|---|---|
| 540096 | 魔物守卫 | 5000 | 1000 | 500 |
| 540095 | 神物守卫 | 1000 | 500 | 500 |
| 540099 | **众神之主(Boss)** | 5e7 | 20000 | 20000 |

### 10.5 量子成长（`quantum` 680xxx，`getQuantumHP/ATK` @1283733）
```
680001: AddLevel:[10000,10000,10000,10000,10000], AddLevel2:[500,1000,2000,2800,2800]
公式: X = Attri/5 · Π(LevelNum_i/10000)   // 每段满级×1, 部分段半级
```
`getQuantumHPAll` 遍历 16 个量子位求和。

### 10.6 七日节点配置（`db_cfg` 8101001/8102001 已全量，见 §6.5）
`frontList:[8203007,20]`=前排卡+数量20，`heroList:[...,1]`=主将1，`backList:[...,10]`=后排10；`warMax:[8,4]`=战场规模。

---

## 11. 难度曲线与卡点 / 付费闸门总结

1. **减法护甲 + 20% 保底** → 防御永远不能完全免疫，DPS 下限有保证；armor 独立 90% 上限封顶坦克。
2. **杀戮值橡皮筋**（§5）：怪物 ×1→×180 超指数，奖励封顶 ×8 → 自然形成"越刷越慢"，逼玩家转玩法/付费。
3. **七日信仰对立**（§6.2）：`pow(1.33,ratio)` 攻击墙 + `ratio>10 奖励归零` → **强制玩家双线均衡养成**，防单点碾压。
4. **95k 战力 ×10000 墙**（§6.3）：`battleValue>=95000` 难度瞬跳 ×1e4，典型练度/付费检查点。
5. **归零 ×5000 品质 + 2.5^n 喂料**（§6.4/6.6）：数值天花板，几乎只能付费或极后期达成。
6. **计量条 10^n 成本**（§8 #12/13）：`pow(10,lv−1)` 沉没成本 + `MeterMaxCount>=pow(10,lv−2)` 门槛，旧日远征进度墙。
7. **OldSun SAN 指数消耗**（§7）：深潜越深 SAN 成本指数升，限制单次远征深度。
8. **刷新门控**（§6.7）：免费刷新随进度 5→40 增长，第二货币（付费）刷新 1→5；`reBack` 提供进度重置重刷【推断=付费时间重洗】。

### 配置基线说明【推断】
本地内联库 `_0x2089a8`(41 组) 是随包基线；`@1215300` 存在服务器 `http://8.217.79.174/fangzhi/`，运行时可能覆盖部分数值表。本报告所有数字取自**内联基线**，线上可能有热更差异。

---

## 附录 A. 逐字原文核对（verify.js 从 deob_main.js 原样切片，正文各节为可读伪码，此处为真原文）

**A1 `adHurt` 减防保底/格挡分支 @2500053 起（含两处 clamp）**
```
(_0x3b5176-2.5*_0x53c679)*(0x1-_0x33d2e6)-(0.25*_0x53c679+_0x46adad["BlockValue"]()))>0.1*_0x3b5176?_0x148d0a:0.1*_0x3b5176;}else _0x148d0a=(_0x148d0a=_0x3b5176-_0x53c679)>0.2*_0x3b5176?_0x148d0a:0.2*_0x3b5176;
```
（`0x1`=1、`0.2*`=20% 非格挡保底、`0.1*`=10% 格挡保底；`_0x53c679`=有效防御、`_0x3b5176`=ATK、`_0x33d2e6`=BlockEff）

**A2 `hurtCalc` 双护盾 @2498425**
```
{'key':'hurtCalc','value':function(_0x469c2b,_0x3a77c1,_0x31529a){var _0x8edc68=a0_0x5a5d,_0x22dae7=_0x31529a['shield1']+_0x31529a["shield2"];if(_0x31529a["shield1"]<=0x0&&_0x31529a["shield2"]<=0x0||0x3==_0x3a77c1||0x4==_0x3a77c1||0x5==_0x3a77c1)_0x31529a['hp']-=_0x469c2b;else{if(_0x22dae7>0x0&&_0x22dae7>=_0x469c2b)_0x31529a["shield2"]>0x0?(_0x31529a["shield2"]-=_0x469c2b,_0x31529a["shield2"]<0x0&&(_0x31529a["shield1"]-=Math["abs"](_0x31529a["shield2"]),…
```
（`_0x469c2b`=伤害、`_0x3a77c1`=hurtType：**3/4/5 直扣 hp 穿盾**；盾总量足够时 shield2 先扣、溢出 `Math.abs` 转 shield1）

**A3 `isDodge` @2504237**
```
{'key':'isDodge','value':function(_0x5097e9,_0xcbb724,_0x19feec){if(0x1==_0x5097e9["hitFlag"]&&0x0==_0xcbb724["dodgeFlag"])return!0x1;…var _0x47d8f4=_0x5097e9["Hit"]()-_0xcbb724["Dodge"]();return _0x47d8f4=_0x47d8f4>0.3?_0x47d8f4:0.3,!this["battleHandle"]['per'](_0x47d8f4);
```
（`dodgeFlag>=1` 时消耗一层并强制进入可闪避路径；`0.3`=30% 命中下限；`!per(p)`=以 1−p 概率闪避）

**A4 `getFighter` @2618102**
```
function(_0x13f1ff){var _0x58d2aa=_0x5ad0de,_0x59f304=arguments["length"]>0x1&&void 0x0!==arguments[0x1]?arguments[0x1]:0x1,_0x5d354c=new _0x90e12f();if(_0x5d354c["maxHp0"]=_0xfd7397['getMaxHp'](_0x13f1ff)*_0x59f304,_0x5d354c['atk0']=_0xfd7397["getAtk"](_0x13f1ff)*_0x59f304,…
```
（第二参 `per` 缺省 `0x1`=1，七日难度整体乘进 maxHp0/atk0/pDef0）

> 复核工具：`_analysis/verify.js` 直接按偏移切片 `deob_main.js`，任何人可重跑逐字对拍。

---
*报告结束。全部公式均可在 `_analysis/fmt_*.txt`（反混淆切片）与 `out_*.txt`（计算表）中按偏移复核。*
