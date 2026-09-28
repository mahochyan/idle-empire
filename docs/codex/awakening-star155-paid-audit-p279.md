# P279 电磁兵坊扩容与155名星际先遣兵实付复查

## 文档目标、代码现状、本次决定

《策划文档》要求100关作为全科技后的高难主线，另一套区域／材料线承接《放置时代》的成长与难度；原创玩法待骨干完整设计后再做。P278在第5阶安全档付能源甲4级，第6阶仍未通过，且101名星际先遣兵已经达到当时电磁兵坊32级的训练上限。本批在同源隔离档中逐级扩电磁兵坊、真实训练多一团星际兵并用合法编队动作对照第6阶，保持玩家战斗公式、守卫、存档格式和并行UI不变。

先用当前`upCost()`和`unitCap()`做[条件预检](reports/data/p279-awakening-armory-preflight.json)：32→50级18笔费用共木3851091、石3369708、粮2118104，建造计时合计909秒；每笔费用均低于当前仓容。预检仅在丢弃的VM中改建筑级别来读取现有费用函数，没有付款或保存。随后从[P278实付装备档](reports/data/p278-awakening-energy4-paid-save.json)逐级调用`buildAct('electric_armory')`并等待真实`tick()`完工，逐笔核对扣费，18级全部付完，生产及建造合计998模拟在线秒、最低粮62186.76。可重载的[50级兵坊档](reports/data/p279-awakening-armory50-paid-save.json)SHA-256为`7589bb6c5710757d274435b42fdf290747e9448b4196739a537337d7bb384787`；星际兵上限由101增至155，现有101名兵员未被凭空增加。

从50级档再分相生产三金属，经`train('star_trooper',54)`逐人支付铜／铁／钢各432000，1867模拟在线秒完成。真实清空并重建远征阵型，把原中排15名白银重甲兵退回后备，在其格位编入54名新增星际先遣兵；当前共671名兵员、626人出战、155名星际兵全数上阵，圣域异果仍130。可重载的[155兵安全档](reports/data/p279-awakening-star155-paid-save.json)SHA-256为`5624c6aff153cb687b1e5d2a3b58402e5d34c69a2152c6a6a636e8c38f07e79b`。从P278起点合计增加2865模拟在线秒，不含玩家操作和战斗动画时长。

第6阶简单守卫仍为59623进场HP、攻击16、防御23、出手规模546。以155兵安全档为唯一来源，先用原前排＋第三星际中排跑11种子，**0胜**，守卫余20821–34493 HP。再通过真实`clrForm`／`openFormModal`／`confirmForm`动作，对基线、1团星际前置、2团前置、3团前置等6种完整合法阵型各跑同一11种子，共66场仍**0胜**；六组中基线的最低敌余HP最佳。星际兵前置样本变差只说明这些受测阵序与固定流不利，不能推出所有阵型或更高质量成长都无效。败局只在隔离VM中结算，两个安全档未被覆盖。逐种子战果及费用见[汇总校验](reports/data/p279-awakening-star155-audit.json)。

## 判定、验证与回退

本批把「101人训练上限」从条件判断变成已付款、可重载的155兵事实，但第6阶缺口没有闭合。母本370009星际兵觉醒技与540091简单守卫技能都还未接入我方临时战斗体；必须连同兵力回写、远征／驻军共享路径一起实现和验收，再比较后续装备、神炼和20阶曲线。当前星际兵质量及合法阵位组合也需复核，不能直接压低守卫数值。第100关高难主线、完整科技／量子、自然驻军与50小时多策略仍另行验收。

本地`master`，基线／最终HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；保留用户及其他agent未提交文件。Windows PowerShell、Node v24.19.0。`node tools/verify/probe-awakening-armory-preflight-p279.js`、`node tools/verify/probe-awakening-armory-paid-p279.js`、`node tools/verify/probe-awakening-star155-paid-p279.js`、11次`node tools/verify/probe-awakening-101star-pressure-p276.js --input=p279-awakening-star155-paid-save.json --output-prefix=p279 --seed=N --max-steps=1`、`node tools/verify/probe-awakening-star155-formation-p279.js`及`node tools/verify/audit-awakening-star155-p279.js`全链连续两次退出0，汇总SHA-256均为`021f71472a39be310652d66b8be52a0421b95ca7dd4c8feddce0b8c0b51dfb05`。`node tests/progression/awakening_trial.js`退出0（8/8），`node tests/ie001/run.js`退出0（96/96），P278校验、五个P279脚本`node --check`、`git diff --check -- 策划文档.md docs/codex/implementation-progress.md`和报告本地链接检查均退出0。首次兵坊脚本将1002人口全分配到单一粮岗，碰到现有每岗位999上限而退出1；修正为999粮＋3木后复跑成功，没有改玩家逻辑。真实浏览器和Android本批未运行，VM中的DOM／计时器替身不等同浏览器验证。

只新增开发探针、隔离JSON和策划／实施记录；输入存档只读，所有交付档由当前`save()`生成并重载，`rts_save`仍v32。回退可撤销本批探针、数据及文档增量，不能删除或覆盖玩家主档、备份及并行UI美化文件。固定11种子与6个阵型不是玩家胜率或完整阵型空间，实付时长也不证明50小时成长目标。
