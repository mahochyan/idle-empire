# 金时代主楼：实体穹顶与原画投影的独立样板

此样板没有接入 `hd2d.js`、Android 或存档。它以现有金时代原画为固定镜头参考、以[金时代中央清场图](../../../assets/art/scene/candidates/town-sci_gold_age-clean-candidate.png)作局部背景，在 Three.js 内创建有深度的大厅、双翼、八片实体穹顶、柱廊、两座小塔、院环和阶梯。正面几何采样原画；侧面采样专用[金时代蓝金与石材贴图](../../../assets/art/source/models/projective_gold/gold-material-atlas-master.png)。`prototype.js` 是可编辑网格源，穹顶和大厅不是一张透明整楼板。

## 对照

- [360×200：原画／0°／−8°／＋8°](../../../hd2d-previews/qa-projective-gold-360x200.png)
- [320／390px 手机宽度对照](../../../hd2d-previews/qa-projective-gold-320-390.png)
- [去贴图几何视图](../../../hd2d-previews/qa-projective-gold-geometry-360x200.png)
- [结构与像素指标](metrics.json)

Edge/WebGL 实测：43 个闭合构件、556 三角面、5 网格批次、6 绘制调用；双翼屋坡法线点积 0.939，穹顶在默认镜头把方向光从左移到右时，局部 `x482..572/y32..110` 平均 RGB 改变 1.18/255。默认／−8°／＋8° 的中央 `x350..675/y90..360` 对原图平均差为 4.61／18.59／18.68（满量程 255）。默认中央外差 0.057，转角中央外约 0.37，仍有少量遮挡过渡影响。结构及测量 8/8 通过；这是技术检查，不表示美术准许上线。

**画质判断：候选保留，不替换默认地图。** 320–390px 的默认镜头仍能辨识金时代蓝金穹顶与入口，颜色保持明亮；±8° 的侧墙、塔和清场过渡比原画简化。画面外围依旧使用原二维全景，完整七地标三维、同屏工人/驻军与真机性能还没有通过门槛。原图保留得多也会使默认 RGB 差偏小，不能把数值当作已经完成的完整 3D 城镇。

从仓库根目录复现：

```powershell
node --check tools/visual/projective-gold/prototype.js
node tools/visual/projective-gold/verify.js
node tools/visual/projective-gold/capture.js
```

2026-09-28 上述命令退出码均为 0。使用本地静态 HTTP 与 Windows Edge SwiftShader，只代表浏览器样板；用户暂时不能提供实体 Android 手机，离线十分钟、温升、手指触控和稳定 30 FPS 未运行。样板不读写 `S`、`B`、`rts_save`，已有未提交改动保留。撤回本试验只需移除此样板目录、材质母图和对应三张 QA 图，游戏运行资源无需修改。
