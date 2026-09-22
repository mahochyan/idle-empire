'use strict';
// 浏览器测试清理机制（防 headless Edge 实例泄漏堆积 —— 事故：280 进程 / 24.7 GB）
// 组成：
//   ① 预扫：套件启动前清掉上次残留的 headless 实例（含被 SIGKILL 中断的孤儿）
//   ② 退出钩子：exit / SIGINT / SIGTERM / uncaughtException 都会同步清扫
//   ③ 同步全树击杀：execFileSync + taskkill /T /F（旧实现是 async spawn 后立刻 SIGKILL，taskkill 未走完即被中断 → 孤儿）
//   ④ 并发锁：同一时刻只允许一个套件持有浏览器（避免 B 套件的预扫误杀 A 套件）
//   ⑤ 旧 profile 目录回收：os.tmpdir()/ie001* 超龄目录清理
// 安全边界：只处理命令行含 "--headless" 的 msedge.exe —— 绝不触碰用户可见 Edge
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const PS_LIST = "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*--headless*' } | ForEach-Object { \"$($_.ProcessId)`t$($_.WorkingSetSize)\" }";
const LOCK = path.join(os.tmpdir(), 'ie001-edge.lock');

function psRun(script) {
  for (const exe of ['powershell', 'pwsh']) {
    try { return execFileSync(exe, ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 25000 }); }
    catch (e) { if (e && e.code === 'ENOENT') continue; return ''; }
  }
  return '';
}
function listHeadless() {
  const out = psRun(PS_LIST);
  return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(l => {
    const [pid, ws] = l.split('\t'); return { pid: parseInt(pid, 10), bytes: parseInt(ws, 10) || 0 };
  }).filter(p => Number.isFinite(p.pid) && p.pid > 0);
}
function killTreeSync(pid) {
  if (!pid) return false;
  try { execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 25000 }); return true; }
  catch (e) { return false; }
}
function staleProfiles(maxAgeMs = 30 * 60 * 1000) {
  let n = 0;
  try {
    const dir = os.tmpdir(), now = Date.now();
    for (const name of fs.readdirSync(dir)) {
      if (!/^ie001/.test(name)) continue;
      const p = path.join(dir, name);
      try { const st = fs.statSync(p); if (now - st.mtimeMs > maxAgeMs) { fs.rmSync(p, { recursive: true, force: true }); n++; } } catch (e) { }
    }
  } catch (e) { }
  return n;
}
function sweepHeadless(quiet) {
  const before = listHeadless();
  for (const p of before) killTreeSync(p.pid);
  const after = listHeadless();
  // 计数口径：以"前后差"为准（/T 树杀会让同树的其它 pid 一并消失，逐个成功计数会少报）
  const removed = Math.max(0, before.length - after.length);
  const res = { found: before.length, removed, remaining: after.length, freedMB: Math.round(before.reduce((a, p) => a + p.bytes, 0) / 1048576) };
  const prof = staleProfiles();
  if (!quiet) console.log(`[reaper] headless 实例 ${res.found} → 清除 ${removed}｜剩余 ${res.remaining}｜涉及内存约 ${res.freedMB} MB｜回收旧 profile ${prof} 个`);
  return res;
}
function acquireLock() {
  try {
    if (fs.existsSync(LOCK)) {
      const pid = parseInt(fs.readFileSync(LOCK, 'utf8').trim(), 10);
      let alive = false;
      try { process.kill(pid, 0); alive = true; } catch (e) { alive = false; }
      if (alive) return false;                    // 另一个套件正在跑：调用方应中止，避免互相清扫
    }
    fs.writeFileSync(LOCK, String(process.pid));
    return true;
  } catch (e) { return true; }
}
function releaseLock() { try { if (fs.existsSync(LOCK) && parseInt(fs.readFileSync(LOCK, 'utf8'), 10) === process.pid) fs.rmSync(LOCK, { force: true }); } catch (e) { } }

let installed = false;
function installExitHooks() {
  if (installed) return; installed = true;
  const bye = () => { try { sweepHeadless(true); } catch (e) { } try { releaseLock(); } catch (e) { } };
  process.on('exit', bye);
  process.on('SIGINT', () => { bye(); process.exit(130); });
  process.on('SIGTERM', () => { bye(); process.exit(143); });
  process.on('uncaughtException', e => { console.log('未捕获异常: ' + (e && e.message)); bye(); process.exit(2); });
}
module.exports = { sweepHeadless, killTreeSync, installExitHooks, listHeadless, acquireLock, releaseLock, staleProfiles };

if (require.main === module) {
  installExitHooks();
  console.log('手动清理 headless Edge 测试实例（只清理 --headless，不动可见 Edge）');
  const r = sweepHeadless();
  console.log(JSON.stringify(r));
  process.exit(0);
}
