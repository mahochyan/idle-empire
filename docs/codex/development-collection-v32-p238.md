# P238｜双副本发展线的 v32 存档与在线采集后台

**后续状态（v3.27）：**[P239–P244](border-copper-coin-live-p244.md)已接通边疆铜点授级与每胜固定400铜钱；[P245–P246](outer-village-live-p246.md)接通外域首村地契/勋章；[P247–P249](border-iron-live-p249.md)接通铁点授级与在线单点采集；[P266](development-offline-collection-p266.md)再将已激活点位接入现行逐秒离线模拟。本报告正文“尚无战斗授点、离线点钟暂停”只描述P238交付当时；玩家UI、其它区域与完整净收益仍未完成。

2026-09-26。100关保持高难主线；本切片为《放置时代》式区域线建立**独立存档状态与在线单点采集**，不把区域胜利写入`S.defeated`。区域战斗、胜利加级、外域地契/勋章奖励和UI入口还没有接入，旧档迁移后点位等级0且未激活，不改变原有产能。本切片不触碰并行美化的`index.html/ui.js/visual.css/hd2d.js/sprites.js`及美术资产。

## 运行合同与源事实

参考游戏的矿点结算已在[P235](border-point-source-correction-p235.md)核实：低警戒铜/铁敌每胜加1级、点位最高500级；`autoCollect`一次只处理当前选中点位，每60秒以等级×基础量产出。**我方本批只实现采集的后半段，不给玩家凭空发点。**

- `config.js` 新增`CFG.developmentCollection`：60秒周期、500级上限、铜每级2/铁每级1的单次基础量。配置与运行状态分开。
- `math.js` 的`S.development`独立记录铜/铁点位`level,wins`、唯一`activeSite`与`elapsedSec`，并为外域村/镇/城/王都预留各自`wins,alert`。实际结构没有P231早稿中的`pending`。
- `SAVE_VERSION`升31→32，`rts_save`兼容读取；新字段进入默认值、序列化、严格校验、v31迁移与应用。合法0保留；采集周期限0–59秒、停用时必须0，等级限500；非法/未来档进入保护，自动`tick/save`不得覆盖原文。迁移前保护副本写不成时不覆盖主档。
- `selectDevelopmentSite(key|null)`仅能激活已经拥有等级的铜或铁点；切换/停用清零周期，同值调用幂等。战斗忙碌、存档保护态拒绝；写盘失败回滚选择。将来胜利授点必须与战损、奖励和区域胜次在**同一场战斗的一次保存事务**中完成，不能由按钮单独发点。
- 在线非战斗`tick()`每秒推进已激活点钟，到60秒以等级×基础量单次入库。先按现有岗位配方产出，再按现有金属仓容接收点位产量；满仓实际0、历史超仓不裁剪。采集写盘失败撤回本次点位金属和周期，保留同秒原岗位结算语义。战斗中现行`tick()`提前返回，点位时钟暂停；母本独立`setInterval`证据没有证明战斗也暂停，后续需按玩家端节奏复核。离线**暂不推进点钟且不发点位金属**，普通岗位离线规则照旧；此政策是本批的保守选择，不等于母本离线规则或全部离线设计已验证。人口自然出生和市场购契保持原有零胜场保底。

## 验证与边界

工作区为`master`，基线/最终HEAD均`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，原有大量未提交改动均保留。`index.html`业务脚本仍按`config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js`加载；未调整顺序。修改玩家运行文件仅`config.js`、`math.js`；新增[专项测试](../../tests/progression/development_collection_v32.js)。因存档正式版本变化，现有37个`tests/progression`文件和4个`tests/ie001`文件的v31/v32断言及描述同步适配，没有删除旧功能断言或把未来版误当当前版。

| 实际命令/范围 | 结果 |
|---|---|
| `node tests/progression/development_collection_v32.js` | 13/13，退出0；覆盖迁移保护、非法/未来档、合法0/500、单点切换、满仓/超仓、在线/离线差异及写盘失败回滚。 |
| `node tests/ie001/run.js` | 96/96，退出0。 |
| PowerShell逐个执行`Get-ChildItem tests/progression -Filter *.js`并排除`*browser*` | 61个脚本全部退出0；每个脚本分别调用真实游戏函数。 |
| 真实Edge/CDP执行`tests/ie001/browser_smoke.js`及`tests/ie001/browser_interact.js` | **最终版本**分别48/48、29/29，退出0；覆盖真实浏览器加载、v32保存/旧档迁移、保护态、页面与360px交互，但未包含新区域入口（尚不存在）。执行时通过`IE001_SCREENSHOT_DIR`写入系统临时目录，并在本次进程中跳过全局headless Edge预扫/退出清扫，以免干扰并行UI工作；只结束本次启动的Edge树。 |
| `node --check config.js`、`node --check math.js`、`git diff --check -- config.js math.js` | 均退出0。 |

最终浏览器复跑的实际启动方式如下，第二次只将末尾脚本名换为`browser_interact.js`，各自的截图目录均为新建临时路径：

```powershell
$env:IE001_SCREENSHOT_DIR = Join-Path $env:TEMP ('idlgame-p238-smoke-' + [guid]::NewGuid().ToString('N'))
node -e 'const r=require("./tests/ie001/edge-reaper");r.installExitHooks=()=>{};r.sweepHeadless=()=>({found:0,removed:0,remaining:0,freedMB:0});process.on("exit",()=>r.releaseLock());require("./tests/ie001/browser_smoke.js")'
```

早一轮直接运行`browser_interact.js`时，重写了原本已修改的`docs/codex/reports/assets/S14-01`至`S14-06`六张PNG；这些文件已保留，**不计作本切片的功能实现**，也未在共享工作区猜测并还原他人的原图。最终复跑新增了可选临时截图目录，未再写仓内截图；`browser_interact.js`的输出提示现已显示实际目录。

已知限制：没有可玩的边疆/外域入口，没有胜利授点与复刷净收益，采集动作目前只能在已有等级状态下使用；无连续5/10/30场、战损/粮底/仓容同档定价，也无**新双线UI/Android验收**。真实浏览器通用冒烟不等于双线玩法验收。历史P97高操作存档今天只做了**第100关单场复战**，详见[P237](current-stage100-replay-p237.md)，不能当作新档全程已可达。下一改动集先实现一处边疆战斗的独立结算与同事务加级，再做实付经济和界面接线，随后逐区扩至外域与后期主题；原创玩法仍后置。

**回退：**本地撤销仅本次v32运行/测试改动并保留此前工作区修改。若某个真实浏览器存档已经被当前代码写成v32，直接换回v31代码会将它视作未来档；应先导出主档及迁移前保护副本，按兼容迁移/恢复方案处理，不能声称旧版会自动忽略`development`。本批未推送、未部署、未修改真实玩家浏览器存档。
