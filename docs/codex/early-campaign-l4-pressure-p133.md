# 早期L4首战压力校准 P133

日期：2026-09-25  
策划文档：v2.62  
基线分支：`master`  
基线HEAD：`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`

## 目的与边界

P132当前农田成长下的18人口、3粮工准备路线在15条零补给固定分支里全败于L4。P117静态曲线也记录了L3到L4加权攻击从44升至180（4.09倍），因此本批只验证首个战斗接缝，不借调粮工或奖励掩盖敌压。用户要求的主题边界也适用于早期关卡名称：保持军镇/工业语汇，不提前引入神祇、位面等后期西幻词。

P133只调整L4敌军人数与该关名称/描述。未编辑或格式化`index.html`、`ui.js`、`visual.css`、`sprites.js`、图片、UI mockup或Android文件，保留共享工作区中其他人的美化改动。

## 方案与真实回放

把L4从15步兵＋15弓手（30人）调为14步兵＋10弓手（24人）：步兵梯队`[6,5,3]`、弓手梯队`[5,3,2]`。依真实初始化单位属性，L4总HP为24，加权攻击从180降为136；L3的11名步兵加权攻击为44，因此压力倍率仍为3.09。可见名改为“边境混编哨站”，描述为“步兵固守前线，弓手交叉压制”。编队仍有明显步弓组合压力，L4仍承担首个编队检查点。

先在系统临时目录复制当前战斗配置、harness和P102/P119真实路线，只在副本把L4改为24人运行；随后在当前工作区使用相同P119战役入口复跑。每组都是5个xorshift32种子 × 3条奖励/岗位支线 × 0/60/180/600模拟在线秒每胜补给窗，共60条路线。调用实际经济准备、训练、编队、战斗回调、军队损失、战后奖励和补兵函数；首次败战后停止。P119的固定流只是可复现压力样本，不是玩家胜率。

| 每胜补给窗 | 过L4 | 触达L7／L8／L9／L10 | 首次失败关卡分布 |
|---:|---:|---:|---|
| 0秒 | 3/15 | 0／0／0／0 | L4：12，L5：3 |
| 60秒 | 3/15 | 0／0／0／0 | L4：12，L5：2，L6：1 |
| 180秒 | 4/15 | 0／0／0／0 | L4：11，L5：1，L6：3 |
| 600秒 | 11/15 | 10／7／4／2 | L4：4，L6：1，L7：3，L8：3，L9：2；2条通关至L10 |

P132原配置在0秒窗为0/15通过L4，600秒窗触达L7–L10为7/5/1/0；P133候选把无等待的L4通过数提高到3/15，并提升长补给窗的后续关卡触达。候选仍不是保底：固定种子1的实际L4战斗两回合后失败，军队从13步兵、11弓手剩3步兵、0弓手。这说明它降低了墙的陡度，但不能代替补兵、资源与L5喘息设计。

## 决定与后续

保留24人作为当前L4配置：比20人候选保留更高压力，比原30人更接近渐进成长；实际完整对照数据见[P133原始回放](reports/data/p133-l4-current-worktree.json)。该决定只校准L4入口，不宣称L1–L10难度曲线完成。下一轮仍需核对L5恢复关的奖励/补兵承接、L6回升幅度、岗位切换成本，并在经济、均衡、军事和短会话路线共同检查后再定稿。

## 验证、存档与回退

- 隔离副本中从副本根目录运行`node tools/verify/probe-seeded-campaign-frontier-p119.js`：退出码0；只改L4人数，副本外其余工作区不写入。
- 当前工作区P119全矩阵回放退出码0；下列命令把探针默认输出重定向至P133 JSON，保留原`p119-seeded-campaign-frontier.json`历史数据：

  ```powershell
  $env:P119_OUTPUT = Join-Path (Get-Location) 'docs/codex/reports/data/p133-l4-current-worktree.json'
  node -e 'const fs=require("node:fs");const write=fs.writeFileSync.bind(fs);fs.writeFileSync=(file,...args)=>write(file.endsWith("p119-seeded-campaign-frontier.json")?process.env.P119_OUTPUT:file,...args);require("./tools/verify/probe-seeded-campaign-frontier-p119.js");'
  ```

- `node --check levels.js`：退出码0；`node tests/progression/campaign_enemy_units.js`：退出码0，100关敌阵初始化通过。
- `node tools/verify/probe-population-first-clear-replenish-p102.js --campaign-max-stage=4 --battle-seed=1 --wait-windows=0`（由证据收集脚本以同参数调用）：退出码0；种子1的L4实战快照及本批八个输入文件SHA-256保存在P133 JSON的`p133`字段中。
- `levels.js`编辑前SHA-256：`AA3B6BA4999E8E55F4225FE431AD561AE88B66F1FE501EC80AE309DF5FE9A146`；编辑后：`2DBA23BB6ADE5A06AAD00EED13FEEC9F23BA1CE06499ABD7EC46BFC0E7236FC3`。这两个文件快照均包含此前其他批次/共享工作区修改；本批只替换L4一行。基线HEAD与结束HEAD均为`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，未把HEAD描述成完整运行树快照。
- Node v24.19.0。未运行浏览器/Android；本批不涉及UI渲染。没有读写主档`rts_save`，没有新增字段或迁移。
- 代码只改`levels.js`的L4配置行；工作区其他既有变更保持原状。策划文档和实施台账各加一条P133记录。回退时恢复该关原始30人阵容和名称/描述，并移除本批报告、数据与文档条目；不要回退整个`levels.js`或共享工作区。
