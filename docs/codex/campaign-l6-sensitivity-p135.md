# L6第二检查点难度敏感性 P135

日期：2026-09-25  
策划文档版本：v2.63  
分支/HEAD：`master` / `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`

## 目的与范围

P134显示L5在有补给时能发挥喘息作用，而P133后的L6仍有40名步兵/弓手、总HP40、加权攻击240。L4已经为24名、加权攻击136，L7为42名、加权攻击252。本批只调整L6，试验把下一检查点定为30人、加权攻击180；名称改为“军镇巡防队”，描述“步兵列阵掩护弓手，构筑第二道防线”，维持工业军镇语境。

候选仍有明确压力：加权攻击从L4的136升至L6的180（1.32倍），再到L7的252（1.40倍）。L5的6人/36攻击是刻意恢复段，不把低压恢复关误当作与相邻关逐级线性递增。

## 单变量对照

从同一当前工作区分别构造L6=40基线与L6=30候选隔离副本；校验`levels.js`只有L6配置行不同，其他配置、战斗模块、harness与P102/P119探针的复制SHA-256一致。两边各以5个xorshift32种子、3条相同奖励/岗位分支、0/60/180/600秒每胜补给窗，经真实P119/P102路线完整回放；每窗最多15条。早期关卡的可达分支在L6发生前保持相同。

| 每胜等待 | L6尝试（两边相同） | 原40人胜场 | 候选30人胜场 | 候选触达L7／L8／L9／L10 |
|---:|---:|---:|---:|---:|
| 0秒 | 0 | — | — | 0／0／0／0 |
| 60秒 | 1 | 0/1 | 1/1 | 1／0／0／0 |
| 180秒 | 3 | 0/3 | 3/3 | 3／2／0／0 |
| 600秒 | 11 | 10/11 | 11/11 | 11／5／2／1 |

180秒窗口的三条路线在同一个早期路径下都能打到L6：原40人配置全败，30人候选全胜。600秒窗口候选L6战前均兵数与基线相同约39.3；战后候选存活均兵数约27.9，基线约21.5。候选降低这次战斗的消耗，但并未消除后续战损压力。改动战斗轮数会消耗不同随机数，故L7以后不同种子的固定流已分叉；表中的后段触达仅描述各场景，不能把差异全归因于L6或解释为玩家胜率。

## 决定

将L6当前工作区配置调整为步兵`[7,5,3]`、弓手`[7,5,3]`，共30名。保留其第二检查点职责，同时让P134的180秒/胜可达分支全部过关，改善L4–L6承接。零等待仍没有路线打到L6：3条通过L4的分支全部首败L5；因此L4/L5无补给连续战斗仍是已知限制，不能宣称早期曲线已经完成。四策略、短会话、战损恢复、L7–L10与后续时代仍需同档验证。

完整双场景逐分支结果、真实L6敌阵/余兵及输入SHA-256见[P135敏感性JSON](reports/data/p135-campaign-l6-30-sensitivity.json)；当前工作区最终组合的全P119矩阵见[P135当前路线回放](reports/data/p135-current-worktree-campaign.json)。

## 验证、存档与回退

- `node --check levels.js`、`node --check tools/verify/probe-campaign-l6-30-sensitivity-p135.js`：均退出码0。
- `node tools/verify/probe-campaign-l6-30-sensitivity-p135.js`：退出码0；基线/候选各跑完整P119路线，并用P102逐种子采集真实L6战斗。
- 当前工作区完整P119最终组合回放退出码0；下列PowerShell命令将探针数据写入独立JSON，保留历史P119数据：

  ```powershell
  $env:P119_OUTPUT = Join-Path (Get-Location) 'docs/codex/reports/data/p135-current-worktree-campaign.json'
  node -e 'const fs=require("node:fs");const write=fs.writeFileSync.bind(fs);fs.writeFileSync=(file,...args)=>write(file.endsWith("p119-seeded-campaign-frontier.json")?process.env.P119_OUTPUT:file,...args);require("./tools/verify/probe-seeded-campaign-frontier-p119.js");'
  ```

- `node tests/progression/campaign_enemy_units.js`：退出码0，100关敌阵均可初始化。
- Node v24.19.0。测试只使用隔离状态，无主档`rts_save`读写、无新字段/迁移；未运行浏览器或Android。未改UI、美术、Android或战斗实现。
- 本次`levels.js`的P135目标行编辑前SHA-256为`2DBA23BB6ADE5A06AAD00EED13FEEC9F23BA1CE06499ABD7EC46BFC0E7236FC3`，编辑后为`A8CDEBB9BCC612579866E0488903C16A635C5489D1430AC4A909AB8EA6DE1983`；两个快照均包含本批前其他工作区改动，本批仅替换L6行。HEAD前后不变。回退只恢复该行原始L6队伍/名称/描述并移除P134/P135工具、数据和策划记录，不要整文件回滚。
