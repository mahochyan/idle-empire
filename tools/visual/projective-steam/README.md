# 蒸汽时代中央主楼：原画投影实体样板

这是独立 Three.js 美术试验，**没有接入主页地图、Android 包、战斗或存档**。参考画面是现有[蒸汽时代原画](../../../assets/art/scene/town-sci_steam_age.png)；[中央清场候选图](../../../assets/art/scene/candidates/town-sci_steam_age-clean-candidate.png)只在镜头转动时局部遮去旧主楼。大厅前面采样原画，背面与侧面按本地 UV 取砖墙和蓝色屋顶区域；没有把整座楼竖成一张透明图片。可编辑几何源在 [model.js](model.js)。

## 手机尺寸对照

- [360×200：原画、默认、左转 8°、右转 8°](../../../hd2d-previews/qa-projective-steam-360x200.png)
- [320px 与 390px：同四视角](../../../hd2d-previews/qa-projective-steam-320-390.png)
- [去贴图结构：默认与左右转角](../../../hd2d-previews/qa-projective-steam-geometry-360x200.png)
- [WebGL 结构及像素指标](metrics.json)

钟塔为八边形实体墙、上下封盖、16 边闭合钟面和分片拱顶；大厅含深门廊、三段砖墙、六组斜屋坡、双侧短烟囱、铜管、柱脚和五级阶梯。Edge/WebGL 在 0°、−8°、＋8° 都实际加载并绘制：63 个闭合构件、784 三角面、7 个网格批次、8 次绘制调用，前后深度范围 4–116；屋面存在不同法线，换向光照会改变画面像素。

**画质结论：保留候选，不替换当前主城。** 默认 0° 的中央 `x379..651/y24..282` 区域对原画平均 RGB 差 1.87/255，周边 0.019/255。±8° 中央差升至 29.78/29.63；侧向的砖墙与蓝瓦显得比原画简单，屋顶铜边也偏硬。默认视角差异低，是正面投影忠于原画的结果，不代表整张地图已有九时代完整三维场景。周围学院、矿区等地标仍是原来的二维全景；工人、驻军状态、场景命中区和真机性能没有在这个独立样板中验收。

## 复现与边界

在仓库根目录运行：

```powershell
node --check tools/visual/projective-steam/model.js
node tools/visual/projective-steam/verify.js
node tools/visual/projective-steam/capture.js
node tools/visual/projective-steam/cleanup-profiles.js
```

2026-09-28 四条命令退出码均为 0；`verify.js` 的 9 项结构、性能预算和采样检查通过。截图来自本地静态 HTTP 服务与 Windows Edge SwiftShader，不是 Android 实机。用户当前无法提供实体安卓手机，因此十分钟温升、手指触控及稳定 30 FPS **未运行**。验证脚本的临时 Edge profile 放在工作区的 `hd2d-previews`，清理工具只删除名称为 `projective-steam-(edge|verify)-*` 且解析后位于其指定目录内的临时 profile。开发机 C: 当日显示 0 可用空间；本样板的验证改用 E: profile 后完成。

基线分支 `master`，SHA `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；工作区原有大量未提交改动保持原样。本次仅新增本样板目录和对应 QA 图片，没有触碰游戏数值、`S/B`、`rts_save`、`hd2d.js` 或 WebView。撤回本样板可移除 `tools/visual/projective-steam` 与上列三张 `qa-projective-steam-*.png`；运行中的游戏不需调整。
