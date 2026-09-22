# 切片 2 报告 · 开关骨架 + 诊断环形日志（阶段 4）

## 1. 切片名与范围
- 切片：**A2 诊断环形日志 + A3 双层开关骨架**（`分期计划.md` 切片 2）
- 改动文件：
  - `config.js`：新增 `CFG.offline/idem/caps/upkeep/tech/passive/diag` 七组开关（**全部默认关闭/零行为**）+ `CFG.market.multiRate=false`、`CFG.market.dailyLimit=5`
  - `math.js`：新增 `logDiag(tag,msg)` / `diagSnapshot()` / `diagClear()`（环形上限 50、仅内存、不入档、零上报）；`_warnUnsaved` 增加一条本地诊断记录（不改提示行为）
  - `tests/ie001/run.js`：新增 W01-W04
  - `tests/ie001/browser_smoke.js`：新增 1 条 L2 断言
- 回滚方式：开关保持 `false`（等价于改造前）；彻底回退＝`git checkout -- config.js math.js`（+ 测试文件）

## 2. L1 验证（命令 / 输出 / 退出码）
```
node --check config.js / math.js / tests/ie001/run.js / tools/verify/equiv.js   → exit 0
node tests/ie001/run.js                                                          → 通过 36 / 失败 0，exit 0
  [PASS] W01 开关骨架存在且默认关闭（零行为变化）
  [PASS] W02 诊断环形日志：上限 50、FIFO、结构正确、可清空
  [PASS] W03 诊断日志不入档：存档文本无 diag 且字段集不变
  [PASS] W04 logDiag 容错：异常入参不抛错、接口齐备
node tools/verify/equiv.js                                                       → exit 0（零行为对拍）
  旧版来源: git HEAD:config.js + git HEAD:math.js ；新版: 工作区
  字段集一致: ✅ 相同
  存档内容(剔 ts)一致: ✅ 逐字节相同
```
**零行为变化为客观证明**（非主观声称）：旧 HEAD 与新工作区在相同输入（legacy 合成档 + 300 tick + save）下，**存档除 `ts` 外逐字节相同**，字段集一致。

## 3. L2 验证（真实浏览器）
```
node tests/ie001/browser_smoke.js    → 通过 34 / 失败 0，exit 0
  [PASS] 切片2 L2：开关默认关闭且诊断不入档
node tests/ie001/browser_interact.js → 通过 28 / 失败 0，exit 0
```
截图：本片**无界面改动**，未产生截图（按标准说明）。
日志归档：`docs/codex/reports/logs/slice2-L1-*.log`、`slice2-L2-smoke-*.log`、`slice2-L2-interact-*.log`、`slice2-equiv.log`

## 4. L3 / L4 状态
- **L3 未运行（无设备）**：仓库无 Android 设备/模拟器
- **L4 不适用**：本片未部署（开关默认关闭，无线上行为变化）

## 5. 存档前后关键字段 diff
- 用"对拍"替代（更强）：`剔除 ts 后逐字节相同`（见 §2）；字段集合 19 项未变（W03 断言）

## 6. 阈值达成情况
| 阈值（`实机验证标准.md`） | 结果 |
|---|---|
| 开关关闭时行为与改造前逐字段一致 | ✅ 存档剔 ts 逐字节相同 |
| 诊断不入档 | ✅ W03 + L2 断言 |
| 环形日志 ≤50 条且 FIFO | ✅ W02（60 次写入保留 t10→t59） |
| 基线回归全绿 | ✅ L1 36/36、L2 34/34、28/28 |
| 容错（异常入参不崩） | ✅ W04 |

## 7. 回退验证
- 开关默认 `false` ⇒ 后续切片未启用时行为与改造前一致（对拍已证）
- 彻底回退方式与步骤：`git checkout -- config.js math.js`，测试文件可保留（不影响运行）
- **未实际执行回退**（本片无失败，按纪律不制造无谓回退；回滚演练安排在 M3/M4 后各一次）

## 8. 结论
**通过**（L1 ✅ / L2 ✅ / 零行为对拍 ✅ / 阈值全部达成；L3 未运行-无设备、L4 不适用，均如实标注）

## 附：本片过程中发现并修复的 2 处问题（诚实记录）
1. `W03` 首次失败：断言中字段**排序写错**（`ts` 位置），键集合本身未变 → 修正断言排序后通过（未改生产代码）
2. `equiv.js` 首次失败：在 `loadSaveAndApply()` 之前写 `S.garrison`（此时为 null）→ 调整为先加载后冻结驻军（仅脚本修正）
