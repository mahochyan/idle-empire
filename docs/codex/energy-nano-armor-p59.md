# P59 能源／纳米护甲与双材料3500实付边界（2026-09-24）

本批沿《放置时代》的军备成长骨干补齐电磁甲后的两件护甲，在我方电力阶段使用「能源甲」「纳米甲」的机械名称；神祇挑战仍使用后期西幻的守御之神、杀戮之神和神族之核。原创玩法后置。输入是P58同一第45关实付材料档，不赠送知识、勋章、神核、兵员或胜场。

## 母本依据与本次实现

`210(1)_unpacked/_analysis/entities_table.json`：470075能源甲研究接470074电磁甲，费用知识300万＋勋章8万、解锁220072；470076纳米甲研究接470075，费用知识350万＋勋章10万、解锁220073。两件护甲均满级40、初始防御5、每级再加5、首件20次锻造，每次神族之核4；母本`Need2`分支从20级起改为每次10核。前置使用现有电力科技和研发动作门，不因科技页按钮被禁用就假定动作安全。此次不改兵种人数、Boss模板、战斗回合上限或材料奖励倍率。

母本能源甲文字为首次攻击前按电磁兵入场生命20%增加最大生命，入场生命每550再加15%；纳米甲为首次攻击前减少自身入场防御并获得其100%的攻击，入场生命每550再加30%。我方把「入场生命」映射为本团`initialCount × hpPerSoldier`，离散等级为`floor(入场生命／550)`；整数生命与攻击向下取整。能源护甲同时增加本场当前生命使加成即时有效，并以首次出手前的幸存人数作为本场上限，避免把已阵亡兵员补回。纳米护甲按入场防御给临时攻击，并把当前防御最多降至0。两项都只改战斗体，首次有效目标前触发一次，即使本次攻击失手也不会第二次触发；远征和驻军共用函数，重建阵容仍按开战人数上限回写。这是母本描述到我方聚合HP战斗模型的适配，不宣称逐兵原式完全一致。

新增`weaponForgeStepCost`使20级后的费用在动作函数与UI同源；科研／锻造／装备写档失败沿原军备回滚路径处理。新存档v25只加两件装备状态；v24及更早版本在独立候选上补默认值，先保留迁移前原文，坏新键／未来v26保护主档并阻止tick写回。`index.html`缓存号V17，脚本顺序仍为config→levels→sprites→math→garrison→technology→ui。UI列出研发前置、费用、锻造当前档费用、技能与装备动作。

## 同档实付与战斗复刷

输入`%TEMP%\p58-combined-materials-save.json`为P58真实七团、四前排、45关v24档，在线秒5423307，勋章211620，神核377，晶核660，守御石1457，知识容量5001920；两处材料挑战警戒值均3500。以固定`Math.random=0.5`复刷旧档，机巧遗迹失败余310HP、守御之神失败余541HP。开发探针即时执行战斗回调；岗位、研究、逐次锻造、编队、实训补员、战损、结算和存档仍调用实际实现。时间单位为模拟在线秒，不含真人操作与动画。

| 同一存档的已付款节点 | 知识／勋章实扣 | 神核实扣或实得 | 终点在线秒 | 结果 |
|---|---:|---:|---:|---|
| 能源甲研发＋20次首件锻造 | 300万／8万 | −80，余297 | 5426356 | 1级可装备 |
| 纳米甲研发＋20次首件锻造 | 350万／10万 | −80，余217 | 5429913 | 1级可装备；双1级复刷仍败，遗迹余37HP、守御余208HP |
| 纳米甲1→4级，能源甲1→2级 | — | −216，余1 | 5429913 | 遗迹3500可胜、3600仍败；守御3500仍余35HP |
| 杀戮之神警戒值3200／3300／3400三胜 | 勋章+4896 | +121，余122 | 5472210 | 3500失败，敌余518HP；不把失败算奖励 |
| 能源甲2→4级 | — | −120，余2 | 5472210 | 双甲各4级可装备 |
| 同档先胜机巧遗迹3500，再胜守御之神3500 | 勋章各+1680，最终39876 | 不变 | 5508905 | 晶核660→702（+42）、守御石1457→1541（+84）；两处警戒值均进到3600 |

独立复刷双4级付费档的3600警戒值：机巧遗迹余17HP、守御之神余195HP，均失败。最后一行的两次3500胜利由**同一**v25档串行支付、补员和结算；杀戮之神三胜也发生在此档此前，不是条件副本。最终神核2、勋章39876，离核能80万勋章尚差760124；知识容量仍5001920，离核能单笔知识1亿容量差94998080。P58图书馆／仓储路线的长期容量墙没有被此军备批次解决。输入至最终追加85598模拟在线秒（约23.8小时），只是P58高投入档之后的一段，不是新开局达到此节点的总时长或真人体验。

## 验证、范围与回退

专项`node tests/progression/energy_nano_armor.js`6/6：核对源表、前置和逐次费用、20级后的10核阶梯、写档失败回滚、旧档迁移和保护、战斗临时生命不返还损兵、远征回调与驻军共用技能。47个非浏览器成长脚本全部退出0；`node tests/ie001/run.js`96/96。真实Edge/CDP `era_chain_browser.js`在360／400宽度首跑497通过／1失败（400宽度旧冶铜炉建筑计时检查Lv0），未改实现而复跑498／498退出0；新增能源／纳米两件UI逐笔付款、装备和刷新后存档检查均通过。`browser_smoke.js`43／43和`browser_interact.js`28／28退出0，浏览器异常列表为空。实体Android／WebView未运行；Node的DOM／计时器替身不等于真实浏览器。上述随机固定的单策略结果不可外推所有玩家胜率或50小时内容长度。

实付探针命令：

```powershell
node tools/verify/probe-energy-nano-p59.js --save="$env:TEMP\p58-combined-materials-save.json" --energy-save="$env:TEMP\p59-energy-paid-save.json" --snapshot-final="$env:TEMP\p59-energy-nano-paid-save.json"
node tools/verify/probe-armor-upgrade-p59.js --save="$env:TEMP\p59-energy-nano-paid-save.json" --armor=nanoArmor --level=4 --snapshot-final="$env:TEMP\p59-nano4-paid-save.json"
node tools/verify/probe-armor-upgrade-p59.js --save="$env:TEMP\p59-nano4-paid-save.json" --armor=energyArmor --level=2 --snapshot-final="$env:TEMP\p59-energy2-nano4-paid-save.json"
node tools/verify/probe-medal-stage45.js --save="$env:TEMP\p59-energy2-nano4-paid-save.json" --domain=medal --battles=15 --replenish --front-armor --aux-reserve --electric-reserve=40 --snapshot-final="$env:TEMP\p59-armors-medal-return-save.json"
node tools/verify/probe-armor-upgrade-p59.js --save="$env:TEMP\p59-armors-medal-return-save.json" --armor=energyArmor --level=4 --snapshot-final="$env:TEMP\p59-energy4-nano4-paid-save.json"
node tools/verify/probe-medal-stage45.js --save="$env:TEMP\p59-energy4-nano4-paid-save.json" --domain=godCrystal --battles=1 --replenish --front-armor --aux-reserve --electric-reserve=40 --snapshot-final="$env:TEMP\p59-crystal-3500-paid-save.json"
node tools/verify/probe-medal-stage45.js --save="$env:TEMP\p59-crystal-3500-paid-save.json" --domain=guardianStone --battles=1 --replenish --front-armor --aux-reserve --electric-reserve=40 --snapshot-final="$env:TEMP\p59-both-materials-3500-paid-save.json"
```

上述七条均退出0；挑战探针若记录战败仍以可重现边界呈现。`master`基线／最终HEAD均`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，原有大量未提交内容保留，未reset、提交、推送或部署。参考快照`98571e38801f71bfdbb982a626e0e58f510abb98`实际Git日期2026-05-17，与AGENTS记载2026-09-18不一致；其列举的四份背景文件及两份未取得的审计／迁移矩阵仍缺失，本批未据其声称已实现。回退前需导出v25主档与`rts_save_premigration`保护原文；旧v24代码不认识v25，不能直接用旧代码写回或删除新增字段。只撤本批代码与文档增量并保留可恢复档，再核对装备状态和此前v24进度。
