'use strict';
// UI美化落地探针：真实 Edge，检查 computed style 是否命中新增样式。只读，不改档。
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
if(!EDGE){console.log('NO_BROWSER');process.exit(2)}
const PORT = 9500 + Math.floor(Math.random()*400), udd = path.join(os.tmpdir(),'uibeauty-'+Date.now());
const FILE = 'file:///E:/AIprogram/idlgame/index.html';
const edge = spawn(EDGE,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox',
  '--disable-dev-shm-usage','--disable-background-networking','--remote-debugging-port='+PORT,'--user-data-dir='+udd,FILE],{stdio:'ignore'});
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
let msgId=0; const pending=new Map(); let ws;
function send(m,p={}){return new Promise((res,rej)=>{const id=++msgId;pending.set(id,{res,rej});ws.send(JSON.stringify({id,method:m,params:p}))})}
async function ev(expr){const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true});
  if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
(async()=>{
  try{
    let t=null; for(let i=0;i<60&&!t;i++){ try{ const j=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); t=j.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);}catch(e){} if(!t)await sleep(300);}
    if(!t){console.log('CDP_TIMEOUT');process.exit(2)}
    ws=new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;
      ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result)}}});
    await send('Runtime.enable'); await send('Page.enable');
    // 关键：模拟"用户只是切回标签页"之外的两种刷新，看缓存是否作祟
    await send('Network.enable'); await send('Network.setCacheDisabled',{cacheDisabled:true});
    await send('Page.reload',{ignoreCache:true});
    await sleep(2500);
    const out = await ev(`(()=>{
      const cs=e=>e?getComputedStyle(e):null;
      const root=cs(document.documentElement);
      const rules=[...document.styleSheets].flatMap(s=>{try{return[...s.cssRules]}catch(e){return[]}});
      const kf=rules.filter(r=>r.type===7).map(r=>r.name);
      const phone=document.querySelector('#phone'), btn=document.querySelector('.btn,.btn-go,.nav-btn');
      return {
        样式表数量: document.styleSheets.length,
        样式标签数: document.querySelectorAll('style').length,
        CSS规则总数: rules.length,
        关键帧总数: kf.length,
        新增关键帧命中: ['tier-legendary-glow','prog-shimmer','modal-slide-in','hp-low-pulse','target-pulse','vfx-slash-spin','banner-glow','val-flash-up','result-win-glow','modal-fade-in','battle-screen-fade-in'].filter(n=>kf.includes(n)),
        '--res-coal': root.getPropertyValue('--res-coal').trim()||'(空)',
        '--tier-legendary': root.getPropertyValue('--tier-legendary').trim()||'(空)',
        '--px-gold': root.getPropertyValue('--px-gold').trim()||'(空)',
        phone左边框: phone?cs(phone).borderLeftWidth:'无#phone',
        phone阴影: phone?cs(phone).boxShadow.slice(0,70):'',
        按钮过渡: btn?cs(btn).transitionProperty+' / '+cs(btn).transitionDuration+' / '+cs(btn).transitionTimingFunction:'无按钮',
        像素图标span数: document.querySelectorAll('span[class*="i-"]').length,
      };
    })()`);
    console.log(JSON.stringify(out,null,2));
    const errs = await ev(`(window.__errs||[]).slice(0,5)`);
    console.log('页面错误:', JSON.stringify(errs));
  } catch(e){ console.log('ERROR: '+e.message); }
  finally{ try{ws&&ws.close()}catch(e){}; try{spawn('taskkill',['/F','/T','/PID',String(edge.pid)],{stdio:'ignore'})}catch(e){}; try{fs.rmSync(udd,{recursive:true,force:true})}catch(e){} }
  process.exit(0);
})();
