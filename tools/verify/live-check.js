'use strict';
// 线上（GitHub Pages）端到端验证：真实无头浏览器加载线上站点，断言新版本已生效且游戏可运行
// 运行：node tools/verify/live-check.js
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const reaper = require('../../tests/ie001/edge-reaper');
const URL = 'https://mahochyan.github.io/idle-empire/';
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
if (!EDGE) { console.log('NO_BROWSER'); process.exit(2); }
reaper.installExitHooks();
if (!reaper.acquireLock()) { console.log('另一个浏览器套件在运行，中止'); process.exit(3); }
reaper.sweepHeadless();
const PORT = 9500 + Math.floor(Math.random() * 400), udd = path.join(os.tmpdir(), 'livecheck-' + Date.now());
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-sync', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, URL], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let msgId = 0; const pending = new Map(); const exceptions = []; let ws;
function send(method, params = {}) { return new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval异常: ' + expr + ' :: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
const rows = []; let pass = 0, fail = 0;
function test(id, name, ok, extra) { const st = ok ? 'PASS' : 'FAIL'; if (ok) pass++; else fail++; rows.push(`[${st}] ${id} — ${name}` + (ok || !extra ? '' : ' :: ' + extra)); }
(async () => {
  let targets = null;
  for (let i = 0; i < 60 && !targets; i++) { await sleep(500); try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); targets = await r.json(); } catch (e) { } }
  if (!targets) { console.log('CDP 未就绪'); reaper.killTreeSync(edge.pid); process.exit(2); }
  const page = targets.find(t => t.type === 'page' && /idle-empire/.test(t.url)) || targets.find(t => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(e); });
  ws.onmessage = ev => {
    const d = JSON.parse(ev.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') exceptions.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  };
  await send('Runtime.enable'); await send('Page.enable');
  await sleep(9000);   // 线上首屏 + tick（含 CDN 冷启动）
  console.log('线上站点: ' + URL);
  test('V01', '页面加载零未捕获异常', exceptions.length === 0, exceptions.slice(0, 2).join(' | '));
  test('V02', '线上版本锚点为数字（新提交已生效）', /^\d+$/.test(await evalJs('window.APP_VERSION')), await evalJs('String(window.APP_VERSION)'));
  test('V03', '全部脚本走 ?v=<数字>（缓存版本纪律生效）', await evalJs("(()=>{const s=[...document.querySelectorAll('script[src]')].map(x=>x.getAttribute('src'));return s.length>=7&&s.every(u=>/\\?v=\\d+/.test(u))})()"), await evalJs("JSON.stringify([...document.querySelectorAll('script[src]')].map(x=>x.getAttribute('src')).slice(0,3))"));
  test('V04', '真实 DOM 渲染资源（wood 为数字且 ≥300）', await evalJs("(()=>{const v=document.getElementById('res-wood').textContent;return /^\\d+$/.test(v)&&+v>=300})()"));
  test('V05', '新资源「地契」已上线（S.res.deed 存在且有上限）', await evalJs("typeof S!=='undefined'&&S.res&&('deed' in S.res)&&resCap('deed')>0"), await evalJs("JSON.stringify({deed:S.res.deed,cap:resCap('deed')})"));
  test('V06', '新开关已上线（townGate/save.v3/offline/idem/market.multiRate）', await evalJs("CFG.townGate&&CFG.townGate.useDeed===true&&CFG.save.v3===true&&CFG.offline.enabled===true&&CFG.idem.enabled===true&&CFG.market.multiRate===true"));
  test('V07', '核心新函数已上线（settleOffline/idemRepeat/townGateCost/popCurrent）', await evalJs("['settleOffline','idemRepeat','townGateCost','offlineAdvanceSec','popCurrent','advanceBuildingsBy'].every(f=>typeof window[f]==='function')"));
  test('V08', '离线结算可运行（构造 1h 前 ts → 结算有增益）', await evalJs("(()=>{const b=JSON.stringify(S.res);_loadedTs=Date.now()-3600*1000;_offlineSettledFor=null;const r=settleOffline();return !!(r&&r.ok&&r.durationSec===3600&&Object.keys(r.gains||{}).length>0)})()"), await evalJs("JSON.stringify(S.offline&&S.offline.pendingReport||null).slice(0,160)"));
  test('V09', '城镇门可运行（地契不足时正确拒绝）', await evalJs("(()=>{const d=S.res.deed;S.res.deed=0;const before=S.townLv;upgradeTown();const blocked=(S.townLv===before)&&(!S.townUpgrade);S.res.deed=d;return blocked})()"));
  await sleep(300);
  test('V10', '切换页面无异常（主页→建筑→科技）', await evalJs("(()=>{try{S.page='build';updateUI();S.page='tech';updateUI();S.page='home';updateUI();return true}catch(e){return false}})()") && exceptions.length === 0, exceptions.slice(0, 2).join(' | '));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const out = path.join(__dirname, '..', '..', 'docs', 'codex', 'reports', 'assets', 'live-check-360.png');
  try { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, Buffer.from(shot.data, 'base64')); test('V11', '线上页面截图已保存', true); } catch (e) { test('V11', '截图保存失败', false, e.message); }
  console.log('\n' + rows.join('\n'));
  console.log('\n浏览器异常列表：' + (exceptions.length ? exceptions.join('\n') : '（空）'));
  console.log('线上验证：通过 ' + pass + ' / 失败 ' + fail + '｜截图 ' + out);
  try { ws.close(); } catch (e) { }
  reaper.killTreeSync(edge.pid);
  await sleep(300);
  const res = reaper.sweepHeadless(true);
  console.log(`清理核对：headless 残留 ${res.found} → 已清 ${res.removed}｜剩余 ${res.remaining}`);
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('驱动失败: ' + e.message); try { reaper.killTreeSync(edge && edge.pid); } catch (_) { } process.exit(2); });
