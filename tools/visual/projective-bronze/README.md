# 青铜时代主楼：原画投影到实体构件的独立样板

这是沿用当前青铜时代城镇原画制作的**隔离 3D 美术候选**，没有接入游戏运行时或 Android 包。`prototype.js` 是可编辑网格源，浏览器用本地 Three.js 生成闭合三维构件；原画与[中央清场候选](../../../assets/art/scene/candidates/town-sci_bronze_age-clean-candidate.png)只用于样板背景和正面投影。侧面屋瓦、石墙使用项目已有的原创青铜材质图；整栋主楼不是一张透明立绘板。

## 画面与结构

- [360×200 原画、正面和左右 8° 对照](../../../hd2d-previews/qa-projective-bronze-360x200.png)
- [320／390px 手机宽度对照](../../../hd2d-previews/qa-projective-bronze-320-390.png)
- [去贴图结构视图](../../../hd2d-previews/qa-projective-bronze-geometry-360x200.png)

样板包含双坡屋顶、实体屋檐和屋脊、前后有厚度的墙、柱廊、台阶、院环及青铜圆徽。旗是薄布装饰。浏览器 Edge/WebGL 结构检查：37 个闭合构件、480 三角面、5 网格批次、6 绘制调用，深度范围 7–97 样板单位；两屋坡法线点积约 0.676，方向光左右改变中央 RGB 均值约 0.45/255。原图之外的非中央区域像素差低于 0.03/255。镜头按默认／−8°／＋8°，中央 `x350..675/y90..360` 与原画的 RGB 通道平均差分别约 4.37／18.80／18.90（满量程 255）；差值不能代替画质判断。详见 [metrics.json](metrics.json)。

**美术判断：保留为候选。** 在 320、360、390px 默认视角，轮廓与原画接近，入口没有裁断。默认低色差很大程度来自仍保留的原画背景；旋转时会看到清场过渡与背景中的残留关系，去贴图视图也显示院墙和旁边地标尚未做成完整三维。它不能代表九时代完整主城，不宜替换默认地图。现有青铜 `.blend` 和 GLB 候选位于 `assets/art/source/models/era_town_bronze/` 与 `assets/art/models/candidates/`，与本投影样板是两条独立试验线，不能把两者的结构或验证结果合并计数。

## 复现与限制

在仓库根目录执行：

```powershell
node --check tools/visual/projective-bronze/prototype.js
node tools/visual/projective-bronze/verify.js
node tools/visual/projective-bronze/capture.js
```

2026-09-27 上述命令退出码均为 0；`verify.js` 8/8 结构及测量检查通过。浏览器是 Windows Edge 的 SwiftShader，不是 Android 手机 GPU。当前用户无法提供实体手机，所以实体机十分钟离线、温升、手指触控和稳定 30 FPS 均未运行。本候选不读写 `S`、`B` 或 `rts_save`，保留原有未提交改动；回退只需撤出本候选目录和对应的三张 QA 图，游戏地图无运行改动。
