# 核能时代主楼：独立三维样板

本目录是美术候选，没有接入 `hd2d.js`、Android 包或游戏存档。固定机位使用现有核能时代全景作参照，中央清场图局部消除旧主楼。`prototype.js` 建立白石大厅、双翼蓝顶、中央能量塔、有孔的十二段实体光环、两座侧塔、院环和台阶；正面投影采样原画，侧面使用本项目的[专用贴图母图](../../../assets/art/source/models/projective_nuclear/nuclear-material-atlas-master.png)。外围仍是二维全景。

## 320–390px 实际对照

- [手机宽度：原画／默认镜头／−8°／＋8°](../../../hd2d-previews/qa-projective-nuclear-320-390.png)
- [360×200 地图对照](../../../hd2d-previews/qa-projective-nuclear-360x200.png)
- [无贴图结构检查](../../../hd2d-previews/qa-projective-nuclear-geometry-360x200.png)
- [Edge 结构与像素指标](metrics.json)

真实 Edge WebGL 渲染得到 51 个闭合构件、620 三角面、5 个批次、6 次绘制；主屋坡法线点积 0.861。默认镜头中央 ROI 相对原图平均差 5.12/255，±8° 时 20.41/20.50。默认 ROI 外差 0.081/255。小差值部分来自仍保留二维全景，不能表示整座城镇已经三维化。

`node --check prototype.js`、`node capture.js` 退出码 0；`node verify.js` **退出码 1，8 项中 7 项通过**。默认镜头光环在光源左右移动时局部平均 RGB 只变化 0.017/255，低于 0.15 检查值；±8° 可测得 0.392/0.406，但默认视角的动态光效尚不明显。`metrics.json` 保留失败项，没有把阈值改低换取通过。

**美术验收未通过。** 默认镜头虽保持原图的明亮蓝白色调，光环与塔顶在 320px 太细，转角处屋檐、塔身与原画背景有接缝和重影。现阶段没有导出完整七地标 GLB，也没有角色、工人和驻军在同一场景里的遮挡。样板不应替换运行地图。

本机可复核（从仓库根目录，静态 HTTP 由脚本启动）：

```powershell
node --check tools/visual/projective-nuclear/prototype.js
node tools/visual/projective-nuclear/verify.js
node tools/visual/projective-nuclear/capture.js
```

捕获脚本使用 E: 本目录的私有 Edge profile，并在退出后核对路径再清理。本次没有真机，用户暂时不能提供实体 Android 手机；触控、温升和十分钟离线帧率未运行。此目录及贴图可直接撤下；`S/B`、战斗数值与 `rts_save` 未变。
