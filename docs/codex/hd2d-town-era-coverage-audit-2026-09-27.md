# 九时代城镇图覆盖核查（2026-09-27）

## 基线与范围

- 工作区：`master` / `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。开工时工作区已有大量未提交改动，本次没有重置、提交或推送，也没有修改游戏逻辑、存档或 Android 容器。
- `index.html` 保持 `config.js → levels.js → sprites.js → math.js → garrison.js → technology.js → ui.js` 的业务脚本顺序；额外 HD‑2D 渲染层在前面加载。
- 项目规则中的参考快照 `98571e38801f71bfdbb982a626e0e58f510abb98` 仅供审查，不是本次回退目标。四份背景方案和两份待提供审计文档不在当前工作区，本核查不把它们当作已实现证据。

## 覆盖结果

`CFG.sciences` 中八个时代科技与基础时代共九个场景 ID；`ui.js` 从已研究科技选择最新时代，`hd2d.js` 和二维回退加载对应的 `town-{id}.png`。`assets/art/manifest.json` 为每张 1024×525 运行图及 1672×941 母图建立独立条目。九张运行图和九张母图的 SHA‑256 均各不相同；[九图联系图](../../hd2d-previews/qa-nine-town-panorama-contact.png) 可直观看到中心主楼由木构、石构过渡到蒸汽与未来建筑。

| 时代 | 运行图 |
| --- | --- |
| 基础 | `assets/art/scene/town-base.png` |
| 青铜、铁器、白银、黄金 | `town-sci_bronze_age.png`、`town-sci_iron_age.png`、`town-sci_silver_age.png`、`town-sci_gold_age.png` |
| 合金、蒸汽、电力、星核 | `town-sci_alloy_age.png`、`town-sci_steam_age.png`、`town-sci_electric_age.png`、`town-sci_nuclear_age.png` |

本次在 `assets/art/source/check.mjs` 增加三项交付检查：每个非基础时代必须有同 ID 的科技配置；清单 ID 必须与九时代完全一致；运行图与母图各自不能与另一时代文件完全相同。这可拦住复制占位图，不能代替人工美术审查或发现仅像素极小差异的近重复图。

## 实际验证

- `node assets/art/source/check.mjs`：退出码 0，九时代及其他原有资源检查通过。
- `node tests/visual/assets.js`：退出码 0，九时代尺寸、文件和清单映射通过。
- `git diff --check -- assets/art/source/check.mjs`：退出码 0。
- 目视检查上述九图联系图：建筑轮廓与时代材质有变化，地标大致遵循同一布局。此项是美术目视证据，不等同于 Android 实机验证。

## 尚未完成

运行主城仍以原画全景和局部浮雕构成 **2.5D**。九时代各自的完整三维地形、建筑轮廓、统一实时光影尚未制作。基础时代三维主楼院落 GLB 只是[独立候选](hd2d-town-diorama-candidate-2026-09-27.md)，未接入运行地图，且既有对比表明细节没有达到全景品质。九时代场景不能据此宣称完成 HD‑2D 三维部分。

本次仅加强开发侧资源校验，无 `S/B`、`rts_save` 或数值变更。回退只需移除 `check.mjs` 新增的哈希/时代一致性检查与本报告；已有运行图片不受影响。Android 实体手机仍不可用，实机画面、帧率与触控没有因此获得验收。
