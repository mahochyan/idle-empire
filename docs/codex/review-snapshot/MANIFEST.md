# IE-001-review 快照 manifest

- 生成时间：2026-09-18（R1 补件轮）
- 基线 SHA（完整）：`98571e38801f71bfdbb982a626e0e58f510abb98`
- 当前 HEAD：`98571e38801f71bfdbb982a626e0e58f510abb98`（本工作包全部改动保持未提交）
- 分支：`master`
- 生产文件测试后是否又改动：**否**。三份最终日志（logs/）即当前工作区代码的产物；其后仅新增/修订文档与本快照，未再触碰 math.js / ui.js / tests/。

## git status --short --untracked-files=all（IE-001 相关节选；全仓 untracked 共 809 条，其余为先前 APK 逆向分析产物，与本工作包无关，未入包）

```text
 M math.js
 M ui.js
?? AGENTS.md
?? docs/codex/IE-001-save-safety.md
?? docs/codex/reports/IE-001.md
?? docs/codex/reports/assets/S14-01-home-360.png
?? docs/codex/reports/assets/S14-02-settings-360.png
?? docs/codex/reports/assets/S14-03-import-typed-360.png
?? docs/codex/reports/assets/S14-04-protected-export-360.png
?? docs/codex/reports/assets/S14-05-restore-list-360.png
?? docs/codex/reports/assets/S14-06-final-360.png
?? docs/codex/reports/logs/run-browser-interact.log
?? docs/codex/reports/logs/run-browser-smoke.log
?? docs/codex/reports/logs/run-node.log
?? docs/codex/review-snapshot/IE-001-worktree-vs-98571e3.patch
?? tests/ie001/browser_interact.js
?? tests/ie001/browser_smoke.js
?? tests/ie001/run.js
```

## git diff --stat（工作区 vs 基线，仅生产文件）

```text
 math.js | 172 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++-----
 ui.js   |  68 ++++++++++++++++++++++++-
 2 files changed, 228 insertions(+), 12 deletions(-)
```

## 包内文件清单

| 包内路径 | 来源 | 说明 |
|---|---|---|
| `MANIFEST.md` | 本文件 | — |
| `src/math.js` | 工作区终版 | 完整文件（非 diff 替代） |
| `src/ui.js` | 工作区终版 | 完整文件 |
| `IE-001-worktree-vs-98571e3.patch` | git diff | 未提交 diff，审查用 |
| `tests/ie001/run.js` | 工作区（未跟踪，显式打包） | 23 用例 Node 回归 |
| `tests/ie001/browser_smoke.js` | 同上 | 28 断言 S13 冒烟 |
| `tests/ie001/browser_interact.js` | 同上 | 28 断言 S14 交互 |
| `reports/IE-001.md` | 工作区 | R1 修订版完整报告 |
| `logs/run-node.log` | 最终运行 | exit 0，23/23 |
| `logs/run-browser-smoke.log` | 最终运行 | exit 0，28/28 |
| `logs/run-browser-interact.log` | 最终运行 | exit 0，28/28 |
| `assets/S14-01…06-360.png` | 最终运行截图 | 360×800 视口，合成测试档 |

不包含：`.git`、`node_modules`、浏览器用户数据、Edge 临时 profile、玩家私人存档（本仓库为开发仓库不含）、真实设备信息。截图内全部为合成测试档。

## 复跑命令与环境要求

```text
环境：Windows；Node v24.19.0（≥21：需原生 fetch/WebSocket）；Microsoft Edge（默认安装路径自动探测）
node --check math.js && node --check ui.js
node tests/ie001/run.js               # 期望 23/23，exit 0
node tests/ie001/browser_smoke.js     # 期望 28/28，exit 0（自启 headless Edge+随机 CDP 端口）
node tests/ie001/browser_interact.js  # 期望 28/28，exit 0（截图写入 docs/codex/reports/assets/）
```
注意：两个浏览器套件内仓库 URL 写死为 `file:///E:/AIprogram/idlgame/index.html`（复跑目录不同时需改该行）；Edge 临时 profile 建在 `%TEMP%`（ie001-*），沙箱环境可能拒删。保留 Edge/CDP 方案，未要求迁移测试框架。
