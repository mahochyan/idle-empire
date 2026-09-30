'use strict';
// Node + Edge/CDP presentation fixture. The candidate route is served only in
// this isolated browser; the game's runtime asset is never changed for preview.
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const unitType=process.argv.find(arg=>arg.startsWith('--unit='))?.slice(7)||'iron_spearman';
if(!/^[a-z0-9_]+$/.test(unitType))throw Error('Invalid unit ID');
const eventKind=process.argv.find(arg=>arg.startsWith('--event='))?.slice(8)||'attack';
if(!['attack','hit'].includes(eventKind))throw Error('Unsupported visual event');
const candidate=process.argv.includes('--candidate');
const candidateVersion=process.argv.includes('--v3')?'v3':'v2';
const label=process.argv.includes('--bloodfix')?'bloodfix':
  process.argv.includes('--final')?'final':
  candidate?'candidate-'+candidateVersion:'current';
const width=process.argv.includes('--320')?320:390;
const height=width===320?568:844;
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(fs.existsSync);
if(!edge)throw Error('Microsoft Edge is required for the visual fixture');
const output=path.join(root,'hd2d-previews',
  (unitType==='iron_spearman'?'qa-vfx-iron-spear-':'qa-bloodline-'+unitType+'-')+
  label+(eventKind==='attack'?'':'-'+eventKind)+'-battle-'+width+'.png');
const candidatePng=path.join(root,'hd2d-previews',
  'qa-vfx-iron-spear-'+candidateVersion+'-runtime-candidate.png');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'iron-vfx-cdp-'));
const pending=new Map();
let browser,server,ws,seq=0;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP '+method+' timeout'));},20000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function main(){
  server=http.createServer((request,response)=>{
    let url;
    try{url=new URL(request.url,'http://localhost');}catch(_){response.writeHead(400).end();return;}
    const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
    let file=path.resolve(root,relative);
    if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
    if(candidate&&relative==='assets/art/vfx/units/iron_spearman.png')file=candidatePng;
    const extension=path.extname(file),mime={'.html':'text/html','.js':'text/javascript',
      '.css':'text/css','.json':'application/json','.png':'image/png','.glb':'model/gltf-binary'}[extension];
    fs.readFile(file,(error,bytes)=>{
      if(error){response.writeHead(404).end();return;}
      response.writeHead(200,{'Content-Type':mime||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/index.html`;
  const port=28500+Math.floor(Math.random()*1000);
  browser=spawn(edge,['--headless=new','--no-first-run','--disable-extensions','--no-sandbox',
    '--disable-background-networking','--enable-unsafe-swiftshader',
    '--remote-debugging-port='+port,'--user-data-dir='+profile,url],
  {stdio:'ignore',windowsHide:true});
  let pages;
  for(let attempt=0;attempt<50;attempt++){
    await sleep(300);
    try{pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json();
      if(pages.some(page=>page.type==='page'))break;}catch(_){}
  }
  const page=pages?.find(item=>item.type==='page'&&item.url===url)||
    pages?.find(item=>item.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('No CDP page');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data),item=pending.get(data.id);
    if(!item)return;
    pending.delete(data.id);clearTimeout(item.timer);
    data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',
    {width,height,deviceScaleFactor:1,mobile:true});
  for(let attempt=0;attempt<80;attempt++){
    if(await evaluate("document.readyState==='complete'&&typeof updateUI==='function'&&typeof HD2D==='object'"))break;
    await sleep(100);
  }
  const setup=await evaluate(`(()=>{
    const row=CFG.units[${JSON.stringify(unitType)}].row;
    S.formation={front:[],mid:[],back:[]};
    S.formation[row].push({type:${JSON.stringify(unitType)},count:12,id:92001});
    S.selEnemy=0;CFG.battleStepDelay=60000;S.battleSpeed=1;openBattle();
    const make=(type,id)=>({type,row:CFG.units[type].row,id,count:12,hp:120,maxHp:120,icon:CFG.units[type].icon});
    const epoch=battleEpoch+92000;
    HD2D.disposeBattle();
    const mounted=HD2D.mountBattle(document.getElementById('battle-scene'),{
      epoch,round:0,speed:1,stage:'iron-vfx-qa',allies:[make(${JSON.stringify(unitType)},92001)],
      enemies:[make('wild_boar',92002)]},{});
    document.getElementById('battle-screen').classList.toggle('hd2d-active',mounted);
    return {mounted,epoch,active:document.getElementById('battle-screen').classList.contains('active')};
  })()`);
  if(!setup.mounted||!setup.active)throw Error('Battle fixture failed: '+JSON.stringify(setup));
  for(let attempt=0;attempt<60;attempt++){
    const ready=await evaluate("HD2D.status().battle.layout.every(unit=>unit.portraitReady)");
    if(ready)break;await sleep(30);
  }
  const framing=await evaluate(`(()=>{
    const stage=document.getElementById('battle-scene'),height=stage.clientHeight;
    const sprites=HD2D.status().battle.layout.map(unit=>unit.spriteRect);
    const top=Math.min(...sprites.map(rect=>rect.top));
    const bottom=height-Math.max(...sprites.map(rect=>rect.bottom));
    return {height,top,bottom,difference:Math.abs(top-bottom),
      inside:sprites.every(rect=>rect.left>=-1&&rect.right<=stage.clientWidth+1&&
        rect.top>=-1&&rect.bottom<=height+1)};
  })()`);
  if(process.argv.includes('--assert-solo-balance')&&
    (!framing.inside||framing.top<12||framing.bottom<12||
      framing.difference>framing.height*0.16))
    throw Error('Solo duel framing is unbalanced: '+JSON.stringify(framing));
  const fired=await evaluate(`HD2D.playBattle({epoch:${setup.epoch},type:${JSON.stringify(eventKind)},
    sourceId:92001,targetId:92002,sourceSide:'allies',targetSide:'enemies',
    durationMs:${eventKind==='attack'?1400:850}})`);
  if(!fired)throw Error(eventKind+' event rejected');
  await sleep(eventKind==='attack'?620:280);
  const effect=await evaluate(`HD2D.status().battle.effectDetails.find(item=>
    item.type===${JSON.stringify(eventKind)}&&item.unitType===${JSON.stringify(unitType)})`);
  if(!effect?.visible||!effect.assetReady)throw Error('VFX invisible: '+JSON.stringify(effect));
  const heroLine=await evaluate(`(async()=>{
    const unit=HD2D.status().battle.layout.find(item=>item.id===92001);
    const image=new Image();image.src='./assets/art/units/hires/'+${JSON.stringify(unitType)}+'.png';
    await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d');context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;
    let helmetY=canvas.height;
    for(let y=0;y<canvas.height&&helmetY===canvas.height;y++)
      for(let x=Math.floor(canvas.width*.28);x<Math.ceil(canvas.width*.59);x++)
        if(pixels[(y*canvas.width+x)*4+3]>=96){helmetY=y;break;}
    const top=unit.spriteRect.top+(unit.spriteRect.bottom-unit.spriteRect.top)*helmetY/canvas.height;
    const line=(unit.badgeRect.top+unit.badgeRect.bottom)/2;
    return {helmetPixelY:helmetY,helmetTop:top,lineY:line,gap:top-line,
      spriteRect:unit.spriteRect,badgeRect:unit.badgeRect};
  })()`);
  const capture=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(output,Buffer.from(capture.data,'base64'));
  console.log(JSON.stringify({unitType,eventKind,candidate,candidateVersion,width,
    output,setup,framing,effect,heroLine},null,2));
} 
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;}).finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser?.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
  if(server)await new Promise(resolve=>server.close(resolve));
  const resolvedProfile=path.resolve(profile),tempRoot=path.resolve(os.tmpdir());
  if(resolvedProfile.startsWith(tempRoot+path.sep)){
    for(let attempt=0;attempt<8;attempt++){
      try{fs.rmSync(resolvedProfile,{recursive:true,force:true});break;}
      catch(error){
        if(attempt===7)console.error('QA_PROFILE_CLEANUP_FAILED',error.message);
        else await sleep(500);
      }
    }
  }
});
