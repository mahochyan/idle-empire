# P278 圣域试炼第6阶：能源甲4级实付复查

## 文档目标、代码现状、本次决定

《策划文档》仍以《放置时代》的区域材料和成长结构为骨干；100关是全部核心科技后的独立高难主线，原创玩法后置。P277在同源存档实付到第5阶，但满编第6阶11个固定种子全败。本批沿[P277第6阶败前安全档](reports/data/p277-awakening-101star-level6-fruit-seed10-terminal-save.json)继续支付一条当前可用的装备成长路线，复核第6阶边界；不直接改守卫、战斗公式、玩家存档或并行UI美化。

能源甲从3级升4级需16次锻造、每次4枚高能核心，合计64枚。起点只有17枚核心，故先真实胜出2场「战术演算机」材料战，核心17→97、警戒3200→3400，战损3名蒸汽装甲兵和4名合金特种兵。随后按当前岗位生产和训练队列付铜6000、铁6000、钢6400、粮6000，经过12模拟在线秒恢复617总军、587出战、101名星际先遣兵；最低粮325234.20。再实际调用`forgeWeapon('energyArmor')`16次，核心97→33，能源甲3→4级，未增加兵员。每段均保存并通过`rts_save`重载；[实付装备档](reports/data/p278-awakening-energy4-paid-save.json)SHA-256为`1e00aa48053f4222e250bbaddf45c55bd8a2aa780d0fcb82cbd0ff6541dfadeb`。完整来源、账目和逐种子战果见[数据汇总](reports/data/p278-awakening-level6-energy4-audit.json)。

同一入场军力、同一简单守卫面板、同一11个随机种子对照能源甲3级和4级：4级仍**0/11胜**，守卫剩余生命21181–35851；10个种子的守卫剩余生命降低，1个种子反而增加1392。最好的种子从21701降至21181，仅改善520。这里的「改善」是每种子守卫剩余HP的差，不是玩家胜率或跨档总伤害；逐种子随机事件路径可能不同。失败只发生在隔离探针，未覆盖已付安全档。

## 母本技能和成长门的下一步判定

母本`210(1)_unpacked/_analysis/entities_table.json`中，简单守卫540091具有30%概率额外真实伤害、首次防御压制敌方属性和神体下限；星际兵370009的觉醒技含按星级概率触发的减防与真实伤害，第三段到100星才解锁。当前我方`CFG.awakening`只给每星0.2%全军基础攻生增长，`math.js`没有这两者的实际战斗技能分支；因此现有11种子不能代表完整母本试炼强度。守卫技能接入会改变敌压，星际兵技能接入会改变我方输出，须同批核对战斗临时状态、兵力回写及驻军共享函数，不能只选有利一边校准。

现档`electric_armory`32级对应星际兵上限101（当前`unitCap()`口径5＋3×32），101名均已上阵。继续加兵须真实升级兵坊、训练、合法重编并支付三金属与军粮；50级对应155只是配置公式下的**条件上限**，本批未付款、未打第6阶，也未证明其能过关。下一批优先验这条人数成长、母本觉醒/守卫技能和后续高阶装备的联合影响，再决定守卫适配值；不因4级单次失败直接降低第6阶难度。

## 验证、存档与回退

本地`master`，基线与最终HEAD均`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。Windows PowerShell与Node v24.19.0；`node tools/verify/probe-awakening-core-farm-p277.js --input=p277-awakening-101star-level6-fruit-seed10-terminal-save.json --label=stage5-pretrial --count=2 --output-prefix=p278`、`node tools/verify/probe-awakening-stage5-medal-restore-p278.js`、`node tools/verify/probe-awakening-weapon-paid-p277.js --input=p278-awakening-stage5-medal-restored-save.json --weapon=energyArmor --target=4 --label=energy4 --expected-level=5 --output-prefix=p278`、11种子各一次`node tools/verify/probe-awakening-101star-pressure-p276.js --input=p278-awakening-energy4-paid-save.json --label=energy4-level6-seedN --output-prefix=p278 --seed=N --max-steps=1`及`node tools/verify/audit-awakening-level6-energy4-p278.js`，全链连续两次退出0、汇总SHA-256均为`e3712efba2caffa98647fca89be358f5c963737d8491e93b0928210a458d6b2c`。`node tests/progression/awakening_trial.js`退出0（8/8）、`node tests/ie001/run.js`退出0（96/96）、5个相关脚本`node --check`和`git diff --check -- 策划文档.md docs/codex/implementation-progress.md`退出0；P277汇总校验复跑退出0。补兵探针初次运行因VM跨realm对象的断言方式失败（退出1），把断言对象转为普通JSON后复跑通过；未改游戏实现或测试期望。真实浏览器和Android本批未运行，VM定时器/DOM替身不冒称浏览器验证。

本批新增开发探针、隔离JSON及文档记录，修改旧探针只增加可选参数，默认P277路径保持；没有新增运行时字段，`rts_save`继续v32，所有输入主档只读、输出档经重载。回退可单独撤销P278探针/隔离数据和本批文档增量，不删除玩家主档、迁移前副本或其他人UI文件。当前风险是固定随机种子仅覆盖一组编队和一级护甲，技能、兵坊上限、50小时多策略、全20阶及主线100关终局仍未验收。
