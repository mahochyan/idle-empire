# 基础时代主楼收边候选 · 2026-09-27

## 结果

这是既有原画投影实体样板的 **隔离候选**，浏览器地址加 `?refine=1` 才启用；加 `&edgeMask=1` 可查看局部遮挡修正版。原有 `?yaw=0/±8` 样板保持可复现，运行中的 `hd2d.js`、玩家可见原画、Android 包与 `rts_save` 没有改变。

- [原画／旧版／新版 0°、±8° 的 360×200 手机地图尺寸对照](../../../hd2d-previews/qa-projective-hall-refined-360x200.png)
- [中央 130×100 裁切的最近邻三倍检查图](../../../hd2d-previews/qa-projective-hall-refined-central-crop.png)
- [去贴图几何体积检查图](../../../hd2d-previews/qa-projective-hall-refined-geometry-360x200.png)
- [局部遮挡修正版的 360×200 对照](../../../hd2d-previews/qa-projective-hall-edge-360x200.png)与[中央裁切](../../../hd2d-previews/qa-projective-hall-edge-central-crop.png)
- [320 与 390 CSS px、200px 高的原画／0°／±8° 同尺寸画面](../../../hd2d-previews/qa-projective-hall-edge-320-390.png)
- [原画中央细节参考裁切](../../../hd2d-previews/qa-hall-reference-detail.png)

新变体在两个斜屋坡边缘增加四段有厚度的木檐、屋脊梁，在入口阶梯增加两段有厚度的石边。都是闭合网格，默认机位的正面仍取自原画，转动后可看到侧面和背面。清场背景的混合强度随样板视角增大：0° 为 4%，±8° 为 70%，以减少原画周边被清场草地盖住的接缝。

第二次试验把转角的清场力度集中到屋顶和院墙内圈，外圈减弱混合以保留原画的石块与草地。0° 与上一版完全相同；±8° 外圈接缝在裁切对照中变轻。它仍属于原画背景与实体前景的混合，不能算独立完成的三维城镇。

## 实测

在本机 Edge 无头 WebGL／SwiftShader，使用既有 `verify.js` 调用真实 Three.js 样板。中央 ROI 为原图 `x350..675/y90..360`；RGB 差为与原画每通道平均绝对值，255 为满量程。它只能量化像素偏差，不能证明艺术质量。

| 镜头 | 旧版中央 RGB 差 | 收边版中央差 | 局部遮挡版中央差 | 新版闭合件／三角面／绘制调用 |
| --- | ---: | ---: | ---: | ---: |
| 0° | 8.08 | 4.53 | 4.53 | 86／1,234／6 |
| −8° | 22.98 | 21.95 | 21.23 | 86／1,234／6 |
| ＋8° | 23.13 | 22.19 | 21.44 | 86／1,234／6 |

旧版为 79 个闭合件、1,150 三角面、6 次绘制调用。新版去贴图视图可看到增加的屋檐与入口体积，屋坡法线点积仍约 0.609，深度范围为 7..96 个样板单位。移光后中央差值约 0.28–0.31 RGB/255，说明依然响应实时光照。原画中央 ROI 外的平均差约 0.018 RGB/255。

**正面差值下降主要来自保留了更多原画背景，并非新几何能逐像素重现原画。** 背景中仍含有原画大厅，低角度投影构件覆在其前方；因此不能凭 4.53 宣称已经建好完整三维城镇。±8° 处也保留少量原画，可能出现重影。收边体积本身在清场强度保持旧值的首次试跑中，侧视 RGB 差约 23.09／23.30，未改善旧版 22.98／23.13；现有侧视差值下降来自较弱的清场混合。放大的中央图仍能看到局部屋檐、石墙和遮挡衔接比原画生硬。

320 与 390 CSS px 的静态浏览器截图表明中央大厅、入口阶梯和左右地标在两种宽度都未被裁断；这并非触控、帧率或 Android 真机验收。当前判断是 **可作单独开关的基础时代美术预览，暂不适合替换默认主城**：投影背景仍有二维大厅，屋檐与石墙斜视融合尚不够严谨，其他八时代与真实设备性能也未验证。

## 复现与限制

从仓库根目录实跑，以下命令退出码均为 0：

```powershell
node --check tools/visual/projective-hall/prototype.js
node --check tools/visual/projective-hall/capture.js
node --check tools/visual/projective-hall/verify.js
node tools/visual/projective-hall/verify.js
node tools/visual/projective-hall/verify.js --refine
node tools/visual/projective-hall/verify.js --edge
node tools/visual/projective-hall/capture.js --refine
node tools/visual/projective-hall/capture.js --edge
node tools/visual/projective-hall/capture.js --phone
powershell -NoProfile -ExecutionPolicy Bypass -File tools/visual/projective-hall/compare-refined.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File tools/visual/projective-hall/compare-refined.ps1 -Edge
```

基线 `master`／`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；原工作区已有约 606 条脏状态，全部保留。此候选不改变游戏状态、战斗、数值或存档，无需迁移。撤销本次样板代码和 HTML、移除本次 refined／edge 预览即可回退。尚未进行 Android 真机验收，也未完成其他八时代或全地图三维替换。
