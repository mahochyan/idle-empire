# P298：拓境远征入口接入远征页

日期：2026-09-28。文档目标是「帝国战线」100关承担陡峭高难主线，「拓境远征」承担《放置时代》式发展与材料成长。代码现状是六个边疆／外域副本已有科技门、真实战斗、结算、持久化与测试，但 `ui.js` 没有调用 `openDevelopmentBorder` 或 `openDevelopmentOuter` 的玩家入口；玩家无法正常使用发展线。本批决定只补远征页入口与采集点切换反馈，保持既有美术、CSS、数值、战斗和存档结构。

远征页新增「拓境远征」卡：两处边疆矿点、四档外域村镇城及王都列出主题名、科技门、当前点位等级／胜场、有效战斗警戒与基础战利品。按钮沿用动作函数校验，只有研究且有远征编队时可点；边疆占点后可选择或停止唯一的周期采集点，倒计时单位为秒。100关关卡选择与郊野／神域卡保持原位，拓境胜利不写主线 `defeated`。卡片复用原有样式，未改 `index.html`、CSS、图片或全局排版。

本批顺手复核母本 `210(1)_unpacked/_analysis/entities_table.json` 的 `180001` 来源说明及 `deob_main.js` 字符位 1536676 起的 `winBigWar`：村／镇／城胜利有小概率血剂，王都另有血剂与攻击药低概率来源；其概率依赖战前杀戮值、来源奖励倍率及上限。该来源**尚未映射到我方掉落**，不能把当前外域只发地契／勋章说成已完全对齐，也不在此入口批次暗改掉率。后续需单独校准警戒成长与掉率，再测补兵净收益。

基线／最终均为本地 `master` 的 `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，本批不提交、不推送。开工 `git status --short` 已显示大量既有未提交差异；本批修改 `ui.js`、`tests/progression/development_border_browser.js`、本报告、`策划文档.md`、`docs/codex/implementation-progress.md` 与一张验证截图。AGENTS 指向的参考 SHA `98571e...` 为审查参考而非回退目标，当前工作区实施未切换版本；该提交实有时间为2026-05-17，并非AGENTS声称的2026-09-18。

验证（Windows PowerShell、Node v24.19.0）：`node --check ui.js`、`node --check tests/progression/development_border_browser.js`、`node tests/progression/development_outer_v32.js`（13/13）、`node tests/progression/development_border_v32.js`（10/10）均退出0；74个非浏览器进度脚本逐个退出0，`node tests/ie001/run.js` 为96/96、退出0。真实 Edge/CDP 360px `node tests/progression/development_border_browser.js` 初次因新测试表达式的引号转义错误退出1，修正测试脚本后重跑51/51、退出0：入口显示、锁定状态、卡片点击开战、占点后选择和停止、六副本原有异步结算及重载均通过，零未捕获异常。测试浏览器使用 E 盘独立临时 profile，不触及玩家档。[360px截图](reports/assets/p298-development-route-360.png)已目检：标题、六区域信息和按钮在卡片宽度内，未见横向溢出；原有美术样式仍由并行工作负责。`git diff --check` 退出0，仅有既有 LF/CRLF 提示。实体 Android/WebView 未运行，不能声称已通过。

存档兼容：没有新字段、版本号或迁移；新卡读取现有 `S.development`，占点按钮沿用 `selectDevelopmentSite()` 的先保存、失败回滚逻辑，胜利仍走既有事务。已知限制：基础奖励会受仓容影响，显示不等于实入；母本外域稀有掉落、发展副本长期净收益、50小时多策略及百关全科技终局仍待验。回退本批只需移除远征页新增卡片／薄封装与浏览器断言，并恢复文档记录；不得对既有大范围脏工作区执行 reset。
