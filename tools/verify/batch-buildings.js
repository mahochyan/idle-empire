'use strict';
// UI 分支批量出图：冶炼厂/铸币厂/市场（等距像素建筑，复刻伐木场/矿井画风）→ clean_asset 统一尺寸
const { execFile } = require('node:child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const CFG = {
  python: 'E:/AIprogram/models/.venv-qwenimg/Scripts/python.exe',
  infer: 'D:/DeepSeek/dsh-ext/dsh-ui-image/infer.py',
  cleaner: 'E:/AIprogram/idlgame/tools/verify/clean_asset.py',
  outDir: 'E:/AIprogram/idlgame/assets',
  modelDir: 'E:/AIprogram/models/Qwen-Image-2.1',
};
const COMMON = '16-bit pixel art isometric building, dark fantasy RPG style like SNES strategy games, stone brick foundation platform, dark outlines, transparent background, detailed like Ragnarok Online pixel scenery';
const JOBS = [
  { out: 'map-smelter.png', prompt: '16-bit pixel art isometric building, a copper smeltery forge with a tall brick chimney emitting light smoke, glowing molten copper pour, metal ingots stacked on a wooden pallet, stone and brick structure, wooden roof, ' + COMMON },
  { out: 'map-mint.png', prompt: '16-bit pixel art isometric building, a coin mint workshop with a large mechanical coin press, stacks of gold coins and pouches, gold and warm wood palette with brass details, stone foundation, ' + COMMON },
  { out: 'map-market.png', prompt: '16-bit pixel art isometric building, a market square with colorful striped awning stalls, wooden crates and barrels, sacks of goods, a weighing scale, stone paved plaza base, ' + COMMON },
];
const runStep = (cmd, args) => new Promise((res, rej) => {
  require('node:child_process').execFile(cmd, args, { timeout: 25 * 60 * 1000, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (e, so, se) => {
    if (e && !so) return rej(new Error(String(e.message) + ' | ' + String(se || '').slice(-300)));
    res(String(so || ''));
  });
});
(async () => {
  for (const j of JOBS) {
    const outAbs = path.join(CFG.outDir, j.out);
    const argFile = path.join(os.tmpdir(), 'ui-batch-' + j.out + '.json');
    fs.writeFileSync(argFile, JSON.stringify({ mode: 't2i', modelDir: CFG.modelDir || 'E:/AIprogram/models/Qwen-Image-2.1', prompt: j.prompt, width: 512, height: 512, steps: 24, guidance: 4, offload: 'sequential', outPath: outAbs }), 'utf8');
    process.stdout.write(`[${j.out}] 生成中…\n`);
    let t0 = Date.now();
    const raw = await runStep(CFG.python, [CFG.infer, argFile]);
    const line = raw.split(/\r?\n/).filter(s => s.trim().startsWith('{')).pop();
    const gen = JSON.parse(line || '{}');
    process.stdout.write(`[${j.out}] 生成 ${gen.ok ? 'OK ' + Math.round((Date.now() - t0) / 1000) + 's' : 'FAIL ' + (gen.error || '').slice(0, 160)}\n`);
    if (!gen.ok) continue;
    t0 = Date.now();
    const cleaned = await runStep(CFG.python, [path.join('E:/AIprogram/idlgame/tools/verify/clean_asset.py'), outAbs, outAbs, '352', '8']);
    process.stdout.write(`[${j.out}] 清理: ${cleaned.trim()} (${Math.round((Date.now() - t0) / 1000)}s)\n`);
    fs.unlinkSync(argFile);
  }
  console.log('BATCH DONE');
})().catch(e => { console.log('BATCH FAIL:', e.message); process.exit(1); });