# P285 圣域第7阶实付补兵与成长边界

## 文档目标、代码现状、本次决定

《策划文档》把100关「帝国战线」作为全科技后的高难主线，把圣域试炼留在参照《放置时代》的发展副本。P284从已付款的第5阶档锻出纳米甲10级，并在11个固定随机流中找到1个第6阶胜例。本批沿那个**实际胜档**核实败后补兵、第7阶材料费与军力压力，寻找下一条有来源的成长轨；不改玩家公式、敌方属性、奖励、UI或美术。

输入为[P284第6阶胜档](reports/data/p284-awakening-101star-nano10-paid-seed8-terminal-terminal-save.json)，SHA-256 `0f449c31bc9d088b0aa18637848bb70a3aa988760f2f0e8328524db77de26bce`：517总兵、472出战、155名星际先遣兵、异果25、核心47、战术演算机警戒5000。目标编队取[P284第5阶纳米甲10级实付安全档](reports/data/p284-awakening-stage5-nano10-paid-save.json)的626人阵型，原档SHA-256 `509c448cc729602113d181ef2d05c529f7dbfb662b9147add89cd3e125d0be6d`。两份源档只读，探针均在独立VM运行。

## 实付补兵与第7阶压力

第6阶胜仗实际损电磁兵46、蒸汽装甲兵53、合金特种兵55，共154人；155名星际兵仍在。探针真实清编、调配1002人口岗位、逐秒生产前置石/煤及铜/铁/钢、训练并按原位重编。训练费实扣钢479500、铁474000、铜474000、粮82500，耗2719**模拟在线秒**，其中训练78秒；全段最低粮323708.49，未断粮。真实`save()`后独立重载维持671总兵、626出战、155星际兵、第6阶7星、异果25、核心47、警戒5000。[逐笔补兵账](reports/data/p285-awakening-stage6-full-roster-paid.json)和[可重载满编安全档](reports/data/p285-awakening-stage6-full-roster-paid-save.json) SHA-256 `63aaafe0f14a4395eeea05c6c74b0c232df3e9527f6a5216cbe73875d3e5fcae`可复核。这条指定岗位路线不是玩家平均耗时。

从补兵后的实付安全档，11个固定流各自独立开两场缄默神域异果战，22场均胜，再按真实动作预付115异果打第7阶简单试炼；**第7阶0/11胜**。各流第7阶敌方起始生命78561、战后余31449–52518，玩家当场626人全损、阶数停在6、异果23。[实付满编逐流压力](reports/data/p285-awakening-stage7-paid-refill-summary.json)保留各战回调和敌余生命。另从未补兵的第6阶胜档只取种子1实走同一两场取果与试炼，也败且敌余71267，见[未补兵对照](reports/data/p285-awakening-101star-stage7-no-replenish-seed1-pressure.json)。满编能明显多造成伤害，但不能把补兵当作第7阶通关方案；11个固定流也不能推断总体胜率。

当前另一项材料墙是高能核心。纳米甲10→11级要30次锻造、120核心，实付档仅47核心；警戒5000的战术演算机是当前已实现核心胜利来源。以本批**第6阶实付满编安全档**做11个单场种子，0/11胜，敌方3995起始生命仍余2102–3023，见[第6阶核心来源压力](reports/data/p285-awakening-core-alert-level6-paid.json)。先前[P284第5阶实付档对照](reports/data/p285-awakening-core-alert-cap-paid.json)同样0/11，敌余2449–3085；升阶两星略改善伤害，却没有闭合取核心。每个流是独立试战，不能证明所有编队绝对不能赢。纳米甲10→40级依当前配置另需15360核心；这不是当前可付目标。

[第7阶条件敏感度](reports/data/p285-awakening-stage7-growth-screen.json)从**实付满编安全档**开始，逐场仍调用真实取果和试炼；为了成对比较属性，第7阶开战前对每组重新置同一个固定随机种子，故它与上面的自然连续三战流是不同抽样。升级星数／装备等级只在隔离VM注入，**没有支付钢或核心**。三维兵装各1、10或40星仍0/11；单独纳米甲20级、能源甲10级或双电磁枪10级也均0/11，纳米甲40级为1/11。三维兵装各40星加纳米甲40级为2/11；各100星加纳米甲40级为8/11。仅三维各40星就需按当前配置投入钢4.8亿，且纳米甲10→40的核心来源尚未闭合。这些组合只说明多轨质量成长有作用，既不是最低通关门槛，也不是可支付方案。

**本次决定：**维持100关高难主线与圣域发展线的分工，暂不砍第7阶守卫基础数值，也不在UI写成可连续通关。下一批优先把母本170091兵种升阶材料（源名「将魂石」，来源字段580056）与450122→450222→450322研究门的战斗来源、实际掉落、属性公式、勋章和仓容接成可审查账本，再判断是否实施为我方后期「英魂铭石／英魂升阶」；这些玩家可见名称只是符合星核后西幻主题的候选，不直接照搬源名。若该轨无法在现档支付，再检查其它已证实的量子／神炼质量成长，不把条件注入当免费属性或擅自发核心。

## 验证、兼容与回退

本地`master`，基线与结束HEAD均为`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；保留既有未提交修改及并行UI美化。参考快照`98571e38801f71bfdbb982a626e0e58f510abb98`实际提交日2026-05-17 +09，与AGENTS所述2026-09-18不符，未回退。根目录列举的运营背景文件不在根目录，`运营优化/`同名文档不能充当已实现代码。环境为Windows PowerShell、Node v24.19.0。

实际执行`node tools/verify/probe-awakening-101star-pressure-p276.js --input=p284-awakening-101star-nano10-paid-seed8-terminal-terminal-save.json --label=stage7-no-replenish-seed1 --output-prefix=p285 --seed=1 --max-steps=10`、`node tools/verify/probe-awakening-core-alert-cap-p284.js --input=p284-awakening-stage5-nano10-paid-save.json --count=1`及`--input=p285-awakening-stage6-full-roster-paid-save.json --count=1`、`node tools/verify/probe-awakening-stage6-refill-paid-p285.js`、`node tools/verify/probe-awakening-stage7-paid-refill-p285.js`、`node tools/verify/probe-awakening-stage7-growth-screen-p285.js`均退出0；补兵探针固定VM随机流后重复执行同一档哈希均为`63aaafe0f14a4395eeea05c6c74b0c232df3e9527f6a5216cbe73875d3e5fcae`。`node --check`四个本批脚本均退出0；`node tests/progression/awakening_trial.js`8/8、`awakening_guard_passives.js`5/5、`energy_nano_armor.js`6/6、`weapon_forge.js`5/5及`node tests/ie001/run.js`96/96均退出0。`git diff --check`退出0，仅覆盖已跟踪的《策划文档》；P285开发脚本/台账和P284探针仍是未跟踪文件，另以语法检查及逐行空白检查复核。VM定时器/DOM模拟不等于浏览器或Android实机验证。本批无玩家运行时改动，故未新增浏览器UI验收。

`rts_save`仍为v32，P285 JSON仅是开发侧隔离存档/逐流报告，没有新增字段、迁移或玩家浏览器写入。已知风险是P284第6阶只有1/11窄胜、P285第7阶11流皆败，战损与警戒让连续挑战不可视作平顺成长。回退P285只移除本批开发探针、隔离数据和报告，并撤销策划/进度文档的P285新增段落；保留P284源档、用户存档、已有玩法和并行UI成果。
