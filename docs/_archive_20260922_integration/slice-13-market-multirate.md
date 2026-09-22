# 切片 13 报告 · 交易所多汇率 + 每日上限 + 转换损失

## 1. 范围
- 来源：`分期计划.md` 切片 13 = 改造点 **C3**（用户裁决：对齐竞品多汇率模型；保留已实现金币汇率，扩多汇率 + 每日上限 + 转换损失；日界=本地 0 点）
- 改动（3 个生产文件）：
  - `config.js`：`CFG.market.multiRate=false → **true**`；汇率表 4 → **10 条**（新增 `coin→food 4`、`food→coin 0.08`、`wood→stone 0.6`、`stone→wood 0.5`、`wood→food 0.4`、`food→wood 0.2`）
  - `math.js`：新增 `localDay()`（本地 0 点日界）、`dailyResetIfNeeded()`、`dailyCount()`、`bumpDaily()`、`marketDailyLimit()`；`exchangeResource()` 加日限判定 + 计数 + 返回剩余次数
  - `ui.js`：市场面板显示「每日上限 N 次（本地 0 点重置，今日剩余 M 次）」（**展示同源**）
- 「转换损失」的实现口径：**损失体现为买卖价差**（新增跨资源对 + 既有 4 条构成往返乘积 <1），而非在汇率外再乘系数——避免改动既有 4 条汇率的数值语义
- 回滚：`CFG.market.multiRate=false` → 无日限、行为回到改造前的 4 条汇率

## 2. L1（命令/输出/退出码）
```
node --check math.js/config.js/ui.js/tests/ie001/run.js → exit 0
node tests/ie001/run.js                                → 通过 89 / 失败 0，exit 0
  [PASS] K01 多汇率 10 条；**所有互兑往返乘积 <1**（无套利）；关闭开关时无日限
  [PASS] K02 日限 5 次：第 5 次成功（remaining 0）、第 6 次拒绝且**不改资源**
  [PASS] K03 跨日重置：把 day 改为 2000-01-01 → 计数归零、可再兑换（remaining 4）、day 更新为今天
  [PASS] K04 关闭开关 → 无日限（连续 8 次全成功）
  [PASS] K05 未知汇率拒绝且不改资源；跨资源兑换 `wood→stone 10 → 6`（0.6 取整）
  [PASS] V05（既有）市场兑换不变式仍通过
node tools/verify/equiv.js                             → exit 0（全开关关闭含 market.multiRate ⇒ 与 HEAD 逐字节相同）
```

## 3. L2（真实浏览器）
```
node tests/ie001/browser_smoke.js    → 40/40 exit 0（市场面板 ≥4 汇率项仍通过；切片11 端到端仍绿）
node tests/ie001/browser_interact.js → 28/28 exit 0
清理核对：两套件 headless 残留 0
```

## 4. 阈值达成
| 阈值 | 结果 |
|---|---|
| 多汇率生效 | ✅ K01（10 条） |
| **无套利环**（防"兑换刷资源"） | ✅ K01 全配对往返乘积 <1；V05 不变式仍通过 |
| 每日上限生效 | ✅ K02；K03 跨日重置；K04 关闭开关无日限 |
| 失败不改资源 | ✅ K02/K05 |
| 展示与实现同源 | ✅ 面板显示剩余次数（走 `marketDailyLimit()/dailyCount()`） |
| 日界=本地 0 点（C4 裁决） | ✅ `localDay()`（YYYY-MM-DD 本地日期） |
| 回归全绿 | ✅ L1 89/89、L2 40/40 + 28/28 |
| 关闭开关＝改造前 | ✅ K04 + equiv |

## 5. 断言口径更新披露（1 处）
`W01`：`market.multiRate` 期望由 `false` 改为 `true`（切片 13 既定启用）；其余开关仍断言各自状态。

## 6. 回退
`CFG.market.multiRate=false`（K04 证明无日限且回到原 4 条汇率语义）；`git checkout -- config.js math.js ui.js` 彻底回退。

## 7. 结论
**通过**（L1 89/89、L2 40/40 + 28/28、无套利不变式保持、对拍逐字节相同）

## 8. 承接
- 切片 14（科技占人口学者制）与切片 15（被动建筑人口约束）仍待实施；二者与**城镇门/人口上限（S8c 地契裁决）**强耦合——不解除城镇门时，人口恒为 10，占人口制的效果会被压住
- 切片 16（收尾：版本号纪律 + 数值配置化边界表 + 文档同步）不依赖上述决策
