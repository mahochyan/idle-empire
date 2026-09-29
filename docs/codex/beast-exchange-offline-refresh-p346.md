# P346：边贸行离线刷新与存档边界

## 本次决定

沿现有在线规则，每结算一个可支付的离线秒，边贸行刷新钟也推进一秒。每满1200秒，刷新次数不足5次时先补1次；次数已满时自动轮换货位。离线期间不自动购买商品，也不改变交易经验、价格、掉落或战斗难度。食物不足而被截断的那一秒不推进货位。

母本经济审计`analysis-economy.md`§5记载离线结算会推进交易所／市场刷新，现有玩家代码在线`tick()`已逐秒推进边贸行，但`offlineAdvanceSec()`此前只推进特殊市场。原脚本`getExchange(delta)`使用整段封顶离线秒数；我方当前离线模拟会在断粮时截断，因此本次只推进实际计入的秒，这是本项目保护存档与资源结算的一致性选择，并非逐项复刻母本。P345的1／4／8小时查看结果仍是模拟在线样本，不能改称现实短会话结果。本次只补这个规则断点，后续仍须同一实付档重新做真实离线窗口与上线付款的资源／经验曲线。

## 改动与验收

- 基线：`master`，`f85e1c8624de8c9e17f7724373e65899d1085cdf`；没有创建分支或提交，最终HEAD相同。工作区原有UI、美术与P345文档改动予以保留。
- 玩家逻辑：`math.js`的离线逐秒结算仅在资源候选状态通过断粮检查并计入`S.tick`后调用现有`advanceBeastExchangeSecond()`；先边贸行、后特殊市场，和在线调用顺序相同。
- 测试：`tests/progression/beast_exchange_refresh.js`先以新预期复现旧行为失败（时钟1199，预期1200），随后7/7通过，覆盖满次数轮换、未满次数恢复、断粮零秒、主档写入失败回滚、重试幂等与重载。`tests/progression/beast_exchange_hide_browser.js`在真实Edge隔离存档验证离线结算、写档、页面显示及重载，10/10通过且无未捕获异常。
- 回归：所有16个直接调用`offlineAdvanceSec`或`settleOffline`的非浏览器progression文件退出0；新增独立在线／离线双市场同秒、24小时封顶与备份失败一致性测试4/4通过；`node tests/ie001/run.js`通过96/96；`git diff --check`退出0。
- 扩大全套非浏览器progression至83个文件时，82个退出0，`god_blood_reward.js`退出1。该旧测试遍历`CFG.godDomains`时把独立英魂遗境`soulStone`也当作圣兽血剂域，`materialDomainEncounter('soulStone',0)`返回`null`后访问`reward`；以`HEAD:math.js`替代当前`math.js`只读复跑仍同样退出1。此项与离线边贸改动无关，留待独立修复。

## 存档与边界

沿用v32原有`beastExchange.refreshClock`、`refreshCharges`和货位字段，未增加字段、迁移或存档键。`settleOffline()`先在内存推演，再一次写入`rts_save`；主档写入失败时恢复推演前内存状态，原文保留，可重试。备份失败由现有`writeSave()`路径中止，未改其语义。

随机货位轮换会消耗现有共享随机流，因此长离线窗口后再战的具体随机结果可能与旧代码不同；这不是有价成长已闭环的证据。货位满次数自动轮换时，未领取的旧货位照在线规则被替换，短会话仍需玩家上线选择并付款。P345的31→32级差额、60级和100关终局仍未因本次一条计时接线而验收。回退本批玩家行为只需移除`offlineAdvanceSec()`中新增的`advanceBeastExchangeSecond()`调用；不删除或降级任何玩家存档字段。
