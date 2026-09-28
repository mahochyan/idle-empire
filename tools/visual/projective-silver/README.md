# 白银时代主城：原画投影到立体石宫的独立候选

本目录只做美术样板。游戏页面、主城运行时、Android 包、`S/B` 和
`rts_save` 都没有引用这些文件。源图是当前的
`assets/art/scene/town-sci_silver_age.png`；仅中央石宫附近借用已有的
`assets/art/scene/candidates/town-sci_silver_age-clean-candidate.png` 清场图。
不要将这张场景与基础、青铜时代的木质长屋模型视作同一建筑的换色。

## 查看

- [原画／实体 0°／−8°／＋8°，每幅 360×200](../../../hd2d-previews/qa-projective-silver-360x200.png)
- [去贴图结构，0°／−8°／＋8°](../../../hd2d-previews/qa-projective-silver-geometry-360x200.png)
- [320／390px 手机宽度的原画与三个实体角度](../../../hd2d-previews/qa-projective-silver-320-390.png)

`index.html` 是交互预览，`?yaw=-8..8` 改变水平视角，`?mode=clay`
检查几何，`?mode=original` 显示原画。鼠标横向移动会改变方向光。
需通过本地 HTTP 静态服务打开，以便 WebGL 读取同源贴图。

可编辑源是 `prototype.js` 内的网格坐标和闭合构件函数；它在浏览器中
生成模型，目前没有经过独立 GLB 导出。建筑包含左右两翼、中央石质立面、
三座尖塔、互异法线的蓝色屋坡、突出柱、石台和五级阶梯。
旗帜可用二维布面，主体建筑由正面、背面和侧面组成的封闭实体构成。

## 本机验证

在 Edge 无头 WebGL SwiftShader 上运行 `verify.js`，结构、默认像素对齐、
中央外保持、灯光响应均通过。这里的 RGB 差是相对未转动原画的每通道
平均绝对差，满量程为 255；中央 ROI 是原图 x375–650、y63–275。

| 角度 | 三角面 | 封闭构件 | 主屋坡/尖塔面 | 网格批次/绘制调用 | 中央 RGB 差 | 中央外 RGB 差 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| −8° | 626 | 55 | 18 | 1 / 2 | 32.71 | 0.018 |
| 0° | 626 | 55 | 18 | 1 / 2 | 1.84 | 0.018 |
| ＋8° | 626 | 55 | 18 | 1 / 2 | 32.26 | 0.018 |

实体深度为样板坐标 z16–150。采样区域内左右切换光源，默认镜头 RGB
平均变化 0.12/255；贴图化视图的建筑光照刻意保守，以保持原画亮度。
去贴图视图能直接检查尖塔、斜屋坡和转动视差。清场混合通过中央椭圆
遮罩限制；早期整张场景混合版本曾使非中央区域差达到 11.24/255，
此问题已修复，保留在本说明中作为迭代证据。

## 画质关卡

**只作为候选，不接入运行时。** 默认镜头在手机尺寸保留了原画的主要
白石宫殿轮廓和颜色；本机 320px、390px 对照已生成。转动到 ±8° 时，
中央与静态原画的差超过 32/255，其中一部分来自真实位移，仍可见小块
外墙取样错位。侧面和背面尚未单独绘制：目前各闭合面都使用同一张原画的
投影材质，因此只适合有限转角。场景地面、其他地标还是原画平面；
本样板也没有动态落地阴影、GLB 资产和 Android 真机帧率证据。
这些都是主城正式三维替换的剩余条件，不能据此宣称九时代完成。

## 复现与回退

在仓库根目录执行：

```powershell
node --check tools/visual/projective-silver/prototype.js
node --check tools/visual/projective-silver/capture.js
node --check tools/visual/projective-silver/verify.js
node tools/visual/projective-silver/verify.js
node tools/visual/projective-silver/capture.js
```

上述命令最终均退出 0。并发开启两个 Edge 无头检查时曾有一次 Edge
自身 exit 1；顺序重跑验证为 0，未更改检测标准。基线是 `master` / 
`406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`；已有脏工作区全部保留。
回退只需要移除本候选目录及其三个 `qa-projective-silver-*.png` 预览，
无需迁移存档。Android 实机尚未验证，用户目前无法提供设备。
