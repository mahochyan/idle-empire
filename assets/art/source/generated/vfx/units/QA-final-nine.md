# 最后九张逐兵种攻击特效 QA

基线：`master`，HEAD `406bce4dc86a7d12f442ceebe5143ec9fa6f6e6d`。工作区原有未提交改动均保留。本批只改美术资源、逐 ID 可编辑源、资源清单和美术校验；未改伤害、战斗状态、`rts_save`、`hd2d.js` 或 Android 容器。

## 交付

- `archer_shadowblade`、`mage_time`、`mage_space`、`mage_chrono`、`mage_merlin`、`god_crystal_guard`、`phantom_god`、`guardian_god`、`slaughter_god` 各有一张 1254×1254 原创 ImageGen RGBA 母图、一张 256×256 运行 PNG、一份同 ID SVG。
- 九张改造前运行图保存在 `previous-runtime-final9/`。时序法师贴边的第一稿母图保存在 `previous-masters-final9/mage_chrono-first.png`；选用稿通过 ImageGen 缩小居中。
- 完整生成和修订提示词分别在 `PROMPTS-final-nine-mages-shadow.json`、`PROMPTS-divine-four.json`。未用第三方游戏图做参考。
- [九张 64px 浅／深底运行图](../../../../../../hd2d-previews/qa-vfx-final-nine-runtime-64.png)；逐项 alpha、哈希和备份关系见 `final-nine-validation.json`。

## 视觉复核

完整 256px 透明图先缩到 64×64，再用最近邻放大展示。影刃双刃斩、钟轮飞矢、空间裂隙、双轮时序、梅林晶矢、青晶盾、幻影棱镜、重装盾墙和猩红三连斩在浅沙地与深灰底均保留可辨的主要轮廓。时序和梅林较三阶法术更繁复；神系五阶的光学、守护与战术攻击亦各有独立形状。幻影的细小折射片在 64px 会合并；重装盾墙右侧浅金光在浅底偏淡，主盾仍清楚。

九张候选运行 PNG 都是 256×256、alpha 同时含 0 和 255，四周有透明边距；候选与已接入运行图 SHA256 逐张一致，且与九张备份不同。全部 45 个 `CFG.units` ID 都有独立母图、逐 ID SVG 和运行 PNG；45 个母图 SHA256 各异，45 个运行 PNG SHA256 各异。

## 命令与结果

| 命令 | 结果 |
| --- | --- |
| `python assets/art/source/vfx/review-final-nine.py` | 退出码 0；9 张新增图、备份、SVG 和 45 个独立哈希检查通过 |
| `python assets/art/source/vfx/review-techline-batches.py` | 退出码 0；第 2–4 批 18 张通过 |
| `python assets/art/source/vfx/review-techline-batch5.py` | 退出码 0；第五批 6 张通过 |
| `node assets/art/source/check.mjs` | 退出码 0；45 张逐 ID 战斗特效及其他运行美术通过 |
| `node assets/art/source/check-http.mjs` | 退出码 0；571 个资源 URL 均返回 200 |
| `node --check assets/art/source/vfx/generate-unit-vfx.mjs`、`python -m py_compile assets/art/source/vfx/review-final-nine.py` | 均退出码 0 |
| `node assets/art/source/vfx/generate-unit-vfx.mjs --candidate-dir=<临时候选目录>`，再按 45 个 ID 比较候选与运行图 SHA256 | 退出码 0；45/45 全量重建逐字节相同 |

资源层验证不等于实际战斗或安卓实机验证；新图的弹道、遮挡、帧率与手机触控仍需在运行画面中检查。回退这一批的运行视觉时，按同名文件从 `previous-runtime-final9/` 复制回 `assets/art/vfx/units/`；如需继续用旧视觉重新生成资源，还须配套恢复原 SVG／母图来源，不能仅回退运行 PNG 后再次执行当前生成器。
