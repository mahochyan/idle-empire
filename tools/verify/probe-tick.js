'use strict';
// 最小复现 v2：逐步隔离——加载/设场景/tick，各自独立捕获并打印完整堆栈
const fs = require('fs'), path = require('path'), vm = require('vm');
const F = ['config.js', 'levels.js', 'math.js', 'garrison.js', 'technology.js'];
const store = new Map();
const el = () => ({ style: {}, classList: { add() { }, remove() { }, contains: () => false }, value: '', innerHTML: '', textContent: '', addEventListener() { }, querySelectorAll: () => [], appendChild() { }, select() { }, remove() { } });
const ctx = { console, Date, Math, JSON, localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) }, document: { getElementById: el, querySelectorAll: () => [], createElement: el, body: el(), activeElement: null }, window: {}, setTimeout: () => 0, clearTimeout: () => { }, setInterval: () => 0, clearInterval: () => { }, updateUI: () => { }, toast: () => { }, addLog: () => { }, pix: () => '', confirm: () => true };
const sb = vm.createContext(ctx);
const run = (code) => {
  try { return vm.runInContext(code, sb, { filename: 'vm' }); }
  catch (e) { console.log('VM 异常 @[' + code.slice(0, 50) + ']:', e.message); console.log(e.stack.split('\n').slice(1, 4).join('\n')); return undefined; }
};
for (const f of F) vm.runInContext(fs.readFileSync(path.join('E:/AIprogram/idlgame', f), 'utf8'), sb, { filename: f });
run('loadSaveAndApply()');
run("S.buildings.mine={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.buildings.academy={lv:1,state:'idle',timer:0,timerEnd:0,tier:0};S.res.copper=100;S.res.tech=0");
console.log('tick 前: copper=', run('S.res.copper'), 'tech=', run('S.res.tech'), 'mine=', run("JSON.stringify(bldSt('mine'))"));
console.log('prodRate(copper)=', run("prodRate('copper')"), '| passiveProduction 存在:', run('typeof passiveProduction'));
run('tick()');
console.log('tick 后: copper=', run('S.res.copper'), 'tech=', run('S.res.tech'), 'tick=', run('S.tick'));
console.log('--- 直接调用 passiveProduction ---');
run('passiveProduction()');
console.log('直接调用后: copper=', run('S.res.copper'), 'tech=', run('S.res.tech'));
console.log('--- resCap(copper)=', run("resCap('copper')"), '| effConsume(mint,food)=', run("typeof effConsume==='function'?effConsume('mint','food'):'n/a'"));
console.log('--- tick 源码前 3 行 ---');
console.log(run('tick.toString()').split('\n').slice(0, 6).join('\n'));