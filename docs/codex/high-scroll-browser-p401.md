# P401｜高阶密卷浏览器专项与回归

2026-09-30，在 Windows PowerShell、Node v24.19.0、Edge `--headless=new` CDP 下验证当前工作区。测试从已提交的 P400 合法 v34 存档复制一份到**独立临时 Edge profile**，只把夹具时间戳设为当下以避免无关离线结算；不读取或修改玩家浏览器存档。当前高阶密卷运行文件在验证时尚未提交，因此以 [浏览器账本](reports/data/p401-high-scroll-browser.json)记录的七个页面源文件 SHA-256 为实际测试版本；运行中散列保持一致，其中 `math.js` 为 `575e0135ba53853f9751a07a1b3a608b6ba625689bfbc775a1049ccc6fb47fde`。

专测 [high_scroll_browser_p401.js](../../tests/progression/high_scroll_browser_p401.js) 在真实页面通过 **37/37** 断言、退出码 **0**。v34→v35 加载成功，迁移前原文同时留在 `rts_save_premigration` 和 `rts_save_backup_1`；新库存、使用次数与货位全为安全默认 0。边贸行 Lv1/Lv29 隐藏高阶密卷，Lv30/40/50/60 分别逐阶显示Ⅱ/Ⅲ/Ⅳ/Ⅴ；320px 和 390px 边贸行卡片、页面均无横向溢出。

按钮链在浏览器里实际执行：将夹具设为 Lv30、注入 3 张一阶图纸作 UI 交易材料，固定随机流后**点击刷新**得到二阶货位 11、品质 80、单张价 3；**点击交易**扣一阶图纸 3、二阶库存 +1、货位 11→10、交易进度 +1；**点击使用**使二阶库存 1→0、已用 0→1。木材仓容从 2400 **精确增至 2436**（+1.5%），重载后仍为 2436，货位与使用记录也保持，未捕获页面异常为 0。这验证真实 UI 和保存回读；Lv30 与一阶图纸数是隔离测试夹具，不能拿来证明自然玩法产出速度。

按要求串行完成另外三套 Edge 回归，均退出码 **0**：

| 命令 | 断言 | 浏览器异常 | 证据 |
| --- | ---: | ---: | --- |
| `node tests/visual/browser_smoke.js` | 217/217，失败 0 | 未捕获异常检查通过 | [视觉结果](reports/data/p401-visual-browser.json) |
| `node tests/progression/development_border_browser.js` | 57/57，失败 0 | 0 | [拓境结果](reports/data/p401-development-border-browser.log) |
| `node tests/ie001/browser_smoke.js` | 52/52，失败 0 | 0 | [IE001 输出](reports/data/p401-ie001-browser.log) |

`node --check tests/progression/high_scroll_browser_p401.js` 也退出码 **0**。拓境浏览器回归使用注入研究和兵力的夹具测试战斗结算与 UI，不构成自然成长可达证据。视觉回归生成 81 张临时截图，不作为本批交付文件。

浏览器测试的游戏断言全部通过，但高阶密卷及视觉测试各自报告了 Edge 临时 profile `PROFILE_CLEANUP_FAILED EPERM`；IE001 报告清理后 headless 残留 0。三个相关目录经只读核对均为系统 Temp 下的普通目录。随后对这些**明确路径**的 PowerShell `Remove-Item -LiteralPath ... -Recurse -Force` 清理请求被自动审批拒绝，原文理由仅为 `rejected: blocked by policy`，没有更细说明；未继续以其他工具绕过，也没有把临时 profile 内容加入仓库。残留目录不在玩家浏览器 profile 中，不改变上述游戏断言结果。
