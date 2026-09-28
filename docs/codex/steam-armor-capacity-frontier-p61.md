# P61 蒸汽甲满级、材料4000与核能容量边界（2026-09-24）

文档目标是继续实现《策划文档.md》的母本成长和难度骨干；代码现状为P60同一实付档的蒸汽甲1级、遗迹与守御警戒值均3700，知识容量5001920、勋章28284，核能需单笔知识1亿＋勋章80万。本次决定沿母本蒸汽甲现有3级上限继续逐次制造并实战，不调整敌人、奖励、人口、存档结构或玩家运行代码。前段保持「蒸汽甲／机巧遗迹」，后段仍用「守御之神／神战勋章」的西幻神祇名称，原创玩法延后。

## 同档付费与战斗

母本实体220061给蒸汽甲`LvMax=3`、初始防御10、每级再加10、每次钢2万，需先研究470064。我方已在P60接通并实付首级。本批开发探针从`%TEMP%\p60-both-3600-result.json`的v26档开始，通过102人口岗位生产钢，调用真实`forgeWeapon`再投入12＋14次，逐笔实扣钢52万。Lv2在第5572767**在线秒**达到，装甲兵防御32→42；Lv3在第5586991秒达到，防御→52。钢工有效产率24单位／秒，累计生产段21666在线秒、补粮段4788在线秒；不含真人操作或动画。神核仍2、勋章仍28284，未把枪械已研发误称为已制造。

从Lv3档以固定`Math.random=0.5`和原七团补员动作，在**同一**存档先胜机巧遗迹3700／3800／3900三场，再胜守御之神3700／3800／3900三场。每场都使用真实编队、训练付款、战损回写和奖励结算；两条材料警戒值均到4000。终点第5617622在线秒：晶核744→881（+137）、守御石1626→1902（+276）、勋章28284→39388（+11104），现存179兵。相比之下Lv1档独立复刷守御只在3700胜一场、3800战败余10HP；Lv3在从同一输入独立复刷的两条战线上各胜三场。以上输入到终点增57085模拟在线秒，约15.86小时，只是高投入档之后的局部路线。

从六胜终点各自独立补兵复刷下一场：遗迹4000败、Boss余425HP；守御4000败、余646HP；杀戮之神3500败、余99HP。败场无奖励，三次失败是各自独立重载的边界诊断，不串入六胜档，也不是所有随机种子或合法编队的上界。蒸汽甲增防推动了两种材料获取，但没有解决当前勋章主来源的3500墙。

## 知识容量：条件上界和真实付款分开

母本核能450023静态费是知识1亿＋勋章80万；两项核能前科研容量科技460095／460098每级+10%，5→6级后分别耗晶核和守御石。`tools/verify/probe-nuclear-capacity-p61.js`在不写档的隔离候选里，**忽略知识费、中途仓容和建造费**，仅按六胜档现有晶核881／守御石1902逐级扣材料：蒸汽科研6→14需晶核840，电力科研0→14需守御石1800。若这些未付研究全完成，当前图书馆306／研究院300的知识容量为18006912；再条件设两建筑都满1000级，调用真实`resCap('tech')`得44542080，仍距核能1亿差55457920。这是乐观上界，不是已获得进度；科研知识费还分别需要2520万／2.1亿，且高等级单笔费须先装得下。

另从同一六胜档真实执行已有`upgradeEraStorage`与在线学者产出：不加建筑先实付蒸汽科研6→14、电力科研0→5，共13笔研究，终点第5673719秒、知识容量11254320、晶核41、石1902。再逐级实付图书馆306→406共100次建造和电力科研第6级知识1200万＋石120，终点第5832659秒、容量12849408、石1782、勋章仍39388；下一笔电力科研第7级要知识1400万，当前仓差1150592。100次建造段另用158940模拟在线秒，其中建材生产与计时146745秒、学者攒知识12195秒。两段从六胜终点合计215037在线秒约59.73小时；不能把开发脚本的高度主动路线当真实玩家游玩时间。

母本另有产业容量属性320004和卷轴I阶180016（单次容量+1%、使用上限500），但当前游戏尚无经验证的产业获得和卷轴消费链。源表290084–290089要求交易所30级、六类郊野材料各200换1卷轴；礼盒140031、活动660014、广告850034也列为来源，但其可重复性、获得时点和我方映射未验。不能把这些倍率预支给核能入口。现有高投入路线仅在研究／建筑条件上界达到4454万，下一批应先核实郊野材料、交易所升级与卷轴可获得闭环，再决定是否实施该容量来源，并继续检查勋章净流入。

## 复现、验收和回退

开发探针实付命令均退出0，时间单位为在线秒：

```powershell
node tools/verify/probe-steam-armor-p61.js --save="$env:TEMP\p60-both-3600-result.json" --level2-save="$env:TEMP\p61-steam-armor2-paid.json" --snapshot-final="$env:TEMP\p61-steam-armor3-paid.json"
node tools/verify/probe-medal-stage45.js --save="$env:TEMP\p61-steam-armor3-paid.json" --domain=godCrystal --battles=3 --replenish --front-armor --aux-reserve --electric-reserve=40 --snapshot-final="$env:TEMP\p61-armor3-crystal3-paid.json"
node tools/verify/probe-medal-stage45.js --save="$env:TEMP\p61-armor3-crystal3-paid.json" --domain=guardianStone --battles=3 --replenish --front-armor --aux-reserve --electric-reserve=40 --snapshot-final="$env:TEMP\p61-armor3-both-4000-paid.json"
node tools/verify/probe-nuclear-capacity-p61.js --save="$env:TEMP\p61-armor3-both-4000-paid.json"
node tools/verify/probe-nuclear-capacity-p58.js --save="$env:TEMP\p61-armor3-both-4000-paid.json" --max-builds=0 --snapshot-final="$env:TEMP\p61-knowledge-no-build-paid.json"
node tools/verify/probe-nuclear-capacity-p58.js --save="$env:TEMP\p61-knowledge-no-build-paid.json" --max-builds=100 --snapshot-final="$env:TEMP\p61-knowledge-100build-paid.json"
```

脚本均重载v26主档核对装备／库存／研究，条件上界探针还断言原档文本未被写回。`node tests/progression/steam_armor_chain.js`7/7、`storage_branches.js`8/8、`steam_storage.js`5/5、`node tests/ie001/run.js`96/96退出0。P61仅增开发探针与文档，玩家运行代码、UI及存档结构无改动；本批未重跑真实浏览器或实体Android／WebView，不能借P60的浏览器结果当本批新验证。固定随机的一条策略不可外推胜率、50小时全流程或核能可达。

本地`master`基线／最终HEAD仍`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，全部既有未提交内容保留，未reset、提交、推送或部署。参考快照`98571e38801f71bfdbb982a626e0e58f510abb98`实际Git日期2026-05-17，与AGENTS记载2026-09-18不同。本次递归复查确认六份背景／审计文件实际在`运营优化/`目录；此前P58–P60报告称“缺失”是只查根目录的路径错误，它们基于旧HEAD的内容仍不能当当前代码事实。回退仅撤P61探针和文档增量，v26实付档可另存为开发证据；不清除玩家存档，也不让旧v25代码覆盖新装备状态。
