# 切片 9 报告 · 存档 v3 骨架（ops / offline / daily）

## 1. 范围
- 来源：`分期计划.md` 切片 9 = 改造点 **B1**（规格 S3 + U-S3a 裁决：v3 = v2 + `ops` + `offline.pendingReport` + `daily`）
- 改动（3 个生产文件）：
  - `math.js`：`S` 新增 `ops/offline/daily`；新增 `targetSaveVersion()` 与 `SAVE_V3_KEYS`；`serializeSave` 按目标版本条件写入；`validateSave` 增 v3 校验（缺字段/ops 非数组或超 200 条/offline 结构/daily.counts 负数 → 保护）；`migrateSave` 对 v<3 补齐三字段并升版；`applySaveToS` 逐字段安全赋默认
  - `config.js`：`CFG.save = { v3:true }`（**回滚开关**）
- 回滚：`CFG.save.v3=false` → 立即回到 v2（不写新字段、版本为 2）

## 2. L1（命令/输出/退出码）
```
node --check math.js/config.js/tests/ie001/run.js → exit 0
node tests/ie001/run.js                          → 通过 66 / 失败 0，exit 0
  [PASS] F01 v2→v3 迁移补齐三字段、版本升 3、进度字段不动
  [PASS] F02 迁移幂等（二次迁移 filled 为空）
  [PASS] F03 坏 v3 字段 → 保护（ops 非数组 / daily.counts 负数 / 缺 daily）
  [PASS] F04 v3 往返（ops 内容 / offline.pendingReport / daily 全保留）
  [PASS] F05 关闭开关＝v2 原样（无新字段、老档不受影响）
  [PASS] F06 未来版本（v=4）拒绝
node tools/verify/equiv.js                       → exit 0：【全开关关闭（含 save.v3）⇒ 存档剔 ts 与 git HEAD 逐字节相同】
```

## 3. L2（真实浏览器）
```
node tests/ie001/browser_smoke.js    → 34/34 exit 0（含"写出 v3+ts+骨架字段"新断言；reaper 回收旧 profile 20 个）
node tests/ie001/browser_interact.js → 28/28 exit 0
```

## 4. 存档兼容矩阵（全部实测）
| 场景 | 结果 |
|---|---|
| legacy（无 v）→ v3 | ✅ 迁移补三字段 + 原有 legacy 补齐；PRE 副本=原文 |
| v2 → v3 | ✅ 进度字段不增不减；`v` 升 3；二次迁移幂等 |
| 坏 v3 字段 | ✅ 进保护模式（不静默裁剪、不覆盖） |
| v3 往返 | ✅ ops/offline/daily 内容保留 |
| 未来版本 v4 | ✅ 拒绝（future） |
| 关闭开关 | ✅ 与 HEAD 逐字节相同（v2 路径完好） |

## 5. 断言口径更新披露（v2→v3，共 11 处，均保留原检查强度）
| 位置 | 更新 |
|---|---|
| L1 `S01`/`S02`/`S09`/`V01`/`V02` | `v===2` → `v===3`（仍逐项校验内容/备份/PRE） |
| L1 `W03` | 字段集期望加入 `daily,offline,ops`（22 字段，仍为精确集合断言） |
| L1 `A03` | 状态接受 `ok|migrated`（v2 旧档现在会迁移到 v3，属预期） |
| L2 smoke ×3 | 导出回显 / 主档升级 / 开关断言改为 v3；仍校验 `res.wood`、`merit` 不变 |
| L2 interact ×1 | `T8 导入确认后主档写入 v3`，仍校验 `S.defeated.length===3` |

## 6. 结论
**通过**（L1 66/66、L2 34/34 + 28/28、froze：全开关关闭与 HEAD 逐字节相同）

## 7. 为后续切片铺好的接口
| 后续 | 用到的 v3 字段 |
|---|---|
| 切片 10（幂等层） | `S.ops`（环形记录，≤200 条，校验已就位） |
| 切片 11（离线结算） | `S.offline.pendingReport`（待展示报告，展示后清空）+ 既有 `ts` |
| 切片 13（交易所日限） | `S.daily.{day,counts}`（日界=本地 0 点，跨日重置） |
