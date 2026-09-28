# 合金时代中央主楼：立体美术候选

此目录是独立的 WebGL 美术样板。当前游戏、Android APK、`S/B` 与 `rts_save` 均没有引用它。中央全景来自 `assets/art/scene/town-sci_alloy_age.png`，背景空地使用已制备的 `assets/art/scene/candidates/town-sci_alloy_age-clean-candidate.png`。完整原画没有改动。

## 可编辑资源

- `prototype.js`：合金时代专属几何母版。中央议事厅、双翼蓝瓦斜顶、两座角塔、分层铜绿穹顶与有厚度的金属星盘分别建模。正面按原画投影，侧面使用专用材质图；主体、柱、台阶、星盘的各段均为有背面和厚度的闭合体。
- `assets/art/source/models/projective_alloy/alloy-material-atlas-master.png`：ImageGen 生成的四象限材质母图，依次为浅色石墙、蓝釉瓦、铜绿金属、雕纹金色合金。它不是另一时代建筑的换色图。
- `index.html`、`geometry.html`、`comparison.html`、`comparison-phone.html`、`detail.html`：场景与对照页。使用仓库内 Three.js 和本地静态 HTTP 资源；`file://` 不用于贴图验收。

素材生成使用内置 `image_gen.imagegen`。提示词：

> Use case: stylized-concept. Asset type: original material texture atlas for a bright painted-pixel hybrid HD-2D mobile town hall, Alloy Age. Generate a square image with a precise 2 by 2 grid of FOUR flat, front-facing, tileable material swatches. Top-left: crisp pale limestone masonry with fine blocks and occasional warm mortar. Top-right: cobalt blue glazed slate roof tiles with warm brass narrow seams. Bottom-left: weathered pale green verdigris copper dome cladding with subtle curved metal scales. Bottom-right: brushed warm gold alloy structural metal with riveted plates and small engraved celestial motifs. Each quadrant fills exactly one quarter; straight quadrant boundaries, no gaps or perspective. Rich midday color and hand-painted/pixel-detail texture matching a detailed fantasy strategy-game town illustration. Keep the pattern scale legible when downsampled to phone map size. No building, scene, characters, skyline, text, labels, shadows, gradient, frame or watermark.

## 实际验证

从仓库根目录运行：

```powershell
node tools/visual/projective-alloy/capture.js
node tools/visual/projective-alloy/verify.js
```

最终两个命令退出码均为 **0**。它们启动本地静态服务并调用真实 Edge WebGL。首轮 `verify.js` 因 C: 临时目录空间不足退出码 **1**；随后将浏览器配置移到 E: 下本目录的临时文件夹，最终运行通过并自动清理新配置。首次截图遗留的三个本任务 C: 临时配置目录未能清理：`Remove-Item -Recurse` 被自动策略拒绝；其他临时目录未触碰。结构报告保存在 `metrics.json`。截图：

- `hd2d-previews/qa-projective-alloy-320-390.png`：320、390 CSS px 原画／0°／−8°／＋8° 对照。
- `hd2d-previews/qa-projective-alloy-360x200.png`：360×200 对照。
- `hd2d-previews/qa-projective-alloy-geometry-360x200.png`：三维结构的 clay 材质视图。
- `hd2d-previews/qa-projective-alloy-detail-1to1.png`：中央 1:1 细节对照。

结构检查：**73** 个闭合体、**888** 个三角面、**5** 个几何批次、**6** 次绘制；深度范围 **8–119**，两处主屋顶法线点积 **0.881**。左右移动光源会改变中央和穹顶像素。背景观察区以外的平均像素差小于 **0.08/255**。中央参考区与原画每通道平均差约 **6.98/255**（0°）和 **39.50–39.67/255**（±8°）。这些数值衡量结构与像素变化，不是美术评分。

## 美术门槛

**暂未通过。** 0° 的总体轮廓和原画接近，但星盘附近有轻微重影。±8° 的屋顶侧面、楼体接缝和星盘后方留白显得杂乱；1:1 细节图中尤为明显。Atlas 的石材侧面与原图手绘纹理仍有质感差别。应继续修复侧面 UV、星盘遮挡和屋檐轮廓，再在 320、360、390、430px 复看后决定是否接入。当前不导出 GLB、不替换运行中主城，也不打包 APK。尚未做 Android 实机验收；用户目前无法提供手机。

回退只需不引用此候选目录及专用 Atlas。游戏当前仍显示原合金时代地图。
