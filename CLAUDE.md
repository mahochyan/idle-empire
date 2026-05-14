# 放置帝国 — 文字挂机RTS游戏

## 项目概述

- 类型：文字挂机 RTS，回合制战斗
- 平台：Web（HTML/CSS/JS），单文件架构，安卓 WebView 运行
- 存档：localStorage（key: `rts_save`）
- 当前阶段：Phase 1 — 最小可玩版本
- 技术栈：原生 ES6，无框架依赖，JSON 配置化

## 运行方式

**无需构建步骤** — 纯静态 HTML/JS/CSS，直接用浏览器打开 `index.html` 即可运行。无 Node.js 依赖，无打包工具。

存档存储在浏览器 localStorage，key 为 `rts_save`。

## 文件结构与加载顺序

**加载顺序不可变**：`config.js` → `levels.js` → `sprites.js` → `math.js` → `garrison.js` → `ui.js`

每个文件依赖前一个文件定义的全局变量（CFG → pixelIcons → S/B/DAMAGE_COEF 等）。新增代码时注意依赖方向。

| 文件 | 说明 |
|------|------|
| `index.html` | HTML 骨架 + 完整 CSS 样式（像素风皮肤、动画、响应式） |
| `config.js` | 游戏配置：资源定义、城镇等级、兵种、克制关系、命中率、战术、建筑配置、升级上限 |
| `levels.js` | `CFG.enemies` 关卡配置：30关敌人阵容、Boss属性、掉落奖励 |
| `sprites.js` | 像素图标：32×32 像素画字符网格 + `gridToRects()` → SVG data URI |
| `math.js` | 全部游戏逻辑：状态 `S`、辅助函数、存档、tick、操作、战斗系统、编队弹窗、单位详情 |
| `garrison.js` | 驻军入侵系统：入侵模板、阶段状态机、无头自动战斗、箭塔攻击、奖励/惩罚、日志 |
| `technology.js` | 科技树系统：科技树节点配置、解锁逻辑、科技点消耗 |
| `ui.js` | UI 渲染：updateUI、各标签页渲染、长按加速、导航、toast |
| `设计框架.md` | 完整设计文档（资源/兵种/战斗/英雄/远征/周目） |
| `开发日记.md` | 开发记录与更新日志 |

## 代码架构

### 文件分工

```
index.html     ───  DOM 骨架、CSS 皮肤、弹窗/战斗屏容器
config.js      ───  CFG 全局配置（资源/城镇/兵种/建筑/克制/战术）
levels.js      ───  CFG.enemies 关卡配置 + CFG.invasions 入侵配置
sprites.js     ───  pixelIcons 对象 + pix() 渲染函数
math.js        ───  S状态 + 全部游戏逻辑（不含UI渲染和驻军系统）
garrison.js    ───  驻军入侵系统（阶段状态机/自动战斗/箭塔/奖励惩罚）
technology.js  ───  科技树系统（科技树节点配置/解锁逻辑/科技点消耗）
ui.js          ───  HTML拼接渲染 + DOM事件绑定 + 导航
```

加载顺序（严格不可变）：`config.js` → `levels.js` → `sprites.js` → `math.js` → `garrison.js` → `technology.js` → `ui.js`

### 核心全局对象

- `CFG` — 全部静态配置（资源、建筑、兵种、敌人、城镇、克制、miss表、战术），分布在 config.js / levels.js
- `S` — 运行时状态（资源、建筑、人口分配、兵力池、编队、队列、日志、battleSpeed等）
- `B` — 战斗临时状态（每场独立，我方/敌方单位数组、回合计数、战术、消息队列）
- `pixelIcons` — 32×32 像素图标位图定义（sprites.js）

### 核心机制：人口分配采集

```
城镇等级 → 人口上限
人口分配 → 各资源采集量 = 分配人口 × 0.5/秒 × (1 + 建筑Buff%)
建筑升级 → 提升对应资源Buff%
击败Boss → 解锁城镇升级(前期每关1次，后期需跨多关)
```

### 数据流

```
CFG(配置) + S(状态) → UI渲染
S.popAlloc × basePerPop × (1 + buildingBuff) → S.res 自动增长
S + 敌人配置 → 战斗系统 → B 战斗结果 → S 更新(奖励/击杀记录)
S 序列化 → localStorage 存档
```

### 关键系统

**训练队列**：`S.queue[unitKey] = {count, timer, reason}`，排队上限=unitCap×5，每秒生产1个，资源在生产完成时扣除，队列暂停时显示原因（资源不足/后备满）。

**战斗伤害**：`hp × atk × 0.09 × (100/(100+def×8)) × counter × mage × passive × random(0.9~1.1)` — 乘以攻方血量保证总伤害与编队分组方式无关。

**兵种被动**：步兵ATK×1.1、骑兵闪避10%（对非弓兵）、枪兵暴击10%（2×伤害）、弓兵MISS 20%/对骑兵50%、法师互易伤1.3×双向。

**远程规则**：弓兵/法师可打任意排，60%概率被前排阻挡。近战单位（步兵/骑兵/枪兵）只有在前排才能攻击。

**驻军系统**：独立于出战的防御系统。`garrison.js` 实现阶段状态机（idle→warning→spawn→sortie→battle→result→cooldown），自动演算防御战斗，箭塔按等级间隔射击，支持入侵模板配置。

## 开发规范

1. 配置数据放 `CFG`，游戏状态放 `S`，战斗临时放 `B`
2. 写新代码时参考文件分工，再决定代码存放的位置
3. 保持手机框体 + 底部导航的 UI 布局（宽400px，小屏自适应）
4. 驼峰命名，配置键名与设计文档一致
5. 提交前确认存档兼容性

## 关键陷阱

**状态序列化** — `save()` 和 `load()` 是手动字段列表，不是自动序列化整个 `S` 对象。新增 `S` 字段时必须同时修改两个函数，否则重启后数据丢失：
- `save()`：math.js:224 — 手动 pick 字段到 JSON
- `load()`：math.js:229 — 手动 assign 字段回 `S`

**战斗是异步循环** — `battleTurn()` 用 `setTimeout` 递归调用，不是同步 while 循环。回合间通过 `S.battleActive` 标志控制。战斗中 `tick()` 跳过资源产出。

**updateUI 的焦点保护** — `renderPage()` 不会在用户正在 `<input>` / `<textarea>` 中编辑时刷新内容（防止输入中断）。只有切换标签页或 tick 触发时才会重新渲染。

**伤害公式系数** — `DAMAGE_COEF = 0.09` 定义在 math.js:810，驻军战斗的 `calcGarrisonDmg()` 也使用同一个常量，修改时两边都要考虑。

**garrison.js 依赖 math.js** — 驻军模块使用 math.js 中定义的 `DAMAGE_COEF`、`cm()`、`mm()`、`missRate()`、`isAttackMiss()`、`isRanged()`、`storageCapacity()`、`addLog()`、`save()`、`updateUI()`、`toast()` 等函数。这些函数必须在 garrison.js 加载前已定义。

## Phase 1 实现状态

- ✅ 城镇系统（8级，Boss驱动升级）
- ✅ 人口分配采集（分配人口×0.5/秒×建筑Buff）
- ✅ 3 种资源 + 仓库上限系统 + 资源产出建筑Buff
- ✅ 5 类兵种（步/弓/骑/枪/法）+ 克制闭环 + 法师互易伤
- ✅ 兵种被动（步兵+10%攻、骑兵闪避10%、枪兵暴击10%、弓兵MISS、法师互易伤）
- ✅ 军粮维护费系统
- ✅ 训练队列系统（排队生产，资源不足/后备满时暂停）
- ✅ 阵型系统（前/中/后 1×3起步，Boss击杀后扩展）
- ✅ 编队弹窗（选兵种+定人数+长按加减）
- ✅ 单位详情属性卡
- ✅ 回合制自动战斗（交替攻击制、速度排序、前排保护、远程规则）
- ✅ 战斗CSS动画 + VFX飞行特效（5兵种各自独特特效图）
- ✅ 战后阵容重建 + 军营自动补员
- ✅ 100关敌人（每10级一个Boss）
- ✅ 战术系统（4种战术已配置，默认稳扎稳打）
- ✅ 多标签页 UI（主页/建筑/军营/战斗/日志）
- ✅ localStorage 存档
- ✅ 像素风皮肤 + 32×32/64×64 像素画系统
- ✅ 驻军编队UI + 日常怪物侵袭自动防御系统
- ✅ 箭塔防御建筑（驻军战斗中自动射击）

## Phase 2 进行中

- ⬜ T2 资源（铁矿、煤炭）+ T2 建筑（矿场、冶炼厂）
- ⬜ 兵种升级线（基础→进阶→精锐）
- ⬜ 法师进阶形态
- ⬜ 出战槽位升级（随城镇等级扩展）
- ⬜ 更多驻军建筑（城墙/陷阱工坊/烽火台/军械库）
- ⬜ 更多敌人/Boss（第4章+）
