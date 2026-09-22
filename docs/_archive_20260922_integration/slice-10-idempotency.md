# 切片 10 报告 · 幂等层（S4）

## 1. 范围
- 来源：`分期计划.md` 切片 10 = 改造点 **B2**（规格 S4 + U-S4a/b 裁决：窗口 5s、**持久化**入 v3 `ops`、优先复用既有互斥）
- 改动（3 个生产文件）：
  - `config.js`：`CFG.idem = { enabled:true, windowMs:5000, max:200 }`（**回滚开关**）
  - `math.js`：新增幂等原语 `idemActive/idemKey/strHash/idemSeen/idemMark/idemRepeat`（环形 ≤200、窗口外 60s 观察期清理、命中记 `logDiag('idem-repeat')`）
  - 打点位置：`researchScience`（资源科技）、`commitSaveData`（导入）、`restoreBackupByText`（恢复）、`upgradeUnit`（兵种研究，technology.js）
- 设计取舍：**优先复用既有互斥屏障**（建筑 `state!=='idle'`、`upgradedUnits[to]`、`S.sciences.includes(id)`）——幂等层只承担"同一请求窗口内重复提交"的**结果一致性**与**不重复扣费**保证
- 回滚：`CFG.idem.enabled=false` → 完全回到改造前（对拍可证）

## 2. L1（命令/输出/退出码）
```
node --check math.js/technology.js/config.js/tests/ie001/run.js → exit 0
node tests/ie001/run.js                                        → 通过 71 / 失败 0，exit 0
  [PASS] G01 兵种研究窗口内重复 → 首扣 200、第二次不再扣、ops 记录 1 条
  [PASS] G02 资源科技窗口内重复 → repeat=true 且不再扣科技点
  [PASS] G03 窗口外（把记录时间戳改为 −6s）→ 允许再次执行
  [PASS] G04 ops 环形上限 ≤200 且保留最新
  [PASS] G05 同一文本重复导入 → 幂等（主档不二次覆盖、PRE 不重写）
node tools/verify/equiv.js                                     → exit 0（全开关关闭含 idem ⇒ 与 HEAD 逐字节相同）
```

## 3. L2（真实浏览器）
```
node tests/ie001/browser_smoke.js    → 34/34 exit 0（开关断言已含 idem=enabled）
node tests/ie001/browser_interact.js → 28/28 exit 0
清理核对：两套件 headless 残留均为 0（reaper 生效）
```

## 4. 阈值达成（对照规格 S4 / 验收映射"重复操作不重复发奖"）
| 阈值 | 结果 |
|---|---|
| 窗口内重复 → 返回既有结果、不重复扣费 | ✅ G01（200 科技点只扣一次）、G02、G05 |
| 窗口外可正常再次执行 | ✅ G03 |
| 记录持久化（跨刷新仍有效） | ✅ 写入 v3 `S.ops`（切片 9 校验已就位） |
| 环形上限与清理 | ✅ G04（≤200、保留最新、窗口外清理） |
| 命中可观测 | ✅ `logDiag('idem-repeat', key)`（切片 2 的环形日志） |
| 复用既有互斥、不重复造屏障 | ✅ 建筑状态/已解锁/已研究三类天然屏障保留 |
| 回归全绿 | ✅ L1 71/71、L2 34/34、28/28 |

## 5. 断言口径更新披露（3 处）
| 用例 | 原断言 | 新断言 | 原因 |
|---|---|---|---|
| `V08` | 重复研究 → `ok===false`（拒绝） | 重复研究 → `ok===true && repeat===true`，并**新增**断言"科技点/战功不变" | 切片 10 起重复走幂等路径；**防重复扣费的保证更强**（原断言只验证拒绝，新断言直接验证不扣费） |
| `W01` | `idem.enabled===false, max=50` | `idem.enabled===true, windowMs=5000, max=200` | 切片 10 既定启用 |
| L2 smoke 开关断言 | 含 `idem===false` | 含 `idem===true` | 同上 |

## 6. 回退验证
- 回滚：`CFG.idem.enabled=false` → 幂等检查全部短路（`idemRepeat` 直接 false、`idemMark` 直接 return），行为回到改造前
- 彻底回退：`git checkout -- config.js math.js technology.js`
- 未实际执行回退（本片无失败；回滚演练按计划在 M3/M4 后各一次）

## 7. 结论
**通过**（L1 71/71、L2 34/34 + 28/28、对拍逐字节相同）

## 8. 承接
- 切片 11（离线结算）将复用：`S.offline.pendingReport`（v3）+ `idemRepeat('offline', …)`（防"报告卡重复领取/结算重复入账"）
- 切片 12（离线推进）将复用 `idemRepeat` 与 `S.tick += delta` 的时钟连续约定
