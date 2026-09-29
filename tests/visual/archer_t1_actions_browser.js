'use strict';
// Targeted real-Edge decode and action smoke for the new archer_t1 sprite sheets.
// Run: node tests/visual/archer_t1_actions_browser.js
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(file=>fs.existsSync(file));
if(!edge){console.error('NO_BROWSER: Microsoft Edge is unavailable');process.exit(2);}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.json':'application/json','.png':'image/png','.glb':'model/gltf-binary'};
const missing=new Set();
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,pathname.replace(/^\/+/, '')||'index.html');
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){if(pathname!=='/favicon.ico')missing.add(pathname);res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store'});res.end(data);
  });
});
const tempRoot=fs.realpathSync(os.tmpdir());
const profile=fs.mkdtempSync(path.join(tempRoot,'archer-action-cdp-'));
if(!path.resolve(profile).startsWith(tempRoot+path.sep))throw Error('profile outside temp');
const previewDir=path.join(root,'hd2d-previews');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser,ws,nextId=0;
const pending=new Map(),checks=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail:ok?undefined:detail});}
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method));},12000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function shot(name){
  const result=await send('Page.captureScreenshot',{format:'png'});
  fs.mkdirSync(previewDir,{recursive:true});
  const file=path.join(previewDir,name+'.png');
  fs.writeFileSync(file,Buffer.from(result.data,'base64'));
  return file;
}
async function waitReady(){
  for(let i=0;i<100;i++){
    try{if(await evalJs("document.readyState==='complete'&&typeof HD2D==='object'&&typeof openBattle==='function'"))return true;}
    catch(_){}
    await sleep(100);
  }
  return false;
}
async function waitPortrait(){
  for(let i=0;i<100;i++){
    const state=await evalJs(`(()=>{const unit=HD2D.status().battle.layout.find(item=>
      item.type==='archer_t1'&&item.side==='allies');
      return unit?{portraitReady:unit.portraitReady,actionsReady:unit.portraitActionsReady,
        cell:unit.portraitActionCellPx}:null;})()`);
    if(state?.portraitReady&&state?.actionsReady)return state;
    await sleep(50);
  }
  return null;
}
async function runFixture({width,height,allies,enemies,epoch}){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
  await sleep(100);
  const start=await evalJs(`(()=>{
    const make=(type,id,row)=>({type,id,row,count:20,hp:100,maxHp:100,icon:CFG.units[type].icon});
    HD2D.disposeBattle();
    const allies=${JSON.stringify(allies)}.map(([type,id,row])=>make(type,id,row));
    const enemies=${JSON.stringify(enemies)}.map(([type,id,row])=>make(type,id,row));
    const mounted=HD2D.mountBattle(document.getElementById('battle-scene'),
      {epoch:${epoch},round:0,speed:1,stage:'art-check',allies,enemies},{});
    document.getElementById('battle-screen').classList.toggle('hd2d-active',mounted);
    return {mounted,layout:HD2D.status().battle.layout.length};
  })()`);
  const ready=await waitPortrait();
  return {start,ready};
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/index.html`;
  const port=27500+Math.floor(Math.random()*1000);
  browser=spawn(edge,['--headless=new','--no-first-run','--disable-extensions','--no-sandbox',
    '--disable-background-networking','--disable-component-update','--disable-sync',
    '--enable-unsafe-swiftshader','--remote-debugging-port='+port,
    '--user-data-dir='+profile,url],{stdio:'ignore',windowsHide:true});
  let page;
  for(let i=0;i<50;i++){
    await sleep(300);
    try{page=(await(await fetch(`http://127.0.0.1:${port}/json`)).json())
      .find(item=>item.type==='page'&&item.url===url);if(page)break;}catch(_){}
  }
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data);
    if(data.id&&pending.has(data.id)){
      const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);
      data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
    }
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.reload',{ignoreCache:true});
  check('HTTP game ready',await waitReady());
  const visible=await evalJs(`(()=>{
    const screen=document.getElementById('battle-screen');
    screen.classList.add('active');return screen.getBoundingClientRect().height>300;
  })()`);
  check('Battle stage visible',visible);
  const sparse=await runFixture({width:390,height:844,
    allies:[['archer_t1',70001,'back']],enemies:[['infantry',70002,'front']],epoch:90001});
  check('390px sparse portrait and all action atlases decode at 512px',
    sparse.start.mounted&&sparse.ready?.cell===512,sparse);
  for(const kind of ['attack','hit','death']){
    const event={epoch:90001,type:kind,sourceId:kind==='attack'?70001:70002,
      targetId:kind==='attack'?70002:70001,
      sourceSide:kind==='attack'?'allies':'enemies',
      targetSide:kind==='attack'?'enemies':'allies',durationMs:900};
    const seen=await evalJs(`(()=>{
      const accepted=HD2D.playBattle(${JSON.stringify(event)});
      const unit=HD2D.status().battle.layout.find(item=>item.id===70001);
      return {accepted,action:unit?.portraitAction,ready:unit?.portraitActionReady,
        frames:unit?.portraitActionFrames,facing:unit?.facing};
    })()`);
    check(`Sparse ${kind} uses four high-res frames`,seen.accepted&&
      seen.action===kind&&seen.ready&&seen.frames===4&&seen.facing==='left',seen);
    if(kind==='attack'){
      await sleep(310);
      const file=await shot('qa-archer-t1-attack-sparse-390');
      check('Sparse attack screenshot saved',fs.statSync(file).size>10000,file);
    }else await sleep(75);
  }
  const rows=['front','mid','back'];
  const allies=Array.from({length:12},(_,i)=>[i===0?'archer_t1':'infantry',71000+i,rows[Math.floor(i/4)]]);
  const enemies=Array.from({length:12},(_,i)=>['infantry',72000+i,rows[Math.floor(i/4)]]);
  const full=await runFixture({width:320,height:568,allies,enemies,epoch:90002});
  check('320px full formation loads 256px action cells',full.start.mounted&&
    full.start.layout===24&&full.ready?.cell===256,full);
  const fullAction=await evalJs(`(()=>{
    const accepted=HD2D.playBattle({epoch:90002,type:'attack',sourceId:71000,
      targetId:72000,sourceSide:'allies',targetSide:'enemies',durationMs:900});
    const unit=HD2D.status().battle.layout.find(item=>item.id===71000);
    return {accepted,action:unit?.portraitAction,ready:unit?.portraitActionReady,
      frames:unit?.portraitActionFrames,cell:unit?.portraitActionCellPx,
      overflow:document.getElementById('battle-screen').scrollWidth>innerWidth+1};
  })()`);
  check('Full formation attack uses compact four-frame art without overflow',
    fullAction.accepted&&fullAction.action==='attack'&&fullAction.ready&&
    fullAction.frames===4&&fullAction.cell===256&&!fullAction.overflow,fullAction);
  await sleep(310);
  const fullShot=await shot('qa-archer-t1-attack-full-320');
  check('Full formation attack screenshot saved',fs.statSync(fullShot).size>10000,fullShot);
  check('Required HTTP art returned no 404',missing.size===0,[...missing]);
  const failed=checks.filter(item=>!item.ok);
  console.log(JSON.stringify({passed:checks.length-failed.length,failed:failed.length,checks,
    environment:'Node + Edge headless CDP; emulated CSS viewports, not Android hardware'},null,2));
  process.exitCode=failed.length?1:0;
})().catch(error=>{console.error('ARCHER_ACTION_BROWSER_ERROR',error.stack||error);process.exitCode=2;})
.finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser?.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],
    {windowsHide:true,stdio:'ignore'});
  await new Promise(resolve=>server.close(resolve));
  await sleep(250);
  try{if(fs.existsSync(profile))fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:250});}
  catch(error){console.error('PROFILE_CLEANUP_FAILED',error.message);}
  process.exit(process.exitCode||0);
});
