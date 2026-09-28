# HD‑2D 主城实体化与战斗血条复核（2026-09-28）

## 基线和本次决定

- 工作区为 `master`，开工与本次结束的 HEAD 均是 `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；开工时已有约 606 个未提交路径，全部保留。参考快照 `98571e38801f71bfdbb982a626e0e58f510abb98` 未用于回退。
- `index.html` 的业务顺序仍为 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js`。本次没有改游戏数值、战斗结算、`S/B`、`rts_save`、WebView 或运行中的地图资产。
- 当前 `hd2d.js` 在原画载入后隐藏实体模型，实际主页仍是九张原画加少量 2.5D 浮雕。现有全景的色彩和七地标密度高于候选实体。候选画质未过，所以保持运行中的原画。

## 战斗血条：按用户反馈复核

现有实现把 HUD 与编队血条设为深红 `#81000f`、细 3 CSS px；战场人数徽标的画布线段也用同一深红，随贴图缩放显示。编队线段按角色当前帧可见头顶计算位置，目标在头顶附近约 2.5–3.5 px。浏览器实拍：[390px 稀疏编队](../../hd2d-previews/qa-battle-hpline-current-390.png)、[320px 满编 12v12](../../hd2d-previews/qa-battle-hpline-full-320.png)。`node tests/visual/browser_smoke.js` 在真实 Edge、320/360/390/430 CSS px 检查通过 210/210，包含稀疏、6v6、12v12、双方 24/24 槽位和无遮挡溢出；[完整结果](../../hd2d-previews/qa-battle-hpline-audit-20260927.json)。这些是桌面浏览器模拟手机视口，不是实体手机。

## 九时代中央主楼候选

九张 1024×525 原画和九张中央清场候选已建好，清场遮罩之外与原画逐像素一致。[手机尺寸九时代审查页](../../tools/visual/era-model-pipeline/review.html)与[流水线说明](../../tools/visual/era-model-pipeline/README.md)在本地可打开。独立的项目化主楼样板如下；源文件、材质和截图均只在候选区：

| 时代 | 可编辑主楼样板 | 实拍证据 | 人工画质结论 |
| --- | --- | --- | --- |
| 基础 | [木构大厅](../../tools/visual/projective-hall/REFINEMENT.md) | [320/390px](../../hd2d-previews/qa-projective-hall-edge-320-390.png) | 正面改进，侧墙仍有接缝 |
| 青铜 | [柱廊主楼](../../tools/visual/projective-bronze/README.md) | [320/390px](../../hd2d-previews/qa-projective-bronze-320-390.png) | 侧面和背景过渡未过 |
| 铁器 | [石墙钟楼](../../tools/visual/projective-iron/README.md) | [320/360/390px](../../hd2d-previews/qa-projective-iron-320-360-390.png) | 屋顶侧面简化 |
| 白银 | [石宫](../../tools/visual/projective-silver/README.md) | [320/390px](../../hd2d-previews/qa-projective-silver-320-390.png) | 侧墙投影错位 |
| 黄金 | [蓝金穹顶](../../tools/visual/projective-gold/README.md) | [320/390px](../../hd2d-previews/qa-projective-gold-320-390.png) | 转角塔楼与遮挡未过 |
| 合金 | [星盘大厅](../../tools/visual/projective-alloy/README.md) | [320/390px](../../hd2d-previews/qa-projective-alloy-320-390.png) | 星盘重影，侧面杂乱 |
| 蒸汽 | [钟塔与烟囱](../../tools/visual/projective-steam/README.md) | [320/390px](../../hd2d-previews/qa-projective-steam-320-390.png) | 侧面砖瓦过简 |
| 电气 | [钟塔与线圈](../../tools/visual/projective-electric/README.md) | [320/360/390px](../../hd2d-previews/qa-projective-electric-320-360-390.png) | 侧翼偏扁，线圈过小 |
| 核能 | [能量塔与光环](../../tools/visual/projective-nuclear/README.md) | [320/390px](../../hd2d-previews/qa-projective-nuclear-320-390.png) | 光环过细，默认视角光照响应不足 |

上述九处是**中央局部实体样板**；外围仍是二维全景。默认机位的低 RGB 差包含保留原画的贡献，不代表完成九套 3D 城镇。`audit.py` 当前数值：原画 9/9、中央清场 9/9、GLB 候选 2/9、七个命名拾取节点 0/9、完整场景运行就绪 0/9。两份现有 GLB 候选也缺七地标和一致机位，基础时代样板 33,474 三角面／6.78 MiB 超过暂定移动预算。真正替换还需要九套七地标、地面/桥/树遮挡、建筑状态与工人驻军映射，之后再接运行时并测低端降级及 WebGL 回退。

## 实际命令和结果

| 命令 | 退出码 | 结果与边界 |
| --- | ---: | --- |
| `python tools/visual/era-model-pipeline/audit.py` | 0 | 上述 9/9、2/9、0/9 清单 |
| `node tools/visual/check-glb-runtime.mjs` | 0 | 原有与候选 13/13 GLB 格式能被静态解析子集接受；超预算另有警告 |
| `node tools/visual/verify-glb-runtime.cjs` | 0 | 5/5 候选由真实 Edge 通过 `hd2d.js` 解析；只证明能加载，不证明屏幕可见或画质通过 |
| `node tools/visual/projective-bronze/verify.js` | 0 | 8/8 结构、贴图与采样检查通过 |
| `node tools/visual/projective-gold/verify.js` | 0 | 8/8 同类检查通过 |
| `node tools/visual/projective-gold/capture.js` | 0 | 320/390px 与几何截图生成 |
| `node --check tools/visual/projective-nuclear/prototype.js`、`node tools/visual/projective-nuclear/capture.js` | 0、0 | 核能几何语法及手机截图通过 |
| `node tools/visual/projective-nuclear/verify.js` | 1 | 8 项中 7 项通过；默认机位光环左右移光时平均差只有 0.017/255，低于 0.15 阈值，失败项保留在 `metrics.json` |
| `node --check` 青铜/黄金 capture、verify 与 GLB runtime 检查脚本 | 均 0 | 改用 E: 私有 Edge profile 后语法通过 |
| `node tests/visual/browser_smoke.js` | 0 | 210/210 桌面 Edge 手机视口冒烟；不代替实机 |

## 存档、设备和回退

本次候选只读当前图片，未给存档新增字段。撤回候选只需不引用 `tools/visual/projective-*`、相关源材质及 `qa-projective-*`；运行中的游戏无迁移步骤。战斗血条只是已存在的绘制和样式，战损、奖励及 `rts_save` 规则不变。

用户暂时不能提供实体 Android 手机，因此离线十分钟、手指触控、温升与稳定 30 FPS **未运行**。当前开发机 C: 可用空间为 0；旧 C: Edge 临时目录的递归清理被自动审批返回 `blocked by policy`，所以未执行。后续新浏览器检查已转用 E: 私有临时目录，未触碰其他进程或目录。
