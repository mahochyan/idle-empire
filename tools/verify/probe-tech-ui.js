'use strict';
// 诊断：科技页到底渲染了什么？（本地 + 线上各跑一次）
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const reaper = require(path.join(__dirname, '..', '..', 'tests', 'ie001', 'edge-reaper'));
const TARGET = process.argv[2] || 'file:///E:/AIprogram/idlgame/index.html';
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
if (!EDGE) { console.log('NO_BROWSER'); process.exit(2); }
reaper.installExitHooks();
if (!reaper.acquireLock()) { console.log('locked'); process.exit(3); }
reaper.sweepHeadless();
const PORT = 9600 + Math.floor(Math.random() * 300), udd = path.join(os.tmpdir(), 'techdiag-' + Date.now());
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, TARGET], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let msgId = 0; const pending = new Map(); const exceptions = []; let ws;
function send(method, params = {}) { return new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); }); }
async function evalJs(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval失败'); return r.result.value; }
(async () => {
  let targets = null;
  for (let i = 0; i < 60 && !targets; i++) { await sleep(500); try { const r = await fetch('http://127.0.0.1:' + PORT + '/json'); targets = await r.json(); } catch (e) { } }
  if (!targets) { console.log('CDP 未就绪'); reaper.killTreeSync(edge.pid); process.exit(2); }
  const page = targets.find(t => t.type === 'page') || targets[0];
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => { const d = JSON.parse(ev.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result); } if (d.method === 'Runtime.exceptionThrown') exceptions.push(d.params.exceptionDetails.exception?.description || ''); };
  await send('Runtime.enable'); await send('Page.enable');
  await sleep(6000);
  console.log('URL:', await evalJs('location.href'));
  console.log('APP_VERSION:', await evalJs('window.APP_VERSION||"(无)"'));
  // 切到科技页
  await evalJs("S.page='tech';updateUI();'ok'"); await sleep(200);
  const mainHtml = await evalJs("document.getElementById('main').innerHTML");
  console.log('\n=== 科技页 DOM 分析 ===');
  console.log('innerHTML 长度:', mainHtml.length);
  console.log('含「资源科技」:', mainHtml.includes('资源科技'));
  console.log('含「探矿术」:', mainHtml.includes('探矿术'));
  console.log('含「冶铜术」:', mainHtml.includes('冶铜术'));
  console.log('含「研究」按钮:', mainHtml.includes('researchScience'));
  console.log('含「兵谱」:', mainHtml.includes('兵谱'));
  console.log('含「精魄库存」:', mainHtml.includes('精魄库存'));
  // 打印前 2000 字符看结构
  console.log('\n=== 科技页 innerHTML 前 2000 字 ===');
  console.log(mainHtml.slice(0, 2000));
  console.log('\n=== 异常 ===');
  console.log(exceptions.length ? exceptions.join('\n') : '（无）');
  reaper.killTreeSync(edge.pid);
  await sleep(300); reaper.sweepHeadless(true);
  try { fs.rmSync(udd, { recursive: true, force: true }); } catch (e) { }
  process.exit(0);
})().catch(e => { console.log('失败:', e.message); try { reaper.killTreeSync(edge && edge.pid); } catch (_) { } process.exit(2); });