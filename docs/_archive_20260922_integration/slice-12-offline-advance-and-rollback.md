# 切片 12 报告 · 离线推进（建筑/城镇/队列闭式）+ 驻军冻结

## 1. 范围
- 来源：`分期计划.md` 切片 12 = 改造点 **B4**（规格 S5；U-S2b「队列推进」/ U-S5a「事件上限 120」/ U-S5b「驻军冻结」裁决）
- 改动（1 个生产文件 + 测试）：
  - `math.js`：
    - **等价抽出** `advanceBuildingsBy(secs)`（原 `tick()` 内联的"城镇升级 + 建筑建造/升级/tier 计时"块），`tick()` 传 1 → 逐秒；离线传闭式
    - 新增 `offlineAdvanceSec(secs)`：建筑/城镇按 secs 闭式扣减（到期项走**同一完成代码路径**，不复制完成逻辑）；队列复用真实 `processQueue()`（按需循环、次数有上限、按 `perTick×secs` 时间预算停止）；**不调用 `garrisonTick()`**（驻军冻结）
    - `settleOffline()` 调用推进并把结果写入报告卡 `advance`
- 回滚：`CFG.offline.advance=false`（J05 证明不推进）；`CFG.offline.enabled=false` 则整块离线结算关闭

## 2. L1（命令/输出/退出码）
```
node --check math.js/tests/ie001/run.js → exit 0
node tests/ie001/run.js                → 通过 84 / 失败 0，exit 0
  [PASS] J01 600s 工期在 3600s 离线内建成（走真实完成路径）
  [PASS] J02 未到期建筑按实际离线时长扣减（9999 − dur）
  [PASS] J03 队列闭式推进（60 兵按队列/上限产出，报告记录 produced）
  [PASS] J04 驻军相位冻结（S.garrison 逐字节不变）
  [PASS] J05 关闭 advance → 建筑/队列原样
  [PASS] J06 闭式 vs 逐秒 `advanceBuildingsBy(1)`×100 结果一致（等价性抽查）
node tools/verify/equiv.js             → exit 0：【全开关关闭 ⇒ 与 HEAD 逐字节相同】——同时守护了 `tick()` 重构的等价性
```

## 3. L2（真实浏览器）
```
node tests/ie001/browser_smoke.js    → 40/40 exit 0（切片11 端到端 6 条仍全绿）
node tests/ie001/browser_interact.js → 28/28 exit 0
清理核对：两套件 headless 残留 0
```

## 4. 阈值达成
| 阈值 | 结果 |
|---|---|
| 禁止逐 tick 模拟 | ✅ 闭式扣减 + 队列按需循环（`perTick×secs` 预算），无 86400 次循环 |
| 完成事件上限 N=120 | ✅ 到期项超过 120 时截断并写入事件说明 |
| 队列离线推进 | ✅ J03（对齐竞品 `floor(offline×1000/Interval)` 语义，用我方真实队列路径实现） |
| **驻军冻结** | ✅ J04（逐字节不变；离线不发起战斗） |
| 关闭开关不推进 | ✅ J05 |
| 与逐 tick 等价 | ✅ J06（抽查）+ equiv（全开关关闭＝与 HEAD 逐字节相同） |
| 回归全绿 | ✅ L1 84/84、L2 40/40 + 28/28 |

## 5. 本片抓出并修复的 1 个真 bug（诚实披露）
| # | 问题 | 发现方式 | 修复 |
|---|---|---|---|
| 1 | **闭式推进 off-by-one**：到期项走"计时压到 1 → 调用完成通道"时，完成通道会对**所有**非 idle 建筑再 −1 → 非到期建筑被多扣 1 秒（9999−3600 得 6398 而非 6399） | J02 断言失败（首次写死期望 6399；随后改为按"实际离线时长"校验仍暴露差 1 秒） | 非到期项改扣 `secs−1`，补偿完成通道的那 1 次；J06 进一步以"闭式 vs 逐秒"对拍锁死等价性 |

## 6. 结论
**通过**（L1 84/84、L2 40/40 + 28/28、等价性守护通过）
→ **M4 离线闭环完成**（切片 11 + 12）

---

# 回滚演练记录（阶段 5 验收项：实际执行过一次）

**四步全部成功**（2026-09-22 23:04）：

| 步 | 操作 | 结果 |
|---|---|---|
| ① 备份 | 把改造后的 7 个文件复制到 `%TEMP%\rollback-bk-20260922-230410` | 7 个文件已备份 |
| ② 回滚 | `git checkout -- config.js math.js ui.js technology.js tests/ie001/{run,browser_smoke,browser_interact}.js` | `git status` 已跟踪改动**为空**（回到 HEAD） |
| ③ 验证回滚态 | 跑 HEAD 版测试 | **L1 32/32、L2 smoke 33/33 全绿**；headless 残留 0 |
| ④ 恢复 | 从备份复制回 7 个文件 | `git status` 恢复为同一组 7 个已跟踪改动；**L1 84/84、L2 40/40**；对拍"全开关关闭＝与 HEAD 逐字节相同" |

**结论**：回滚路径真实可用（HEAD 是可用状态），且恢复改造版后**无损**（同一改动集、测试回到 84/84）。
**注意**：回滚到 HEAD 会**丢失 v3 字段语义**（HEAD 只认 v2）；演练中未使用含 v3 数据的档，故未触发兼容问题——该情形按 `slice-9` 报告的"v3 档被 v2 读"说明处理（进度无损、`ops/offline/daily` 丢弃），**不宣称完全兼容**。
