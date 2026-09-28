# 基础时代主楼侧面贴图试验 · 2026-09-27

## 决定

**不接入游戏。** 我们在原有实体主楼样板上补了两张原创木质贴图，±8° 时侧墙与屋坡厚边不再只是纯色。360×200 主城画幅中改变很小，主楼的脊线、入口、院墙与原画相比仍有细节和轮廓损失，中央清场边缘也仍能看出拼接。质量没有越过原画基线。所有新增文件只在隔离样板或候选目录，`hd2d.js`、`index.html`、`visual.css`、`ui.js`、Android 与 `rts_save` 均未修改。

## 可视对照

- [原画／新 0°／新 −8°／新 ＋8°；每幅 360×200](../../../hd2d-previews/qa-projective-hall-textured-360x200.png)
- [原画与旧版／新版 ±8° 的中央局部放大](../../../hd2d-previews/qa-projective-hall-textured-local-diff.png)
- [去贴图结构；0°／−8°／＋8°](../../../hd2d-previews/qa-projective-hall-textured-geometry-360x200.png)
- [试验前完整画幅基线](../../../hd2d-previews/qa-projective-hall-360x200.png)

局部图只是将原本 360×200 图像的 130×100 中央裁切用最近邻放大三倍，便于逐像素检查；不能当作额外渲染分辨率。原画外区域的平均 RGB 差仍是 0.018/255。以整张原图为参考，中央 ROI `x350..675/y90..360` 的平均 RGB 差：

| 视角 | 试验前 | 新贴图 | 改善 |
| --- | ---: | ---: | ---: |
| 0° | 8.68 | 8.08 | 0.60 |
| −8° | 23.47 | 22.98 | 0.49 |
| ＋8° | 23.73 | 23.13 | 0.60 |

两张合成截图在中央 130×100 裁切中的新旧平均差为 0° 0.946、−8° 0.988、＋8° 0.984 RGB/255。色差数据用于量化改变幅度，不能单独证明艺术质量。主观视觉判定仍以手机尺寸对照为准：贴图确实遮住部分纯色侧面，但生成木瓦偏亮、纹理方向和原画屋坡不完全一致，斜视图仍不如原图完整。

## 美术源与映射

使用内置 ImageGen，以现有 `town-base.png` **只作风格参考**，生成可编辑母图；[完整提示词与源文件](../../../assets/art/source/models/projective_hall_texture_upgrade/PROMPTS.md)。第一张圆形渐隐屋顶草稿已舍弃；选中的无边框屋瓦与木墙母图均为 1254×1254。`pack-runtime.ps1` 仅做 512×512 双三次缩小，不作绘画修改；两张候选 PNG 为：

- `assets/art/scene/candidates/town-base-projective-roof-candidate.png`：689,399 字节。
- `assets/art/scene/candidates/town-base-projective-wall-candidate.png`：685,792 字节。

样板 `prototype.js` 将新贴图局部 UV 映射到屋坡背面、厚边及主楼木墙背面、侧面共 29 个面；面向镜头的正面仍投影原画。真实三维闭合网格、两个不同法线的屋坡、独立墙和围栏、七级楼梯不变。去贴图图检查体积，贴图图检查风格。方向光旋转使中央 RGB 平均变化约 0.38–0.41/255，证实材质仍有实时光照响应。

## 资源与验证

在本机 Edge 无头 SwiftShader WebGL：1,150 三角面、79 个闭合构件、5 个材质网格批次、6 次绘制调用。四张贴图的 PNG 文件总计 4,447,409 字节（原画和清场图共 3,072,218，新增两张 1,375,191）；按 RGBA 未压缩估计 GPU 纹理数据约 6.10 MiB，另有网格、帧缓冲和驱动开销。绘制调用和 SwiftShader 截图不是 Android 实机帧率证据。真机尚无法提供。

工作区基线为 `master` / `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`，保留已有未提交更改。实跑命令及退出码：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File assets/art/source/models/projective_hall_texture_upgrade/pack-runtime.ps1  # 0
node --check tools/visual/projective-hall/prototype.js                             # 0
node --check tools/visual/projective-hall/capture.js                               # 0
node --check tools/visual/projective-hall/verify.js                                # 0
node tools/visual/projective-hall/capture.js                                       # 0
node tools/visual/projective-hall/verify.js                                        # 0; 8/8 structural/pixel checks
powershell -NoProfile -ExecutionPolicy Bypass -File tools/visual/projective-hall/compare-texture.ps1 # 0
```

回退只需移除本轮的两个贴图候选、两个母图、缩图脚本、局部对比图与样板贴图映射变更。由于没有接入游戏，玩家存档不涉及迁移。下一轮若继续，应先精修主楼几何和遮挡轮廓，再逐时代建立同质量的可用场景；本轮不推断其他八时代已通过。
