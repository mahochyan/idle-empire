# 切片 11 报告 · 离线结算 + 报告卡（验收映射主链路）

## 1. 范围
- 来源：`分期计划.md` 切片 11 = 改造点 **B3**（规格 S2；C1 裁决 `0.6 / 24h / <120s`；U-S2a/b/c 裁决）
- 改动（3 个生产文件）：
  - `config.js`：`CFG.offline.enabled = false → **true**`（0.6× / 86400s 封顶 / 120s 起结；`advance` 留给切片 12）
  - `math.js`：新增 `offlineNetRates()` / `passiveResNet()` / `passiveFoodDrainCalc()` / `offlineDeltaSec()` / `settleOffline()` / `dismissOfflineReport()`；加载路径记录 `_loadedTs`（新档为 null → 不结算）
  - `ui.js`：启动 `load()` 后 `settleOffline()` 一次；`visibilitychange` 回前台再结算一次；主页新增**离线报告卡**（展示后由玩家"知道了"清空）
- 规则（按规格 S2 实现）：`delta = clamp(now−ts, 0, 86400)`；`delta < 120s` 不结；各资源 = 净速率 × delta × **0.6**；**食物为负时按"库存 ÷ |负速率|"截断可支付秒数**（其余资源同用该秒数）；**不结算** 战功/精魄/关卡进度/人口/战斗；结算后 `S.tick += secs` 保持时钟连续；结果写 `S.offline.pendingReport`
- 回滚：`CFG.offline.enabled=false`（H07 证明不结算）

## 2. L1（命令/输出/退出码）
```
node --check math.js/ui.js/config.js/tests/ie001/run.js → exit 0
node tests/ie001/run.js                                → 通过 78 / 失败 0，exit 0
  [PASS] H01 Δ3600s → 木/石/食 = 净速率×3600×0.6（**独立口径**：木/石以 prodRate 为期望值）
  [PASS] H02 起结线 119s 不结 / 120s 结
  [PASS] H03 Δ3 天 → 截断到 86400s 并标记 truncated
  [PASS] H04 时钟回拨（ts 在未来）→ 明确原因、资源不变且不为负
  [PASS] H05 断粮截断 → 按可支付秒数结算、食物不为负
  [PASS] H06 幂等：同一次离线只结一次（第二次 repeat）
  [PASS] H07 报告卡可清空；关闭开关不结算
node tools/verify/equiv.js                             → exit 0（全开关关闭含 offline ⇒ 与 HEAD 逐字节相同）
```

## 3. L2（真实浏览器 · **端到端链路**）
```
node tests/ie001/browser_smoke.js    → 40/40 exit 0（含 6 条切片11 端到端断言）
  [PASS] 启动加载 → 离线结算（报告卡出现且时长=3600s）
  [PASS] 离线增益已入账并落库
  [PASS] 报告卡在真实 DOM 可见（截图 slice11-offline-report-360.png）
  [PASS] 主档已落库（pendingReport 持久化）
  [PASS] 清空后主档 pendingReport=null
  [PASS] 重载后不再重复结算（无报告卡）
node tests/ie001/browser_interact.js → 28/28 exit 0
清理核对：两套件 headless 残留均为 0
```
→ 验收映射的"**启动加载存档 → 离线结算 → 操作 → 落库**"在真实浏览器中**端到端跑通**。

## 4. 阈值达成（对照 `实机验证标准.md` V-S2）
| 阈值 | 结果 |
|---|---|
| 报告卡出现（时长正确） | ✅ L2（3600s） |
| 增量 = 净速率×delta×0.6 | ✅ H01（木 4320 = 2×3600×0.6） |
| 刷新不重复结算 | ✅ L2 重载后无报告卡 + H06 |
| 前跳截断 ≤24h | ✅ H03 |
| 回拨不产生负资源 | ✅ H04 |
| 断粮按可支付秒数 | ✅ H05 |
| 起结线 119/120s | ✅ H02 |
| **L3 真机杀进程** | ⛔ **未运行（无设备）** |

## 5. 本片抓出并修复的 2 个问题（诚实披露）
| # | 问题 | 发现方式 | 修复 |
|---|---|---|---|
| 1 | **`offlineNetRates()` 把木/石当被动资源**：判断条件用了 `CFG.res[rk].type==='basic'`，但木/石**没有 `type` 字段**（只有 tech/copper/iron/coin 有）→ 木/石净速率算成 0，离线只入账食物 | L2 断言"离线增益已入账"失败 → 我先加诊断、再写 `tools/verify/probe-offline.js` 最小复现（探针显示 `offlineNetRates().wood=0` 而 `prodRate('wood')=2`） | 改判据为"有无生产建筑"（`producerKey(rk)`）：有 → 被动净速率；无 → `prodRate` |
| 2 | **H01 自我印证**：原断言用 `offlineNetRates()` 自身算期望值 → 木为 0 时"0≈0"照样通过，掩盖了 bug 1 | 复现探针 + 复核 H01 断言结构 | H01 期望值改为**独立口径**（木/石用 `prodRate`），并新增断言 `rates.wood === prodRate('wood')` |
> 这正是 AGENTS 第 5 条"不复制一套公式让测试自我证明"的反面案例，已按此纠正。

## 6. 断言口径更新披露（1 处 + L2 断言新增）
- `W01` / L2 开关断言：`offline.enabled` 由 false → true（切片既定启用）
- L2 新增 6 条切片11 端到端断言（见 §3），并把"离线增益"断言收紧为**必须含木材增益**

## 7. 回退验证
- 回滚：`CFG.offline.enabled=false` → H07 证明不结算、不写报告卡；`git checkout` 可彻底回退
- 未实际执行回退（本片无失败；回滚演练安排在 M4 完成后）

## 8. 结论
**通过**（L1 78/78、L2 40/40 + 28/28、端到端链路跑通、对拍逐字节相同；L3 未运行-无设备）

## 9. 承接
- 切片 12（离线推进队列/建筑 + 驻军冻结）将复用 `CFG.offline.advance` 与本次建立的 `secs` 截断口径
- 切片 12 完成后即可执行**回滚演练**（M4 收尾）并进入阶段 5（迁移/兼容）
