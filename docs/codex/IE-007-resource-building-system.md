# IE-007 · 资源类型与建筑系统（方案设计 · 阶段2产出）

- 状态：**设计已产出·待确认后进入实现**（未改任何代码）
- 依据：用户确认——参考对象=工作区《放置时代》体系；新增资源均须有参考对应；学院留 IE-002；新增建筑=市场+铸币厂+矿井+冶炼厂；与 IE-006 合并 v2、体系先行
- 原则：最小改动、不破坏现有玩法、关键数值全可配置、先验证再改、失败回退

---

## 1. 资源类型设计（每项均带放置时代参考，落实"所有资源皆有参考"）

**配置结构**（CFG.res 条目扩展，旧字段不动）：
```js
CFG.res.copper = { name:'铜', icon:'copper', type:'passive', max:2000, maxPerLv:500,
                   produces:{mine:2}, desc:'矿井产出，冶炼厂的原料' };
// type: basic=村民产出 | passive=建筑被动产出 | currency=软通货 | material=材料 | science=科技点
```

| key | 名称 | type | 产出方式 | 消耗方式 | 堆叠/上限 | 可交易转化 | 参考（放置时代·实证） |
|---|---|---|---|---|---|---|---|
| wood / stone / food | 木材/石料/食物 | basic | 村民分配×basePerPop×buff（现状不变） | 建筑/训练/军粮/口粮（现状不变） | 仓库线性上限（现状） | 转换阀（IE-006 挂接） | 粮/木/矿 150001-2 ✅复用 |
| tech | 科技点 | science | 无源（P0-1 断头路，学院=IE-002） | 科技研究 | storageCapacity | 无 | 知识 160003 ✅登记不改 |
| copper | 铜 | passive | 矿井每级 +2/s【示例】 | 冶炼厂炼铁、高等级建筑/未来新兵种（不改旧兵种成本） | 独立上限 max=2000+矿井lv×500【示例】 | 可经冶炼转铁 | 铜 150006 ✅新增 |
| iron | 铁 | passive | 冶炼厂每级 +1/s（消耗铜 3/s）【示例】 | 高等级建筑/未来内容 | 独立上限 max=1000+冶炼lv×400【示例】 | 市场兑换金币 | 铁 150007 ✅新增 |
| coin | 金币 | currency | 铸币厂每级 +2/s（消耗粮 5/s）【示例】 | 市场兑换基础资源/未来购买 | 独立上限 max=5000+铸币lv×1000【示例】 | 市场（交易所雏形，IE-006 扩充每日/多汇率） | 金币 150009/160006 ✅新增 |
| merit | 战功 | currency | 战斗结算（现状 math.js@1729） | 科技解锁（现状） | 无上限（现状） | 无 | 勋章 160010 ✅复用 |
| essence×8 | 精魄 | material | Boss 掉落（现状 prob 0.5-0.55） | T2/T3 解锁（现状） | 道具格（现状） | 无 | 异兽材料/神器碎片 17xxxx ✅复用 |

**规则**：①新增资源**只进新消耗侧**（冶炼/市场/未来内容），旧兵种成本、旧建筑成本、科技定价一律不动；②passive 资源不受村民分配影响（不碰 popAlloc/人口体系）；③上限独立可配，不占仓库容量；④`prodRate`/tick 的资源循环按 type 分流（basic 走原路径，passive/currency 走新被动产出路径）。

## 2. 建筑定义（现有 10 座 + 新增 4 座）

**配置结构**（新增字段，旧字段不动）：
```js
CFG.buildings.mine = { name:'矿井', type:'production', needBoss:5,
  build:{wood:300,stone:500,food:200,time:8}, upBase:{wood:2000,stone:3000,food:1500}, upCostLv:1.15,
  produces:{copper:2}, maxPerLv:{copper:500}, desc:'产出铜' };
CFG.buildings.market = { name:'市场', type:'utility', needBoss:10,
  build:{wood:400,stone:400,food:300,time:10}, upBase:{wood:3000,stone:3000,food:2500}, upCostLv:1.2,
  desc:'金币兑换基础资源（交易所雏形，每日限制与多汇率由 IE-006 补齐）' };
```

| key | 名称 | type | 功能 | 产出/消耗 | 升级 | 解锁 | 参考（放置时代） |
|---|---|---|---|---|---|---|---|
| lumber_mill/quarry/farm | 伐木场/采石场/农田 | resource | 采集 buff（现状） | buff 乘区 | upCostLv×cap | 默认 | 牧场/伐木场/矿井 ✅复用（补 type 标注） |
| barracks | 营帐 | barracks | 编制/升级位（现状） | — | — | 默认 | 军帐 ✅复用 |
| infantry_camp/archer_range/stable/mage_tower | 4 训练营 | training | 训练+tier 门控（现状） | tierUpgrade | — | needBoss（现状） | 兵营 ✅复用 |
| warehouse | 仓库 | storage | 容量（现状） | — | cap=城镇×5 | 默认 | 仓库 ✅复用 |
| arrow_tower | 箭塔 | defense | 驻军防御（现状） | — | — | 默认 | 箭塔 ✅复用 |
| **mine** | 矿井 | production | 被动产铜 | produces copper +2/s/级 | upCostLv 1.15【示例】 | needBoss:5【示例】 | 矿井 25xxxx ✅新增 |
| **smelter** | 冶炼厂 | production | 消耗铜产铁 | consumes copper 3/s, produces iron +1/s/级【示例】 | 1.15 | needBoss:10 | 冶铁厂 26xxxx ✅新增 |
| **mint** | 铸币厂 | production | 消耗粮产金币 | consumes food 5/s, produces coin +2/s/级【示例】 | 1.15 | needBoss:15 | 铸币厂 ✅新增 |
| **market** | 市场 | utility | 金币⇄基础资源兑换（雏形） | 保守汇率 config 可调【示例：coin→wood 1:8、wood→coin 10:1】 | 1.2 | needBoss:10 | 市场/交易所 38xxxx/29xxxx ✅新增 |

**规则**：①解锁统一走现有 `needBoss` 字段（同 stable/mage_tower 模式）；②升级走现有 `upCost/upgradeLockReason/buildingCaps`（新增 production/utility 两档并入 Cap 表：`buildingCaps.production=1, utility=1`【示例】）；③被动产出建筑在 tick 内按"先产出→扣消耗→不足则停产当次"执行【示例规则】；④市场兑换函数 `exchangeResource()` 本任务实现**基础版**（单条保守汇率、次数限制留给 IE-006），与 IE-006 转换阀合并调参。

## 3. 存档兼容（与 IE-006 合并的 v2 方案）

- `SAVE_VERSION` → 2；新增持久：`S.res` 的 copper/iron/coin 键。
- `migrateSave`：v1→v2 补 `res.copper/iron/coin=0`（不触碰其它字段）；`validateSave`：v2 要求三个新键存在且数值合法；v1 宽容规则不变；`serializeSave` 写入新键。
- 幂等/PRE/备份沿用 IE-001 机制；坏新键结构→保护模式（沿用 S12 语义）。
- IE-006 后续追加 `S.daily` 时仍在 **v2** 内（v2 未对外发布前可扩展；发布后任何追加须再升版）。
- 测试：legacy→v1→v2 全链、v2 往返、坏 `res.copper` 保护、现有 23 用例回归。

## 4. 接入点清单（最小改动，精确到位置）

| 文件 | 改动 |
|---|---|
| config.js | CFG.res 新增 copper/iron/coin（含 type/max/maxPerLv/produces）；CFG.buildings 新增 mine/smelter/mint/market + 现有 10 座补 `type` 标注（只读字段）；buildingCaps 增 production/utility 档 |
| math.js | S 初值与 `_legacyDefaults` 补 `res` 新键（@14-37/355）；`serializeSave/validateSave/migrateSave/applySaveToS` v2（@344-430 区）；tick 增加被动产出循环（@532 资源循环附近，按 type 分流）；新增 `exchangeResource()`（市场基础版）；新资源上限读取函数 |
| ui.js | updateUI 资源栏补 3 格（@6-9 同模式，index.html 同步加 span）；建筑页核对遍历渲染（@336/391 实施时确认，新增建筑应自动出现） |
| index.html | topbar 增 res-copper/res-iron/res-coin 节点头 |
| tests/ie001/run.js | 新增 v2 迁移/新资源产出与上限/兑换/坏键保护用例；回归既有 23 例 |
| 文档 | 本文件→报告版、策划文档 v1.2 变更日志 |

## 5. 阶段 3 实现步骤（确认后执行）

1. S1 小步先验证：config.js 补 3 资源+4 建筑 → `node --check` + 现有测试全绿（新增配置对旧逻辑零影响）。
2. S2 存档 v2（序列化/校验/迁移/默认值）→ 新用例绿 + 旧 23 用例绿 + 迁移幂等。
3. S3 tick 被动产出 + 上限 + 市场兑换基础版 → 新用例绿。
4. S4 UI（topbar 3 格 + 建筑遍历核对 + 市场卡）。
5. S5 验证与交付：node --check、run.js 全量、浏览器冒烟（新增资源显示/市场按钮真实点击或标注未运行）、产出报告 `docs/codex/reports/IE-007.md`（清单/关键数值/待确认项/回退说明）。
6. 失败即回退：任何一步测试不绿→git 层面回退该步改动（新配置用 `CFG.curve.enabled` 式开关或直接还原 config 段）。

## 6. 验收矩阵（草案）

| 编号 | 场景 | 必须观察到 |
|---|---|---|
| B01 | 配置加载 | 3 新资源+4 新建筑入 CFG；旧配置零改零错 |
| B02 | v2 迁移 | legacy/v1 档加载后 16 字段无损+新键=0；两次迁移幂等；坏新键→保护 |
| B03 | 被动产出 | 矿井/冶炼/铸币按级产出且钳上限；消耗不足停产不产生负数 |
| B04 | 市场兑换 | 基础汇率正确、失败不改资源；不产生套利环（汇率乘积<1） |
| B05 | UI | topbar 显示新资源；建筑页出现 4 新卡可建可升级；窄屏不溢出 |
| B06 | 回归 | run.js 既有 23 例全绿；浏览器冒烟零异常 |
| B07 | 可配置 | 全部新数值在 config，无硬编码 |

## 7. 待确认（设计确认后进入实现）

- W1 数值起点【示例】确认：矿井+2铜/s/级、冶炼 3铜→1铁/s/级、铸币 5粮→2金币/s/级、上限 2000+500lv 等（推演在 IE-006 阶段做，本阶段先保守落位）。
- W2 市场兑换最小版：金币⇄基础 2 条汇率（coin1:wood8、coin1:stone6）可否；还是只做界面+函数留空待 IE-006？
- W3 停产规则：消耗不足时该建筑当次停产（建议）还是扣至负库存？
- W4 新建筑解锁门槛 needBoss 5/10/15/10【示例】可否？
