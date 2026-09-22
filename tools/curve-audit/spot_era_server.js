'use strict';
// 只读：提取《放置时代》服务端相关锚点（接口名/调用点/云端计数/存档键）
const fs = require('fs'), path = require('path');
const F = path.join('E:', 'AIprogram', 'idlgame', '210(1)_unpacked', '_analysis', 'deob_main.js');
const t = fs.readFileSync(F, 'utf8');
const anchors = ['myTime.php', 'timeDay.php', 'version.php', '8.217.79.174', 'fangzhi',
  'yunUpLoadCount', 'yunDownCount', 'yunAdd', 'transferData', 'dataID',
  'coolMethod', 'loadRemoteData', 'saveKey', 'savePlayer', 'playerData', 'userData', 'playerSeven'];
for (const a of anchors) {
  const idx = []; let p = 0;
  while ((p = t.indexOf(a, p)) !== -1) { idx.push(p); p += a.length; if (idx.length > 20) break; }
  if (!idx.length) { console.log(`[0 命中] ${a}`); continue; }
  console.log(`[命中 ${idx.length}] ${a}  首个 @${idx[0]}`);
  console.log('    ' + t.slice(Math.max(0, idx[0] - 90), idx[0] + a.length + 140).replace(/\s+/g, ' '));
}
console.log('\n=== 我方对照（本地静态）===');
const R = path.join('E:', 'AIprogram', 'idlgame');
const files = ['index.html', 'config.js', 'math.js', 'ui.js'];
for (const f of files) {
  const s = fs.readFileSync(path.join(R, f), 'utf8');
  const ls = (s.match(/localStorage\./g) || []).length;
  const iv = (s.match(/setInterval\(/g) || []).length;
  const net = (s.match(/fetch\(|XMLHttpRequest|WebSocket/g) || []).length;
  console.log(`  ${f}: localStorage=${ls} setInterval=${iv} 网络调用=${net}`);
}
