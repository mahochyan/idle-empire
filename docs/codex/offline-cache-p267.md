# P267｜逐秒离线产率与仓容缓存

2026-09-27。100关「帝国战线」保留为高难主线，「拓境远征」沿《放置时代》式区域发展承接材料。P266把边疆矿点接入动态离线后，同一实付档24小时上限结算约需43–46秒墙钟。本批只减少逐秒循环里重复求取的岗位产率和仓容；资源、队列、口粮、点位及战斗规则不变，不编辑并行UI美化文件。

## 文档目标、代码现状、本次决定

《策划文档》§8要求在线／离线／主动操作三时钟共同校准；这不是已经完成的功能验收。现有`offlineAdvanceSec()`逐秒推进建筑、队列、资源配方、断粮和点位。每一秒每种资源都重新执行`prodRate()`与`resCap()`，而离线窗口内没有玩家操作，岗位分配、科技、模式和存储精通不会改变；建筑或城镇完工是会改变产率／仓容的已有事件。

本批在离线开始时读取真实`prodRate()`与`resCap()`，建筑／城镇完工当秒重建缓存，然后继续逐秒调用真实`productionSecond()`与`productionAndDevelopmentSecond()`。库存、原料可付性、队列付款、维护和人口口粮、仓容钳制、点位60秒时钟、断粮回退仍在每秒检查。在线`tick()`与显示净速率不使用此缓存。未引入闭式按速率乘时长的替代模拟；没有新增存档字段或更改0.6离线系数。

## 同档验证与性能界限

[P267探针](../../tools/verify/probe-offline-cache-p267.js)读取[P250真实15级铁点v32档](reports/data/p250-iron-point-l15-save.json)，输入原文SHA-256为`93eb9115dfb53ac3573b90eaae16606b9b1eb6840fe29d89bb816ba1b2cac977`。无缓存臂只在隔离VM中让生产函数忽略缓存参数，仍调用同一真实实现；缓存臂按当前实现运行。各模拟3600离线秒后，资源、边疆点位、兵池、训练队列、建筑、城镇与tick的JSON快照完全一致。该次开发机墙钟无缓存约336.59毫秒、缓存约143.97毫秒；时间是单次观测，不是设备基准。

同一来源档再实跑`settleOffline()`的86400秒上限，约8356.56毫秒完成；铁272→600，仓容600、点位时钟仍17秒，重复调用不二次入账，保存后重载经济快照相同。[机器可读结果](reports/data/p267-offline-cache.json)保存输入哈希、两臂时长、等价判断和24小时回执。P266的43–46秒与本批8.36秒是不同批次单次测量，只能说明这台开发机的长窗等待明显缩短，不能推出安卓/WebView必然同速。高兵量训练、密集建筑完工、断粮和其它后期档未做长窗性能测量。

## 验证、兼容与回退

分支`master`，基线／最终HEAD均`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；原有大量未提交改动保留。工作约定中的参考SHA`98571e3…`本地Git日期为2026-05-17，并非约定文字的2026-09-18，未据此回退。改动限`math.js`缓存路径、`economy.js`回归、P267实档探针／数据及文档。业务脚本顺序仍为`config.js→levels.js→sprites.js→math.js→garrison.js→technology.js→ui.js`；未编辑`index.html`、`ui.js`、`visual.css`、`sprites.js`、`hd2d.js`或资产。

新增`economy.js`两例在旧逻辑下11通过／2失败（退出1）；修正后13/13退出0。其中一例计数600秒窗口的真实产率／仓容函数调用，另一例把仓库与学院同秒完工后的离线资源与在线逐秒推进比较。`development_collection_v32.js`16/16、`food_transition.js`11/11、`metal_chain.js`27/27、`development_border_v32.js`10/10、`beast_exchange_refresh.js`5/5、`node tests/ie001/run.js`96/96均退出0。P267实档探针、相关JS语法检查、`git diff --check`退出0；diff检查只有既有LF/CRLF转换提示。P266真实Edge48/48是上一批证据，本批未重跑浏览器，也未运行Android/WebView。

实际命令及退出码：`node tests/progression/economy.js`（先1、后0），`node tests/progression/development_collection_v32.js`（0），`node tests/progression/food_transition.js`（0），`node tests/progression/metal_chain.js`（0），`node tests/progression/development_border_v32.js`（0），`node tests/progression/beast_exchange_refresh.js`（0），`node tests/ie001/run.js`（0），`node tools/verify/probe-offline-cache-p267.js`（0），`node --check`分别检查上述改动的三个JS文件（均0），`git diff --check`（0）。

`rts_save`继续v32，未增删序列化字段；合法0、历史超仓、坏档／未来档保护、备份失败中止、写档失败回滚路径未改。撤回本批只需撤离线生产缓存参数及调用、专项测试/探针/数据和文档增量，不删除现有点位等级、资源或主档；回退旧代码仍需独立验证该版本对玩家存档的读取。
