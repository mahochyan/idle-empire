'use strict';
// P217: real Edge/CDP replay of P215 fixed-flow L29 losses from a paid P201 save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {spawn,spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourcePath=path.join(root,'docs/codex/reports/data/p201-live-cavalry-third-chapter.json');
const outputPath=path.join(root,'docs/codex/reports/data/p217-live-l29-browser-fail.json');
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
const reference=JSON.parse(fs.readFileSync(path.join(root,
  'docs/codex/reports/data/p215-live-l29-order-sweep.json'),'utf8'));
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const inputFiles=['index.html','config.js','levels.js','sprites.js','math.js',
  'garrison.js','technology.js','ui.js','hd2d.js','visual.css',
  'assets/hd2d/three.min.js','assets/art/vfx/unit-vfx-profiles.js',
  'docs/codex/reports/data/p201-live-cavalry-third-chapter.json',
  'docs/codex/reports/data/p215-live-l29-order-sweep.json',
  'tests/progression/harness.js','tests/progression/combat_order.js',
  'tools/verify/probe-live-l29-browser-fail-p217.js'];
const inputs=inputFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
assert.equal(source.batch,'P201');
assert.equal(reference.batch,'P215');
const cases=[8,9].map(flow=>{
  const profile=source.profiles.find(x=>x.seed===1&&x.route==='t2SecondBack73');
  const stage=profile?.stages.find(x=>x.stage===29);
  assert.ok(stage?.l29PreparedSave);
  assert.equal(sha(stage.l29PreparedSave),stage.beforeSaveSha256);
  const expected=reference.trials.find(x=>x.sourceSeed===1&&x.flow===flow&&
    x.plan==='frontReverse');
  assert.ok(expected?.battle);
  return {flow,sourceSave:stage.l29PreparedSave,
    sourceSha256:stage.beforeSaveSha256,enemy:stage.enemy.config,expected};
});
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(file=>fs.existsSync(file));
if(!edge){console.error('NO_BROWSER: Microsoft Edge not installed');process.exit(2);}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
const missing=new Set();
const server=http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}
  catch(_){res.writeHead(400).end();return}
  const relative=pathname.replace(/^\/+/, '')||'index.html';
  const file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(error,data)=>{
    if(error){if(pathname!=='/favicon.ico')missing.add(pathname);
      res.writeHead(404).end();return}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream',
      'Cache-Control':'no-store'});res.end(data);
  });
});
const tempRoot=fs.realpathSync(os.tmpdir());
const profile=fs.mkdtempSync(path.join(tempRoot,'p217-edge-'));
const resolvedProfile=path.resolve(profile);
assert.ok(resolvedProfile.startsWith(tempRoot+path.sep));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const exceptions=[],consoleErrors=[];
const pending=new Map();
let browser,ws,nextId=0,spawnError;
function send(method,params={}){
  return new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT '+method))},15000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
}
async function evalJs(expression){
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)
    throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(){
  for(let i=0;i<100;i++){
    try{if(await evalJs(`document.readyState==='complete'&&
      Array.isArray(window.APP_SCRIPTS)&&typeof loadSaveAndApply==='function'&&
      typeof HD2D==='object'&&typeof openBattle==='function'`))return true}
    catch(_){}
    await sleep(100);
  }
  return false;
}
async function navigate(url){
  await send('Page.navigate',{url});
  assert.equal(await ready(),true,'real page did not finish loading');
  assert.equal(await evalJs('window.__p217TickSuppressed===true'),true,
    'background tick was not suppressed in isolated browser');
  await evalJs('window.__p217RestoreClock()');
}
async function importAndReload(save,pageUrl){
  await evalJs(`localStorage.setItem('rts_save',${JSON.stringify(save)});true`);
  await navigate(pageUrl);
  const loaded=await evalJs(`(()=>({tick:S.tick,defeated:S.defeated.at(-1),
    owned:Object.fromEntries(['bronze_guard','cavalry_wind','infantry_t1','archer_t1']
      .map(k=>[k,(S.pool[k]||0)+expeditionCount(k)+garrisonCount(k)])),
    res:{...S.res},protected:saveProtected()}))()`);
  assert.equal(loaded.defeated,28);
  assert.equal(loaded.protected,false);
  assert.deepEqual(loaded.owned,{bronze_guard:15,cavalry_wind:15,
    infantry_t1:15,archer_t1:28});
  return loaded;
}
async function prepareFormation(item,pageUrl){
  const loaded=await importAndReload(item.sourceSave,pageUrl);
  const sourceData=JSON.parse(item.sourceSave);
  assert.equal(loaded.tick,sourceData.tick,'source load tick changed');
  assert.deepEqual(loaded.res,sourceData.res,'source load resources changed');
  const formed=await evalJs(`(()=>{
    document.querySelector('#navbar .nav-btn[data-page="fight"]').click();
    const before={res:JSON.stringify(S.res),queue:JSON.stringify(S.queue),
      army:armyCount()};
    clrForm('expedition');
    const placements=[['front','infantry_t1',15],['front','cavalry_wind',15],
      ['front','bronze_guard',15],['back','archer_t1',13],['back','archer_t1',15]];
    const indices={front:0,mid:0,back:0};
    for(const [row,type,count] of placements){
      const index=indices[row]++;
      if(index>=rowSlots(row)||poolAvail(type)<count)throw Error('formation gate '+type);
      openFormModal('expedition',row,index);
      const option=document.querySelector('#form-modal-content .modal-unit[data-type="'+type+'"]');
      if(!option)throw Error('unit not offered '+type);
      option.click();
      const qty=document.getElementById('modal-qty-input');
      qty.value=String(count);qty.dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('#modal-qty-area button[onclick="confirmForm()"]').click();
      const actual=S.formation[row][index];
      if(actual?.type!==type||actual.count!==count)throw Error('formation failed '+type);
    }
    if(armyCount()!==before.army||JSON.stringify(S.res)!==before.res||
      JSON.stringify(S.queue)!==before.queue)throw Error('formation changed inventory');
    if(!save().ok)throw Error('formation save failed');
    return {formation:S.formation,army:armyCount(),res:{...S.res},
      page:S.page,save:localStorage.getItem('rts_save')};
  })()`);
  assert.equal(formed.army,73);
  assert.equal(formed.page,'fight');
  const currentEnemy=await evalJs(`(()=>{const e=CFG.enemies[28];return{
    id:e.id,name:e.name,units:e.units,boss:!!e.boss,
    bossMult:e.bossMult||null,reward:e.reward}})()`);
  assert.deepEqual(currentEnemy,item.enemy);
  return {loaded,preparedSave:formed.save,preparedSha256:sha(formed.save),
    formation:formed.formation};
}
async function runBattle(item,prepared,mode,pageUrl){
  const loaded=await importAndReload(prepared.preparedSave,pageUrl);
  const before=await evalJs(`(()=>{
    document.querySelector('#navbar .nav-btn[data-page="fight"]').click();
    document.querySelector('#battle-speed .btn-speed[data-spd="4"]').click();
    window.__p217BeforeRes={...S.res};
    window.__p217BeforeMerit=S.merit;
    return {res:{...S.res},merit:S.merit,defeated:[...S.defeated],
      tick:S.tick,formation:JSON.parse(JSON.stringify(S.formation)),
      speed:S.battleSpeed,appScripts:[...APP_SCRIPTS],
      townMounted:HD2D.status().town.mounted,
      userAgent:navigator.userAgent};
  })()`);
  assert.equal(before.speed,4);
  assert.equal(before.tick,loaded.tick);
  const exceptionStart=exceptions.length,consoleStart=consoleErrors.length;
  const started=await evalJs(`(()=>{
    ${mode==='fallback'?'window.__p217OriginalMount=HD2D.mountBattle;HD2D.mountBattle=()=>false;':''}
    let seed=(${item.flow}*1009+29*9176)>>>0,calls=0;
    const trace=[],byCaller={};
    Math.random=()=>{
      calls++;let x=seed;x^=x<<13;x^=x>>>17;x^=x<<5;
      seed=x>>>0;
      const value=seed/4294967296;
      const frame=(new Error().stack||'').split('\\n')[2]||'';
      const match=frame.match(/([A-Za-z0-9_-]+\\.js)(?:\\?[^:]*)?:(\\d+):(\\d+)/);
      const caller=match?match[1]+':'+match[2]+':'+match[3]:frame.trim();
      byCaller[caller]=(byCaller[caller]||0)+1;
      if(trace.length<32)trace.push({index:calls,value,caller,round:B?.round||0,
        tick:S.tick});
      return value;
    };
    window.__p217RngAudit=()=>({seedInitial:(${item.flow}*1009+29*9176)>>>0,
      calls,first32:trace,byCaller});
    selEnemy(28);openBattle();
    return {active:S.battleActive,epoch:battleEpoch,tick:S.tick,rngAtOpen:calls,
      mounted:HD2D.status().battle.mounted,
      activeClass:document.getElementById('battle-screen').classList.contains('hd2d-active'),
      canvas:!!document.querySelector('#battle-scene canvas'),
      tactical:B.tactic.name,our:B.ourUnits.map(u=>({type:u.type,row:u.row,
      count:u.initialCount,hp:u.hp,atk:u.atk,def:u.def,spd:u.spd,
      tag:u.tag||null})),
      enemy:B.enemyUnits.map(u=>({type:u.type,row:u.row,
        count:u.initialCount,hp:u.hp,atk:u.atk,def:u.def,spd:u.spd,
        tag:u.tag||null}))};
  })()`);
  assert.equal(started.active,true);
  assert.equal(started.tactical,'稳扎稳打');
  if(mode==='hd2d')assert.equal(started.mounted&&started.activeClass&&started.canvas,true,
    'HD2D did not mount in real Edge');
  else assert.equal(started.mounted||started.activeClass,false,
    'forced visual fallback did not occur');
  let settled=false;
  for(let attempt=0;attempt<450;attempt++){
    await sleep(100);
    settled=await evalJs('B.settled===true&&S.battleActive===false');
    if(settled)break;
  }
  assert.equal(settled,true,`L29 ${item.flow}/${mode} did not settle`);
  const outcome=await evalJs(`(()=>{
    const raw=localStorage.getItem('rts_save');
    const normalized=JSON.parse(raw);delete normalized.ts;
    const rewards={};for(const key of Object.keys(S.res)){
      const delta=S.res[key]-(window.__p217BeforeRes[key]||0);
      if(delta)rewards[key]=delta;
    }
    return {won:S.defeated.includes(29),round:B.round,
      losses:73-armyCount(),remainingEnemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0),
      rewards,meritGain:S.merit-window.__p217BeforeMerit,
      rng:window.__p217RngAudit(),tick:S.tick,
      saveRaw:raw,saveNormalized:JSON.stringify(normalized),
      resultClass:document.getElementById('battle-result').className,
      canvasAtEnd:!!document.querySelector('#battle-scene canvas'),
      hd2dStatus:HD2D.status().battle,
      firstRoundLog:(()=>{const msgs=B.msgs.map(x=>x.m);
        const end=msgs.findIndex(x=>x.includes('回合1结束'));
        return msgs.slice(0,end<0?msgs.length:end)})()};
  })()`);
  const normalizedHash=sha(outcome.saveNormalized);
  const rawHash=sha(outcome.saveRaw);
  assert.equal(outcome.rng.first32.length,32);
  const errors={uncaught:exceptions.slice(exceptionStart),
    console:consoleErrors.slice(consoleStart)};
  await evalJs(`(()=>{
    ${mode==='fallback'?'HD2D.mountBattle=window.__p217OriginalMount;':''}
    return true})()`);
  return {flow:item.flow,mode,loaded,before,started,
    outcome:{...outcome,saveRawSha256:rawHash,
      saveNormalizedSha256:normalizedHash},errors};
}
function runVmCrosscheck(item,prepared){
  const originalRandom=Math.random;
  try{
    const world=environment({rts_save:prepared.preparedSave});
    const run=world.run;
    assert.equal(run('loadSaveAndApply().status'),'ok');
    const before=JSON.parse(JSON.stringify(run(`({res:{...S.res},merit:S.merit,
      tick:S.tick,formation:JSON.parse(JSON.stringify(S.formation))})`)));
    run(`globalThis.__p217VmTimers=new Map();globalThis.__p217VmTimerId=1;
      globalThis.setTimeout=fn=>{const id=__p217VmTimerId++;
        __p217VmTimers.set(id,fn);return id};
      globalThis.clearTimeout=id=>__p217VmTimers.delete(id);
      globalThis.__p217VmStep=()=>{const next=__p217VmTimers.entries().next().value;
        if(!next)return false;__p217VmTimers.delete(next[0]);next[1]();return true};
      globalThis.__p217VmNodes=new Map();document.getElementById=id=>{
        if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
        if(!__p217VmNodes.has(id))__p217VmNodes.set(id,{style:{},innerHTML:'',
          textContent:'',scrollHeight:0,scrollTop:0,classList:{add(){},remove(){},
          toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
        return __p217VmNodes.get(id)};
      globalThis.addLog=m=>S.log.push(String(m));`);
    run(`globalThis.__p217VmSeed=(${item.flow}*1009+29*9176)>>>0;
      globalThis.__p217VmCalls=0;globalThis.__p217VmTrace=[];
      globalThis.__p217VmByCaller={};
      Math.random=()=>{
        __p217VmCalls++;
        let x=__p217VmSeed;x^=x<<13;x^=x>>>17;x^=x<<5;
        __p217VmSeed=x>>>0;const value=__p217VmSeed/4294967296;
        const frame=(new Error().stack||'').split('\\n')[2]||'';
        const match=frame.match(/([A-Za-z0-9_-]+\\.js)(?:\\?[^:]*)?:(\\d+):(\\d+)/);
        const caller=match?match[1]+':'+match[2]+':'+match[3]:frame.trim();
        __p217VmByCaller[caller]=(__p217VmByCaller[caller]||0)+1;
        if(__p217VmTrace.length<32)__p217VmTrace.push({index:__p217VmCalls,
          value,caller,round:B?.round||0,tick:S.tick});
        return value;
      };`);
    run('selEnemy(28);openBattle()');
    assert.equal(run('S.battleActive'),true);
    const started=JSON.parse(JSON.stringify(run(`({tick:S.tick,
      rngAtOpen:__p217VmCalls,tactical:B.tactic.name,
      our:B.ourUnits.map(u=>({type:u.type,row:u.row,count:u.initialCount,
        hp:u.hp,atk:u.atk,def:u.def,spd:u.spd,tag:u.tag||null})),
      enemy:B.enemyUnits.map(u=>({type:u.type,row:u.row,count:u.initialCount,
        hp:u.hp,atk:u.atk,def:u.def,spd:u.spd,tag:u.tag||null}))})`)));
    let callbacks=0;
    while(run('S.battleActive')&&callbacks<1000){
      assert.equal(run('__p217VmStep()'),true);callbacks++;
    }
    assert.equal(run('S.battleActive'),false);
    const outcome=JSON.parse(JSON.stringify(run(`({won:S.defeated.includes(29),
      round:B.round,losses:73-armyCount(),tick:S.tick,
      remainingEnemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp||0),0),
      res:{...S.res},merit:S.merit,
      rng:{calls:__p217VmCalls,first32:__p217VmTrace,byCaller:__p217VmByCaller},
      firstRoundLog:(()=>{const msgs=B.msgs.map(x=>x.m);
        const end=msgs.findIndex(x=>x.includes('回合1结束'));
        return msgs.slice(0,end<0?msgs.length:end)})()})`)));
    const raw=world.store.get('rts_save');
    assert.equal(typeof raw,'string');
    const normalized=JSON.parse(raw);delete normalized.ts;
    outcome.rewards=Object.fromEntries(Object.keys(outcome.res)
      .map(key=>[key,outcome.res[key]-(before.res[key]||0)])
      .filter(([,delta])=>delta));
    outcome.meritGain=outcome.merit-before.merit;
    outcome.saveRaw=raw;outcome.saveRawSha256=sha(raw);
    outcome.saveNormalized=JSON.stringify(normalized);
    outcome.saveNormalizedSha256=sha(outcome.saveNormalized);
    return {flow:item.flow,callbacks,before,started,outcome};
  }finally{Math.random=originalRandom}
}
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const pageUrl=`http://127.0.0.1:${server.address().port}/index.html`;
  const cdpPort=26500+Math.floor(Math.random()*1000);
  browser=spawn(edge,['--headless=new','--no-first-run','--disable-extensions',
    '--no-sandbox','--disable-background-networking','--disable-component-update',
    '--disable-sync','--enable-unsafe-swiftshader',
    '--remote-debugging-port='+cdpPort,'--user-data-dir='+profile,'about:blank'],
    {stdio:'ignore',windowsHide:true});
  browser.on('error',error=>{spawnError=error});
  let targets;
  for(let i=0;i<40;i++){
    await sleep(500);
    if(spawnError)throw spawnError;
    try{targets=await(await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
      if(targets.some(target=>target.type==='page'))break}
    catch(_){}
  }
  const page=targets?.find(target=>target.type==='page');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=message=>{
    const data=JSON.parse(message.data);
    if(data.id&&pending.has(data.id)){
      const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);
      data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result);
    }
    if(data.method==='Runtime.exceptionThrown')
      exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text);
    if(data.method==='Runtime.consoleAPICalled'&&data.params.type==='error')
      consoleErrors.push((data.params.args||[]).map(x=>x.value??x.description).join(' '));
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{
    const actualNow=Date.now;
    try{const raw=localStorage.getItem('rts_save');
      if(raw){const stamp=JSON.parse(raw).ts;
        if(Number.isFinite(stamp))Date.now=()=>stamp}}
    catch(_){}
    window.__p217RestoreClock=()=>{Date.now=actualNow};
    const actualInterval=window.setInterval;
    window.setInterval=(fn,delay,...args)=>{
      if(fn?.name==='tick'){window.__p217TickSuppressed=true;return 2147483000}
      return actualInterval(fn,delay,...args)};
  })()`});
  await navigate(pageUrl);
  assert.equal(await evalJs("APP_SCRIPTS.join(',')"),
    'config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js');
  const runs=[];
  for(const item of cases){
    const prepared=await prepareFormation(item,pageUrl);
    const pair=[];
    for(const mode of ['hd2d','fallback']){
      // The baseline is identical on both page reloads; no direct S changes.
      const run=await runBattle(item,prepared,mode,pageUrl);
      pair.push(run);
    }
    assert.deepEqual(pair[0].started.our,pair[1].started.our);
    assert.deepEqual(pair[0].started.enemy,pair[1].started.enemy);
    const a=pair[0].outcome,b=pair[1].outcome;
    assert.deepEqual({won:a.won,round:a.round,losses:a.losses,
      remainingEnemyHp:a.remainingEnemyHp,rewards:a.rewards,
      meritGain:a.meritGain,rng:a.rng,tick:a.tick,
      save:a.saveNormalized},
      {won:b.won,round:b.round,losses:b.losses,
        remainingEnemyHp:b.remainingEnemyHp,rewards:b.rewards,
        meritGain:b.meritGain,rng:b.rng,tick:b.tick,
        save:b.saveNormalized},`flow ${item.flow}: HD2D changed battle result`);
    assert.equal(pair[0].errors.uncaught.length+pair[1].errors.uncaught.length+
      pair[0].errors.console.length+pair[1].errors.console.length,0);
    const vmCrosscheck=runVmCrosscheck(item,prepared);
    assert.deepEqual(vmCrosscheck.started.our,pair[0].started.our);
    assert.deepEqual(vmCrosscheck.started.enemy,pair[0].started.enemy);
    assert.equal(vmCrosscheck.started.rngAtOpen,0);
    const vmOutcome=vmCrosscheck.outcome;
    const crossParity={
      initial:vmCrosscheck.started.tick===pair[0].started.tick&&
        vmCrosscheck.started.tactical===pair[0].started.tactical,
      rngCalls:vmOutcome.rng.calls===a.rng.calls,
      rngFirst32:JSON.stringify(vmOutcome.rng.first32)===JSON.stringify(a.rng.first32),
      rngCallSites:JSON.stringify(vmOutcome.rng.byCaller)===JSON.stringify(a.rng.byCaller),
      firstRoundLog:JSON.stringify(vmOutcome.firstRoundLog)===JSON.stringify(a.firstRoundLog),
      won:vmOutcome.won===a.won,round:vmOutcome.round===a.round,
      losses:vmOutcome.losses===a.losses,
      remainingEnemyHp:vmOutcome.remainingEnemyHp===a.remainingEnemyHp,
      rewards:JSON.stringify(vmOutcome.rewards)===JSON.stringify(a.rewards),
      meritGain:vmOutcome.meritGain===a.meritGain,
      tick:vmOutcome.tick===a.tick,
      saveNormalized:vmOutcome.saveNormalized===a.saveNormalized
    };
    const attackMessages=a.firstRoundLog.filter(x=>/^\[(我方|敌方)\]/.test(x));
    const p215Parity={won:a.won===item.expected.battle.won,
      round:a.round===item.expected.battle.round,
      losses:a.losses===item.expected.battle.lossTotal,
      remainingEnemyHp:a.remainingEnemyHp===item.expected.battle.opponent.remainingHp,
      rngCalls:a.rng.calls===item.expected.battle.rng.draws,
      firstRoundAttacks:JSON.stringify(attackMessages)===
        JSON.stringify(item.expected.battle.firstRound.attackMessages)};
    runs.push({flow:item.flow,sourceSha256:item.sourceSha256,
      prepared:{sha256:prepared.preparedSha256,save:prepared.preparedSave,
        formation:prepared.formation},pair,vmCrosscheck,crossParity,
      p215Reference:{sourceSeed:1,plan:'frontReverse',
        preparedSha256:item.expected.prepared.sha256,
        postSha256:item.expected.post.sha256,
        battle:item.expected.battle},p215Parity});
  }
  for(const item of inputs)
    assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,
      `${item.file} changed during browser run`);
  const head=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
  assert.equal(head.status,0);
  const artifact={batch:'P217',sourceHead:head.stdout.trim(),browser:{edge,profileKind:'isolated temporary Edge user-data-dir',
    headless:true,httpOrigin:true,webglFlag:'--enable-unsafe-swiftshader',
    userAgent:runs[0].pair[0].before.userAgent,nodeV8:process.versions.v8},
    scope:{sources:cases.map(({sourceSave,expected,...rest})=>rest),flows:[8,9],
      formation:'front infantry_t1 15, cavalry_wind 15, bronze_guard 15; back archer_t1 13+15',
      rng:'P201 xorshift32 (flow*1009+29*9176)>>>0',
      frozenSourceClockDuringLoad:true,backgroundTickSuppressed:true,
      speed:'real UI 4x button',fallback:'HD2D.mountBattle returns false only for fallback page',
      noResourceOrTroopInjection:true},runs,missing:[...missing],
    uncaught:exceptions,consoleErrors,inputs};
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,JSON.stringify(artifact,null,2)+'\n');
  console.log(JSON.stringify({batch:'P217',runs:runs.map(x=>({flow:x.flow,
    preparedSha256:x.prepared.sha256,
    pair:x.pair.map(y=>({mode:y.mode,mounted:y.started.mounted,
      activeClass:y.started.activeClass,rngAtOpen:y.started.rngAtOpen,
      rngCalls:y.outcome.rng.calls,won:y.outcome.won,
      round:y.outcome.round,losses:y.outcome.losses,rewards:y.outcome.rewards,
      meritGain:y.outcome.meritGain,remainingEnemyHp:y.outcome.remainingEnemyHp,
      saveNormalizedSha256:y.outcome.saveNormalizedSha256,
      exceptions:y.errors.uncaught.length,consoleErrors:y.errors.console.length})),
      p215Parity:x.p215Parity})),
    crossParity:runs.map(x=>({flow:x.flow,...x.crossParity})),
    missing:[...missing].slice(0,12),uncaught:exceptions.length,
    consoleErrors:consoleErrors.length,output:outputPath},null,2));
  for(const run of runs){
    const bad=Object.entries(run.crossParity).filter(([,ok])=>!ok);
    assert.deepEqual(bad,[],`flow ${run.flow}: Edge/Node combat divergence`);
    const referenceBad=Object.entries(run.p215Parity).filter(([,ok])=>!ok);
    assert.deepEqual(referenceBad,[],`flow ${run.flow}: P215 fixed-flow divergence`);
  }
  assert.deepEqual([...missing],[],'page asset request failed');
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1})
  .finally(async()=>{
    for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('CDP_CLOSED'))}
    pending.clear();
    try{ws?.close()}catch(_){}
    if(browser?.pid){
      spawnSync('taskkill',['/T','/F','/PID',String(browser.pid)],
        {stdio:'ignore',windowsHide:true});
    }
    await new Promise(resolve=>server.close(resolve));
    if(path.resolve(profile).startsWith(tempRoot+path.sep)){
      let removed=false,lastError;
      for(let i=0;i<10&&!removed;i++){
        try{fs.rmSync(profile,{recursive:true,force:true});removed=true}
        catch(error){lastError=error;await sleep(500)}
      }
      if(!removed)console.error('TEMP_PROFILE_CLEANUP_FAILED',lastError?.message);
    }
  });
