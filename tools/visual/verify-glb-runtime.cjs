'use strict';
// Exercise hd2d.js's real static GLB parser in Edge/WebGL without replacing
// any shipped asset. Only the town_hall.glb HTTP response is substituted.
const {spawn,spawnSync}=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const candidates=process.argv.slice(2).length?process.argv.slice(2):
  fs.readdirSync(path.join(root,'assets/art/models/candidates'))
    .filter(name=>name.endsWith('.glb')).map(name=>path.join(root,'assets/art/models/candidates',name));
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(fs.existsSync);
if(!edge){console.error('NO_BROWSER: Microsoft Edge is unavailable');process.exit(2);}
const source=candidates.map(file=>({path:path.resolve(file),bytes:fs.readFileSync(file)}));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml',
  '.json':'application/json; charset=utf-8','.glb':'model/gltf-binary'};
let chosen=source[0],served=0,browser,ws,nextId=0;
const pending=new Map(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profileRoot=path.resolve(__dirname,'.edge-temp');
fs.mkdirSync(profileRoot,{recursive:true});
const profile=fs.mkdtempSync(path.join(profileRoot,'glb-runtime-'));
const server=http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}
  catch(_){res.writeHead(400).end();return;}
  if(pathname==='/assets/art/models/town_hall.glb'){
    served++;res.writeHead(200,{'Content-Type':'model/gltf-binary','Cache-Control':'no-store'});
    res.end(chosen.bytes);return;
  }
  if(pathname.startsWith('/assets/art/models/')&&pathname.endsWith('.glb')){
    res.writeHead(404).end();return;
  }
  const file=path.resolve(root,pathname.replace(/^\/+/, '')||'index.html');
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store'});res.end(data);
  });
});
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},15000);
    pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression){
  const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(response.exceptionDetails)
    throw Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);
  return response.result.value;
}
async function until(fn,tries=60){
  for(let i=0;i<tries;i++){
    try{const value=await fn();if(value)return value;}catch(_){}
    await sleep(150);
  }
  return null;
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const pageUrl=`http://127.0.0.1:${server.address().port}/index.html`;
  const cdpPort=27500+Math.floor(Math.random()*900);
  browser=spawn(edge,['--headless=new','--no-first-run','--disable-extensions',
    '--no-sandbox','--disable-background-networking','--disable-component-update',
    '--disable-sync','--enable-unsafe-swiftshader','--remote-debugging-port='+cdpPort,
    '--user-data-dir='+profile,pageUrl],{stdio:'ignore',windowsHide:true,
      env:{...process.env,TEMP:profileRoot,TMP:profileRoot}});
  const targets=await until(async()=>{
    const pages=await(await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
    return pages.some(item=>item.type==='page')?pages:null;
  },50);
  const page=targets?.find(item=>item.type==='page'&&item.url===pageUrl)||
    targets?.find(item=>item.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{
    const data=JSON.parse(event.data),item=pending.get(data.id);
    if(!item)return;
    pending.delete(data.id);clearTimeout(item.timer);
    data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',
    {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.reload',{ignoreCache:true});
  if(!await until(()=>evaluate("document.readyState==='complete' && typeof HD2D==='object' && typeof townVisualSnapshot==='function'")))
    throw Error('Game did not load');
  const results=[];
  for(const candidate of source){
    chosen=candidate;const servedBefore=served;
    await evaluate(`(()=>{
      HD2D.disposeTown();
      return HD2D.mountTown(document.getElementById('town-scene'),townVisualSnapshot(),{});
    })()`);
    const status=await until(()=>evaluate(`(()=>{
      const t=HD2D.status().town;
      return t.mounted&&t.modelsLoaded===1&&t.artworkReady?t:null;
    })()`),35);
    const result={file:path.relative(root,candidate.path),bytes:candidate.bytes.length,
      actualParserLoaded:!!status,served:served>servedBefore,
      townStatus:status||await evaluate('HD2D.status().town')};
    results.push(result);console.log(JSON.stringify(result));
  }
  const passes=results.filter(result=>result.actualParserLoaded&&result.served).length;
  console.log(`${passes}/${results.length} loaded through hd2d.js in real Edge WebGL`);
  if(passes!==results.length)process.exitCode=1;
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;}).finally(async()=>{
  try{ws?.close();}catch(_){}
  if(browser?.pid)spawnSync('taskkill',['/PID',String(browser.pid),'/T','/F'],
    {windowsHide:true,stdio:'ignore'});
  await new Promise(resolve=>server.close(resolve));
  await sleep(300);
  // Only delete this script's own verified temp profile.
  try{
    if(path.resolve(profile).startsWith(profileRoot+path.sep))
      fs.rmSync(profile,{recursive:true,force:true,maxRetries:8,retryDelay:250});
  }catch(error){console.error('PROFILE_CLEANUP_FAILED '+error.message);}
  process.exit(process.exitCode||0);
});
