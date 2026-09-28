# P233｜双副本入口与采集点选择的 UI 接缝（只读复核）

**后续状态（v3.16）：**[P238](development-collection-v32-p238.md)已实现真实`selectDevelopmentSite(key|null)`，只允许选已有等级的铜/铁点；[P239](development-border-battle-p239.md)已实现真实`openDevelopmentBorder('copper')`，铜科技和出征编队由动作层校验，胜利同次保存战损/胜次/铜点等级。下表`setActiveDevelopmentSite`、`openDevelopmentEncounter`只是P233当时的接口示例，接UI时应使用现行实际函数；铁点战斗及外域尚无正式入口。本文其余只读审计是2026-09-26的历史快照，UI美化仍在并行，不要按旧SHA覆盖文件。

2026-09-26 14:54 UTC（香港时间 22:54）检查当前共享工作区。只读审计；**本单仅新增本报告**，未编辑 `index.html`、`ui.js`、`visual.css`、`hd2d.js`、`sprites.js`、任何资产或总策划，未运行浏览器测试。100 关仍是高难主线；发展副本是独立的边疆/外域线，采集点的状态与规则另见 [P231](frontier-v32-save-design-p231.md)。

## 当前并行 UI 改动边界

基线 `master`、HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。下表是一次文件系统快照，**时间戳只能证明最近写入，不能证明此刻是否有人正持有编辑器**；因此后续实现前须重新取 SHA 与 diff。

| 文件 | `git` 状态与改动范围 | 最后写入 UTC；此快照 SHA-256 |
|---|---|---|
| `index.html` | 已修改，`+772/-181`；顶部资源栏、底部导航、`#main`、战斗屏与大量内联 CSS 均在改动范围 | 14:17:19；`153a1adcc04019d05e2d6caf6ed7b077eafe7a14dd9ed4d4976eb89e777f1b86` |
| `ui.js` | 已修改，`+880/-175`；`renderPage`、主页地图、`rFight()`、设置、导航均有差异块，未来新增入口会触及同一片区 | 14:17:19；`dda07b2113529ec88b566e9f07e5024a405644db410e8de50578a5b0124ab464` |
| `visual.css` | 未跟踪的新主题样式；覆盖 `#main`、`.card`、`.btn`、`#navbar`、`.nav-btn`、明暗主题与 320px 小屏 | 14:36:43；`0bd0156bfabbaa850042424d5192d7ee2017cc27b0cc16fb5329b41ce3107c64` |
| `hd2d.js` | 未跟踪的立体表现层；与主城地图/战斗场景挂载有关 | 14:46:34；`63756cf3e05affd26f9271ae93a9860cc30e18fa41fd79634363744f31932d64` |
| `sprites.js`、`assets/art/`、`assets/hd2d/` | 像素图标已修改，艺术与立体资产目录未跟踪；地图热点与图标层正在并行变化 | 不在本单编辑范围 |

`index.html:1565` 加载 `visual.css`；`index.html:1656–1668` 先加载 HD2D 表现层，再按 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js` 顺序同步加载业务脚本。`index.html:1604–1609` 底部导航固定五项，其中 `data-page="fight"` 已存在。**最小双线入口不改五项导航、不增静态 DOM、不碰主城热点或 HD2D 资产**，将未来 UI 补丁限定在战斗页渲染接缝；这也避开当前美化主工作面。`tests/visual/browser_smoke.js` 还断言五项导航顺序，贸然加第六项会直接改变验收契约。

## 现有调用链和最小接线位置

| 接缝 | 当前真实路径 | 后续最小接法 |
|---|---|---|
| 顶部入口与渲染 | 底部战斗按钮切 `S.page='fight'`，`ui.js:14` `updateUI()` → `ui.js:63` `renderPage()` → `ui.js:1024` `rFight()`；`renderPage` 用 `#main.innerHTML` 重建页面。`math.js:519` 的 `setFightTab()` 只切既有“远征/驻军”。 | 保持这条路径及远征/驻军标签。在 `rFight()` 远征阵容卡之后加**一层页面内视图选择**：“帝国战役（100 关）/边疆开拓”；选择只控制展示，默认帝国战役，主线关卡 `S.selEnemy` 不变。视图选择可用 UI 局部变量，勿塞进 v32 永久状态。 |
| 100 关主线 | `ui.js:1071–1095` 关卡选择使用 `CFG.enemies[S.selEnemy]`、`S.defeated`、`selEnemy()` 和 `openBattle()`。`math.js:2821` 无 encounter key 时按主线开战。 | 仅把现有选择卡保持在“帝国战役”视图；不改 `CFG.enemies` 下拉、主线已通关/首通文案及解锁动作门。发展线不能复用 `selEnemy`/`S.defeated`。 |
| 发展线战斗 | 现有 `rFight()` 下面另有郊野猎场、材料域等可重复挑战卡；其按钮调用 `openMaterialDomain()`/`openGodDomain()`，核心 `openBattle(encounterKey)` 只认当前 `specialEncounterConfig()`。 | 待 P231 的独立 `borderSite/outerRegion` 核心动作完成，再给“边疆开拓”视图渲染边疆与外域卡；按钮调用**带区域键且在 math 动作层验证的入口**（例如 `openDevelopmentEncounter(key)`），不能只在 UI 改成 `openBattle()` 或借现有材料域键。已有郊野/材料域先保留原位置或明确归为共享“资源挑战”，不要随双线卡顺手搬迁。 |
| 激活采集点 | `index.html:1579–1580` 已有铜/铁库存；`ui.js:14–61` `updateUI()` 每次刷新顶部实际库存，`rHome()` 和 `renderMetalModeCard()` 显示的是**岗位加工**的下一秒净变化和原料。 | 在发展线的边疆卡显示两点等级、唯一当前激活点、周期剩余秒、仓容与单次实得预览；“激活铜点/激活铁点/停用”按钮只调用核心 `setActiveDevelopmentSite(key|null)`，由核心检查拥有等级、保存保护、同值幂等和写盘失败回滚。库存沿用顶部 `res-copper/iron`，无需新增全局顶部资源项；点位产出不能合并为岗位“每工每秒”文案。 |
| 每秒刷新与视觉 | `updateUI()` 在战斗进行时先返回，其他时间重建当前 `#main`；`renderPage()` 在输入框/选择框聚焦或人口确认弹窗开启时避免重建。主城地图还单独保留 DOM 节点并驱动 HD2D。 | 发展线倒计时从持久 `development.border.collection.elapsedSec` 读，不设 UI 自己的计时器；切换视图或行动后调 `updateUI()`。动态按钮用现有 inline handler 或 `#main` 委托，因为每秒重建会销毁一次性绑定。切页与弹窗阻断时可下一次 tick 再刷新，不凭 UI 文本计算奖励。 |

页面命名服务我方主题，“帝国战役/边疆开拓”仅为入口文案提案；内部稳定键可用 `campaign/development`，区域文案继续用我方命名。若发展线某区域还未实现，展示“尚未开放”而不让按钮指向普通主线或旧材料域。UI 的 disabled 仅用于反馈，真正的点位归属、阵容、科技/区域门、存档保护和写盘失败必须在动作函数校验。点位切换是否清零周期及满仓处理以 P231 后续规则为准，UI 不先定义玩法。

## 并行集成与浏览器验收

未来实施双线 UI 时，先重新取 `index.html/ui.js/visual.css/hd2d.js` 的 SHA、当前 `git diff` 与时间戳；只在完成核心 v32 接口后编辑 `rFight()` 附近的最小 hunk，并以当前**完整工作区**做合并和测试，不从 HEAD 覆盖同事未提交美化。当前 `visual.css` 的浅色/夜间、按钮尺寸及 `#main` 规则会作用于新卡片；优先复用 `.card/.btn`，如需新样式再与 UI 同事协调，不在 P233 改样式。主城地图热点 `openTownTarget()` 和 HD2D `onSelect` 已有自己的映射，不是首个发展线入口的必要修改点。

浏览器验证入口已在仓库：`node tests/visual/browser_smoke.js` 用隔离 Edge/CDP 与本地 HTTP，覆盖五项导航、`fight` 页、320/360/390/430 CSS px、明暗主题与 HD2D 视觉；后续应在其上补双线切换、键盘/触控可达、横向溢出、阵型保持、旧档默认、采集点激活/取消后存档重载、60 秒倒计时与满仓实得、错误提示及旧异步回调无重复奖励的交互断言。`node hd2d-tests/renderer_browser.js` 只测表现层，`tools/verify/probe-ui-beautify.js` 只查样式命中，均不足以证明新玩法。WebView 还需单独设备/模拟器冒烟；VM/localStorage 模拟不能代替真实浏览器。**本报告没有把这些未来测试写成通过。**

审计命令：`git status --short`、`git branch --show-current`、`git rev-parse HEAD`、`git diff --stat/--numstat/--unified=0`、`Get-Item`、`Get-FileHash`、`Get-Content`、定向 `rg` 均退出码 0；一次写错引号的组合 `rg` 退出码 1，随后拆分重查。未运行功能或浏览器测试。
