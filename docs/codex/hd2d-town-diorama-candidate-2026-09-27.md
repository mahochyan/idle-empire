# 主城 3D + 2D 绘制样板验收（2026-09-27）

## 基线与改动

- 工作树基线 `master` / `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。原有未提交文件保留；未 reset、提交或推送。
- 九时代运行全景均为 1024 × 525 PNG；[九图联系图](../../hd2d-previews/qa-nine-town-panorama-contact.png) 显示中心主楼从木构到后期科技建筑发生轮廓变化。
- 原独立主楼候选是 2,401,524 B / 24,632 三角面；[旧比较图](../../hd2d-previews/qa-town-hall-base-paint-vs-3d.png) 暴露建筑孤立、周围环境空白。
- 新增独立候选 `assets/art/models/candidates/town_hall_base_diorama.glb`，包含原真实三维主楼、起伏贴图地面、外院围墙，以及八张按深度放置的二维树木／灌木卡。色调取自基础时代全景，仅做日间图。
- 可编辑源、五张 ImageGen 母图、打包脚本、GLB 验证及重新导入脚本在 [`assets/art/source/models/town_hall_base_diorama/README.md`](../../assets/art/source/models/town_hall_base_diorama/README.md) 所列目录。

## 视觉与结构证据

- [360 × 200px 原图、旧模型、新候选并置](../../hd2d-previews/qa-town-base-200px-original-old-new.png)：新候选消除了旧模型四周大片空白，增加明亮草地、脚印小路、树木、石子和院墙。原图仍在屋脊、配景密度和地形遮挡方面更完整；**新候选未达到运行替换品质**。
- [GLB 重导入渲染](../../hd2d-previews/qa-town-base-diorama-glb-reimport.png) 与制作场景渲染为同一镜头；720 × 400 的平均 RGBA 绝对像素差分别为 0.397、0.409、0.210、0.073，证明导出没有明显丢失贴图或透明信息。
- `python assets/art/source/models/town_hall_base_diorama/verify_diorama.py`：退出码 0；3,985,064 B，27,810 三角面，32 网格，10 张内嵌 PNG，13 个带 UV 贴图图元，3 个 alpha mask 材质，0 个外部 URI。GLB SHA-256 `52373DA53304B5EAB7CBDFE5BA6A449C1013028080AE06EACB04CF35BCEF14F8`。
- Blender 5.2.1 `make_diorama.py`、`render_glb_import.py`：均退出码 0。`pack_textures.py`、`make_comparison.py`：均退出码 0。第一次结构验证发现 Blender 将裁片输出为 `BLEND`，后在导出脚本中改为 `MASK` 并重新验证通过；第一次重导入脚本的旧网格数阈值和合并后的 29 网格不符，修正验收阈值后重新导入成功。未掩盖中途失败。

## 后续接入门槛

当前运行地图是原全景的浮雕层。若把候选 GLB 直接叠上去，会出现两栋主城及不同投影关系，所以未改 `hd2d.js`、运行 GLB、`index.html`、Android 包或存档。要扩展九时代，需要每个时代各自的中心建筑与其他地标三维轮廓、与之匹配的绘制贴图、去除原全景建筑后的环境画、统一镜头与遮挡规则。仅复制基础时代模型换色无法满足九时代图像。

本次候选单地标已接近 4 MB / 2.8 万三角面。九时代需共享植被与地面材质、按地图尺寸制作远景 LOD，并在实体 Android 手机上测帧率、内存、温度和触控；当前没有实体手机，**实机未验证**。UI、战斗、`S/B` 和 `rts_save` 均未改。回退仅需移除新候选 GLB、相应源目录和预览／报告，不需迁移存档。
