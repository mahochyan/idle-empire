# P283 圣域守卫被动与纳米甲实付接力

## 范围与依据

《策划文档》规定100关为全科技后的高难主线，圣域试炼属于参照《放置时代》的独立发展线。本批只补试炼守卫已核到的防御被动，复核第5、6阶真实战斗与一个可付款的第5阶军备接力；不改100关、资源奖励、UI、美术或存档结构。

母本解包脚本`210(1)_unpacked/_analysis/deob_main.js`约偏移2271450–2272350、2309580–2310800及实体说明540091–093分别给出首次受击的临时属性三倍压制、守卫攻击恢复至入场70%及防御恢复至10%、首次防御按对手每1000兵给友方+2%入场攻击。另核`ArmySeaList`的「神炼」是装备/技能切换动作，不能当免费叠加属性；星阵研究450123／450223需知识2亿／3亿及勋章100万／200万，远超本批实付档的160589045知识仓与3万余勋章，不是当前第5阶的免费解法。这里只把源被动适配到我方聚合守卫战斗体：压制不治疗、不增加兵员，只对三类试炼守卫生效；进场永久兵装是压制基数，远征与驻军共用。技能日志名「圣域守御」，符合后段西幻命名。

## 同源实付与战斗结果

P277第4阶587出战装备档 SHA-256 `fd820a1ee2b19dc8b8814c6f5c3c69596e4d56ee11fffadc1fe731a6bf1217be` 在旧规则11种子曾有3胜；补齐守卫防御下限后变为0/11。隔离因果对照显示关闭防御下限可恢复旧胜局，单独关闭三倍压制或攻击下限不能；因此这项源规则确实重新打开了成长门槛，不把旧P281战果冒充当前规则。

先从P277源档真实打两场战术演算机，核心17→97、军力617→606，来源无覆盖；重载的两胜档 SHA-256 `2dc5efaeeffc42911f9a96c5cbf7dc271a9994d00356b447dc2a9cb1bf9e4838`。再调用一次批量骨片兑换493份，实付33524兽骨、获67048勋章，逐秒生产319秒取得知识，支付350万知识与10万勋章研究纳米甲；投入80高能核心、20次锻造得首级并装备。为补两战损失的8合金兵和3蒸汽甲兵，真实生产铜/钢并训练，付粮12000、铜6000、铁6000、钢6800；生产、补训全段331模拟在线秒，最低食物389975.29。终档恢复617总军、587出战、101星际兵、第4阶，核心17；[纳米甲首级实付档](reports/data/p283-awakening-stage4-nano1-paid-save.json) SHA-256 `5c2fd26f7ef3763ba7add7856806030f52916018d1fb642c67c533cbec2b2610`，账本见[逐笔数据](reports/data/p283-awakening-stage4-nano1-paid.json)。这些秒数是指定存档/岗位的模拟在线秒，不是典型玩家时长。

从该实付档重载，11固定种子均先真实赢取异果，再支付95果打简单试炼第5阶：1/11胜；种子2终点升至第5阶，剩497出战和101星际兵，异果21，敌方HP归零。[可重载胜利终点](reports/data/p283-awakening-101star-stage5nano1-seed2-terminal-save.json) SHA-256 `e70cfc11570e3421e4a5d0ac3b0e6923f57a10e4f67143e7348f147dc0d08eea`。其余10种子战败不升阶，不能说首级纳米甲已使第5阶稳定可过。P279第5阶155星际兵档及P282实付一星档，当前守卫规则下第6阶各11种子仍0胜，前者敌余27858–43551 HP，后者27876–43465 HP。[44场逐种子汇总](reports/data/p283-awakening-guard-passives-summary.json)按档区分，不混合不同成本状态。

隔离敏感度在P277源档临时注入装备或兵装等级，**没有支付、研究、锻造或产能证明**：纳米甲首级1/11、10级4/11；能源甲10级2/11；电磁步枪及狙击枪10级3/11；最高组合7/11。它只用于筛选下一条可付款路线，不能宣称10级纳米甲可由当前核心供给稳定实付。详见[敏感度原始数据](reports/data/p283-awakening-stage5-growth-sensitivity.json)。

## 验证、兼容与回退

本地`master`，基线与最终HEAD同为`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；保留既有未提交改动及并行UI美化。参考快照`98571e38801f71bfdbb982a626e0e58f510abb98`的实际提交日为2026-05-17 +09，与AGENTS所述2026-09-18不符，未回退。根目录列举的运营背景文件不在根目录；`运营优化/`有同名文件，但本批不把其中设想当代码现状，也不声称完整审读其`01`。Windows PowerShell、Node v24.19.0。

先运行新增防御被动回归，在旧实现因函数缺失退出1；实施后`node tests/progression/awakening_guard_passives.js`退出0（5/5），覆盖临时压制、永久兵装基数、首次增攻一次、普通敌人不触发以及远征/驻军真实回合。`node tests/progression/awakening_combat_skills.js`7/7、`awakening_trial.js`8/8、`god_boss_attack_mass.js`3/3、`soldier_vitals.js`4/4、`garrison_settlement.js`6/6、`energy_nano_armor.js`6/6、`weapon_forge.js`5/5均退出0；`node tests/ie001/run.js`退出0（96/96）。真实Edge冒烟首次新断言因测试守卫原防御尚未受损而退出1；把浏览器测试条件设置为本场防御0后，`node tests/progression/nuclear_browser.js`退出0（17/17），实见「圣域守御」日志。

开发探针的实际命令和退出码：`node tools/verify/probe-awakening-core-farm-p277.js --input=p277-awakening-steam3-energy3-rifle2-sniper2-paid-save.json --label=stage4-two --output-prefix=p278 --count=2`退出0；`node tools/verify/probe-awakening-nano1-paid-p283.js`退出0；`node tools/verify/probe-awakening-guard-passives-p283.js`退出0（44场）；`node tools/verify/probe-awakening-stage5-growth-sensitivity-p283.js`退出0（隔离条件敏感度）。`node tools/verify/probe-awakening-101star-pressure-p276.js --input=p283-awakening-stage4-nano1-paid-save.json --label=stage5nano1-seed2 --output-prefix=p283 --seed=2 --max-steps=2 --expect-last=win --expect-level=5 --expect-enemy-hp=0 --save-terminal`退出0。九个本批修改/新增JS的`node --check`均退出0；`git diff --check`对本批已追踪代码/文档退出0。以上只是指定档案与随机流的验证，实体Android WebView未运行。

`rts_save`仍为v32，新增的`entryAtk/entryDef`和首次防御标记只在临时B战斗体，不序列化、不迁移、不碰玩家浏览器存档。第5阶只有窄胜率，第6–20阶、100关终局、母本逐兵目标分配、星际100星第三技、高级守卫和神炼/星阵净账仍未完成；本批不以固定11种子推断全局胜率。回退本批只撤销`config.js`的守卫被动配置、`math.js`/`garrison.js`的临时战斗体规则、P283测试/探针/报告及策划与进度新增段落；保留源档、主存档、前批成果和并行UI文件。
