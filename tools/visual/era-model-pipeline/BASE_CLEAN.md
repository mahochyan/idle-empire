# 基础时代主楼中央清场候选

**用途：**给真正有几何厚度的基础时代主楼提供无原楼重影的中央背景。新候选 `assets/art/scene/candidates/town-base-clean-roi-candidate.png` 与旧 `town-base-clean-candidate.png` 分开保存；旧全幅文件继续供已有 projective-hall 试验使用。运行地图仍是原 `assets/art/scene/town-base.png`，没有修改 `hd2d.js`、Android、战斗数值或 `rts_save`。

## 产物与来源

| 文件 | 用途 |
| --- | --- |
| `assets/art/scene/candidates/town-base-clean-roi-candidate.png` | 1024×525 RGBA 中央清场合成。 |
| `assets/art/scene/candidates/town-base-clean-center-mask.png` | 1024×525 灰度遮罩。 |
| `hd2d-previews/qa-town-base-clean-roi-360x200.png` | 原图／整张 ImageGen 清场／仅中央合成并置。 |
| `hd2d-previews/qa-town-base-clean-roi-phone-widths.png` | 320×180、360×200、390×210、430×220 原图和候选的原尺寸对照。 |
| `tools/visual/era-model-pipeline/package_base_clean.py` | 可复现的裁切、缩放、遮罩与数值检查脚本。 |
| `tools/visual/era-model-pipeline/base-clean-packaging.json` | 原图、母图、新图、遮罩与旧候选哈希，遮罩范围和差异指标。 |

输入是已有运行原图与此前 ImageGen 编辑的 `assets/art/source/generated/town-base-clean-candidate/town-base-clean-master.png`（1672×941）。脚本沿用 `(0,42,1672,899)` 裁切并缩放至 1024×525；按原画主楼屋脊、木栅、石基、台阶和蓝旗的核心多边形做 16px 扩展及 8px 羽化，仅合成中央。脚本不绘制新的美术像素，原图、母图和旧全幅候选均未覆盖。

实跑 `python tools/visual/era-model-pipeline/package_base_clean.py` 退出码 **0**。遮罩非零区域 `x329..696, y56..369`，占画幅 **17.45%**。在遮罩为零处，新图与运行原图 **RGBA 四通道逐像素完全相同**；若将 ImageGen 母图整幅裁缩后直接替换，同一区域 RGB 平均差为 **13.305/255**。中央不再留下原木屋、木栅、台阶或蓝旗轮廓。

已目视检查 320、360、390、430px 的手机宽度静态对照：路网通向中央空地，学院、军营、林场、矿区、农田、桥河保持原图像素；没有可见的重复主楼或硬矩形边。该检查只覆盖静态底图。合成三维主楼后仍须检查屋檐与树冠遮挡、模型底边与道路贴合及展开视图的视差；Android 实体手机、长时间帧率和触控未验证。回退只需不引用新 ROI，原图和存档不需要迁移。
