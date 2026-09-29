'use strict';
// Targeted real-Edge decode and action smoke for one high-res action unit.
// Run: node tests/visual/archer_t1_actions_browser.js [unit_id]
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const unitType=process.argv[2]||'archer_t1';
if(!/^[a-z0-9_]+$/.test(unitType))throw Error('Invalid unit id');
const unitSlug=unitType.replaceAll('_','-');
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
// Keep Chromium's short-lived profile on the workspace drive; the system
// drive can be too small for repeated visual runs on Windows.
const tempFolder=path.join(root,'hd2d-previews','.cdp-temp');
fs.mkdirSync(tempFolder,{recursive:true});
const tempRoot=fs.realpathSync(tempFolder);
const profile=fs.mkdtempSync(path.join(tempRoot,'unit-action-cdp-'));
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
      item.type===${JSON.stringify(unitType)}&&item.side==='allies');
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
async function sameRowAttackOverlap(targetId){
  return evalJs(`(async()=>{
    const layout=HD2D.status().battle.layout;
    const target=layout.find(item=>item.id===${targetId});
    const neighbors=layout.filter(item=>item.side===target?.side&&
      item.slotRow===target?.slotRow&&item.id!==target?.id);
    async function alphaFrames(path,count){
      const image=new Image();image.src=path;await image.decode();
      const cellWidth=image.naturalWidth/count;
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;
      canvas.height=image.naturalHeight;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      const rgba=context.getImageData(0,0,canvas.width,canvas.height).data;
      return Array.from({length:count},(_,frame)=>{
        let left=cellWidth,top=canvas.height,right=-1,bottom=-1;
        for(let y=0;y<canvas.height;y+=2)for(let x=0;x<cellWidth;x+=2){
          if(rgba[(y*canvas.width+frame*cellWidth+x)*4+3]>32){
            left=Math.min(left,x);top=Math.min(top,y);
            right=Math.max(right,x);bottom=Math.max(bottom,y);
          }
        }
        return {left:left/cellWidth,top:top/canvas.height,
          right:(right+2)/cellWidth,bottom:(bottom+2)/canvas.height};
      });
    }
    if(!target)return {error:'target missing'};
    const action=await alphaFrames('./assets/art/units/hires/actions/compact/'+
      ${JSON.stringify(unitType)}+'-attack.png',4);
    const idle=new Map(await Promise.all([...new Set(neighbors.map(item=>item.type))]
      .map(async type=>[type,(await alphaFrames('./assets/art/units/hires/'+type+'.png',1))[0]])));
    const project=(unit,bounds)=>{
      const rect=unit.spriteRect,mirror=unit.side==='allies';
      const left=mirror?1-bounds.right:bounds.left;
      const right=mirror?1-bounds.left:bounds.right;
      return {left:rect.left+(rect.right-rect.left)*left,
        right:rect.left+(rect.right-rect.left)*right,
        top:rect.top+(rect.bottom-rect.top)*bounds.top,
        bottom:rect.top+(rect.bottom-rect.top)*bounds.bottom};
    };
    const ratios=[];
    for(let frame=1;frame<4;frame++)for(const neighbor of neighbors){
      const a=project(target,action[frame]),b=project(neighbor,idle.get(neighbor.type));
      const area=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*
        Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      const smaller=Math.min((a.right-a.left)*(a.bottom-a.top),
        (b.right-b.left)*(b.bottom-b.top));
      ratios.push({frame,neighbor:neighbor.id,neighborType:neighbor.type,
        ratio:smaller>0?+(area/smaller).toFixed(3):0});
    }
    ratios.sort((a,b)=>b.ratio-a.ratio);
    return {targetId:target.id,targetType:target.type,row:target.slotRow,
      neighborCount:neighbors.length,maxRatio:ratios[0]?.ratio||0,worst:ratios.slice(0,4)};
  })()`);
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
  const unitRow=await evalJs(`CFG.units[${JSON.stringify(unitType)}]?.row`);
  const targetIndex=unitRow==='back'?8:unitRow==='mid'?4:0;
  const targetId=71000+targetIndex;
  const sparse=await runFixture({width:390,height:844,
    allies:[[unitType,70001,unitRow]],
    enemies:[['infantry',70002,'front']],epoch:90001});
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
        frames:unit?.portraitActionFrames,facing:unit?.facing,
        followersVisible:unit?.followersVisible,badgeVisible:unit?.badgeVisible};
    })()`);
    check(`Sparse ${kind} uses four high-res frames`,seen.accepted&&
      seen.action===kind&&seen.ready&&seen.frames===4&&seen.facing==='left',seen);
    if(kind==='death')check('Sparse death hides follower portraits and health badge',
      seen.followersVisible===0&&seen.badgeVisible===false,seen);
    // Death is fixed to 620 ms by the visual layer, regardless of event
    // duration; capture its final prone frame before the action resets.
    await sleep(kind==='death'?500:310);
    const file=await shot(`qa-${unitSlug}-${kind}-sparse-390`);
    check(`Sparse ${kind} screenshot saved`,fs.statSync(file).size>10000,file);
    if(kind==='death'){
      const restored=await evalJs(`(async()=>{
        for(let attempt=0;attempt<30;attempt++){
          await new Promise(resolve=>setTimeout(resolve,30));
          const unit=HD2D.status().battle.layout.find(item=>item.id===70001);
          if(unit?.portraitAction==='idle')return {
            action:unit.portraitAction,badge:unit.badgeVisible,
            followers:unit.followersVisible};
        }
        return null;
      })()`);
      check('Sparse surviving fixture restores badge and followers after death pose',
        restored?.action==='idle'&&restored.badge===true&&restored.followers===2,restored);
    }
  }
  const rows=['front','mid','back'];
  const allies=Array.from({length:12},(_,i)=>[i===targetIndex?unitType:'infantry',
    71000+i,rows[Math.floor(i/4)]]);
  const enemies=Array.from({length:12},(_,i)=>['infantry',72000+i,rows[Math.floor(i/4)]]);
  const full=await runFixture({width:320,height:568,allies,enemies,epoch:90002});
  check('320px full formation loads 256px action cells',full.start.mounted&&
    full.start.layout===24&&full.ready?.cell===256,full);
  for(const kind of ['attack','hit','death']){
    const event={epoch:90002,type:kind,sourceId:kind==='attack'?targetId:72000,
      targetId:kind==='attack'?72000:targetId,
      sourceSide:kind==='attack'?'allies':'enemies',
      targetSide:kind==='attack'?'enemies':'allies',durationMs:900};
    const fullAction=await evalJs(`(()=>{
      const accepted=HD2D.playBattle(${JSON.stringify(event)});
      const unit=HD2D.status().battle.layout.find(item=>item.id===${targetId});
      return {accepted,action:unit?.portraitAction,ready:unit?.portraitActionReady,
        frames:unit?.portraitActionFrames,cell:unit?.portraitActionCellPx,
        badgeVisible:unit?.badgeVisible,
        overflow:document.getElementById('battle-screen').scrollWidth>innerWidth+1};
    })()`);
    check(`Full formation ${kind} uses compact four-frame art without overflow`,
      fullAction.accepted&&fullAction.action===kind&&fullAction.ready&&
      fullAction.frames===4&&fullAction.cell===256&&!fullAction.overflow,fullAction);
    if(kind==='death')check('Full formation death hides health badge',
      fullAction.badgeVisible===false,fullAction);
    if(kind==='attack'){
      const overlap=await sameRowAttackOverlap(targetId);
      check('Full attack same-row alpha-content bounds overlap no more than 30%',
        overlap.neighborCount===3&&overlap.maxRatio<=0.30,overlap);
      console.log('ATTACK_OVERLAP',JSON.stringify(overlap));
    }
    await sleep(kind==='death'?500:310);
    const fullShot=await shot(`qa-${unitSlug}-${kind}-full-320`);
    check(`Full formation ${kind} screenshot saved`,fs.statSync(fullShot).size>10000,fullShot);
    if(kind==='death'){
      const restored=await evalJs(`(async()=>{
        for(let attempt=0;attempt<30;attempt++){
          await new Promise(resolve=>setTimeout(resolve,30));
          const unit=HD2D.status().battle.layout.find(item=>item.id===${targetId});
          if(unit?.portraitAction==='idle')return {
            action:unit.portraitAction,badge:unit.badgeVisible};
        }
        return null;
      })()`);
      check('Full surviving fixture restores health badge after death pose',
        restored?.action==='idle'&&restored.badge===true,restored);
    }
  }
  check('Required HTTP art returned no 404',missing.size===0,[...missing]);
  const failed=checks.filter(item=>!item.ok);
  console.log(JSON.stringify({unitType,passed:checks.length-failed.length,failed:failed.length,checks,
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
