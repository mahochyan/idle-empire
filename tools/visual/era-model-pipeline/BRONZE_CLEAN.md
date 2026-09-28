# 青铜主楼中央清场候选

**用途：**为青铜主楼真实几何试装提供无原楼重影的中央背景。这是独立候选，运行地图仍加载原 `assets/art/scene/town-sci_bronze_age.png`。没有改动 `hd2d.js`、Android、战斗或 `rts_save`。

## 产物

| 文件 | 用途 |
| --- | --- |
| `assets/art/scene/candidates/town-sci_bronze_age-clean-candidate.png` | 1024×525 中央清场 RGBA 合成，非整张生成图。 |
| `assets/art/scene/candidates/town-sci_bronze_age-clean-center-mask.png` | 1024×525 灰度遮罩；动态合成也可重用。 |
| `hd2d-previews/qa-town-sci_bronze_age-clean-360x200.png` | 原图／ImageGen 全幅编辑／仅中央清场的真实手机地图尺寸对照。 |
| `tools/visual/era-model-pipeline/package_bronze_clean.py` | 可复现的裁切、缩放、遮罩与比对脚本。 |
| `tools/visual/era-model-pipeline/bronze-clean-packaging.json` | 输入输出哈希、遮罩区域、差异与精确外部像素证据。 |

输入是现有原图和先前 ImageGen 制作的 `assets/art/source/generated/town-sci_bronze_age-clean-candidate/town-sci_bronze_age-clean-master.png`（1672×941）。脚本按运行图现有裁切 `(0,42,1672,899)` 缩放到 1024×525，按人工追踪的主楼、院墙、台阶与蓝旗多边形做 18px 扩展与 7px 羽化。原图独立青铜喷泉以椭圆留空，原样保留。脚本只包装既有绘画，不生成新的美术像素。

实跑 `python tools/visual/era-model-pipeline/package_bronze_clean.py` 退出码 **0**。遮罩非零范围为 `x347..702, y54..348`，占画幅 **16.07%**。遮罩为零区域的 **RGBA 四通道逐像素完全等于原图**；ImageGen 全幅编辑若直接替换，在该外部区域的 RGB 平均差为 **11.959/255**。主楼屋顶、院墙、台阶、蓝旗在合成候选中没有残影；360×200 和中央 2 倍局部均已目视检查。原画其余树、学院、军营、林场、矿区、农田、桥与河保持原样。

后续把三维建筑叠加时仍须检查主楼与道路接缝、实际光影与喷泉遮挡；清场通过不代表立体建筑画质通过。完整九时代三维地标、Android 实体手机测试仍未完成。回退只需不引用本候选；原运行资源与存档不变。
