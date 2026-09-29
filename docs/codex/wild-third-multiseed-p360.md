# P360：同档多随机流的第三次野域战斗

2026-09-29；`master`，`HEAD=f85e1c8624de8c9e17f7724373e65899d1085cdf`。已读 `AGENTS.md`、`CLAUDE.md`、`index.html`；业务脚本顺序仍为 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js`。仅新增独立探针、[逐流数据](reports/data/p360-wild-third-multiseed.json)与本文，没有改玩家代码、UI、策划总文档或实施台账。参考快照 `98571e38801f71bfdbb982a626e0e58f510abb98` 的 Git 日期实际为 2026-05-17 +09，与项目约定所写 2026-09-18 不同；没有回退。

从[P354 木5方案满员结算档](reports/data/p354-wood-5-coal-235-full-queue-4h-save.json)开始，每条流各建独立 Node VM，重载同一 `rts_save`，用真实编队动作组出 P329 的626人阵容，保存后给本次战斗设置独立固定种子，再调用 `openMaterialDomain('wyrmSinew')`、执行实际战斗回调、结算落盘及独立重载。档中战前全军672、出征626、蜥龙警戒3930，敌 HP206／攻击118。128个种子互不重复，取 `SHA-256("P360|<P354夹具SHA>|<0起始流号>")` 的前4字节作为无符号32位数，再交给每条 VM 的 xorshift32；所有流的战前编队存档 SHA 相同。P358 的种子 `3551856150` 单独作为回归流，不混入下表128条。

| 固定诊断流 | 条数 | 战损人数 | 敌方余 HP | 战后警戒与奖励 |
|---|---:|---:|---:|---|
| 胜 | 96 | 139–571，中位313 | 0 | 每条3930→3940，兽骨+668、兽皮+89 |
| 败 | 32 | 全部626 | 19–127，中位33 | 维持3930，兽骨／兽皮／勋章无奖励 |

胜流中77条另获蜥龙筋，每条+25；胜流勋章均+0。战损会相应减少存档中的总军数，128条结算档逐一重载后，军数、兽骨、兽皮、警戒都与战斗结算相符。另以 P358 原种子重跑，得到战败、626阵亡、敌余 HP28；其编队存档和战斗存档 SHA 均与 P358 报告逐字节一致。

这说明 P358 的一次败北不能断言这支晚期阵容必败，真实战斗对随机流敏感；同档也存在全军覆没的结果。胜利后警戒再升10，且胜场仍可损失数百兵，所以本批只说明 **3930警戒下同一阵容的一战分布**，不能把96/128解释成真实玩家胜率、长期通关率或稳定净收益。这里没有再跑离线补兵、连续警戒增长、不同布阵、手动策略、新档成长，也没有浏览器／Android战斗实测。Node VM 使用替身 DOM、存储和定时器，但调用了真实玩家战斗与结算函数。

锁定 SHA-256：`config.js` 为 `8e40ccc41ab96156db291ce74560981d875b304703fffb89c4139d5e23001675`，`math.js` 为 `dc0bcdee534853368cb3c576e6020e1c85ab7be00052241136605897e91b0c95`，P354夹具为 `8727dcc7934d728ca9c5f876c0b6fb8a3d0133bc31f34649564c6cdf258359cf`，P329阵容源档为 `9c0e33ebca8ebd4874fbbe5aa4c64d87972040e61a6abbed629e999b056a9ebd`；其余脚本和测试夹具的锁定值见逐流数据。本探针 SHA 为 `f48b26ff1fa7ddc3dc62cd9d786b1d9212e21c326cab44114856d67395ce62e7`，逐流数据 SHA 为 `f2bee37b130fdaa198807a14a517cc7031cbe9871d7d19df07e790c17ef1dc63`。Windows PowerShell、Node.js v24.19.0：`node --check tools/verify/probe-wild-third-multiseed-p360.js` 退出码0；`node tools/verify/probe-wild-third-multiseed-p360.js 16` 预跑退出码0；`node tools/verify/probe-wild-third-multiseed-p360.js 128` 正式运行退出码0。无新存档字段或迁移；回退仅删除本批新增3文件，保留既有工作区改动。未建分支、未提交、未推送。
