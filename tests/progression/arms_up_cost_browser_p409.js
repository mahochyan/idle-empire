'use strict';
// Real isolated Edge UI/price/payment/reload checks. Stars, stocks and existing
// soldiers are explicit synthetic fixtures; this never proves natural progress.
// Only the game's periodic tick is paused to keep historical over-cap stocks
// stable. Actual script loading, DOM handlers, actions and storage remain real.
const {spawn,spawnSync,execFileSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const outputName='p409-arms-up-cost-browser-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
const output=path.join(root,'docs/codex/reports/data',outputName);
const checks=[],cases=[],exceptions=[],pending=new Map(),cleanup={};
const runtimeFiles=['config.js','math.js','ui.js','index.html'];
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hashes=()=>Object.fromEntries(runtimeFiles.map(rel=>[rel,digest(fs.readFileSync(path.join(root,rel)))]));
const baseline={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),hashes:hashes()};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser,profile,tempRoot,ws,id=0,spawnError,exited=false,fatal;
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});if(!ok)console.error('FAIL '+name+' '+JSON.stringify(detail))}
function send(method,params={},timeout=15000){return new Promise((resolve,reject)=>{
  if(ws?.readyState!==WebSocket.OPEN)return reject(Error('CDP_NOT_OPEN '+method));
  const token=++id,timer=setTimeout(()=>{pending.delete(token);reject(Error('CDP_TIMEOUT '+method))},timeout);
  pending.set(token,{resolve,reject,timer});ws.send(JSON.stringify({id:token,method,params}));
})}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
  return result.result.value;
}
async function ready(marker){for(let i=0;i<80;i++){
  try{if(await evaluate(`document.readyState==='complete'&&typeof armsUpCost==='function'&&typeof investArmsUp==='function'&&typeof updateUI==='function'${marker?'&&window.__armsP409Reload===undefined':''}`))return true}catch(_){}
  await sleep(100);
}return false}
async function viewArms(){
  await evaluate(`(()=>{document.querySelector('.nav-btn[data-page="tech"]')?.click();
    const graph=document.getElementById('tech-full');if(!graph)return false;
    if(!graph.open)graph.querySelector('summary').click();return true})()`);
  // Let the real details ontoggle callback finish before selecting its category.
  await sleep(35);
  return evaluate(`(()=>{document.querySelector('#tech-full .tech-tree-nav button[data-category="arms"]')?.click();
    const graph=document.getElementById('tech-full');return{open:!!graph?.open,
      category:graph?.querySelector('.tech-full')?.dataset.category,page:S.page}})()`);
}
async function row(stat){return evaluate(`(()=>{
  const single=[...document.querySelectorAll('#tech-full button[onclick]')]
    .find(b=>b.getAttribute('onclick')===\"investArmsUp('bronze_guard','${stat}')\");
  const r=single?.closest('.tech-detail-row');return{found:!!r,visible:!!single&&single.getClientRects().length>0,
    disabled:single?.disabled,cost:r?[...r.querySelectorAll('.tech-detail-cost')].map(e=>e.textContent).join(' · '):'',
    state:r?.querySelector('.tech-detail-state')?.textContent||'',
    buttons:r?[...r.querySelectorAll('button')].map(b=>({text:b.textContent,onclick:b.getAttribute('onclick'),disabled:b.disabled})):[],
    overflow:document.documentElement.scrollWidth>innerWidth+1,innerWidth}})()`)}
async function click(stat,times=1){return evaluate(`(()=>{
  const command=\"investArmsUp('bronze_guard','${stat}'${times===1?'':','+times})\";
  const b=[...document.querySelectorAll('#tech-full button[onclick]')].find(e=>e.getAttribute('onclick')===command);
  if(!b||b.disabled||!b.getClientRects().length)return false;b.click();return true})()`)}
async function state(stat){const data=await evaluate(`(()=>{const text=localStorage.getItem('rts_save'),raw=text?JSON.parse(text):null;
  return{rawText:text,state:{version:targetSaveVersion(),protected:saveProtected(),stock:S.res.copper,
    upgrade:{...S.armsUp.bronze_guard['${stat}']},allArms:S.armsUp.bronze_guard,
    quote:armsUpCost('bronze_guard','${stat}'),payableBatch:armsUpPayableBatch('bronze_guard','${stat}'),army:armyCount(),pool:S.pool,
    expedition:S.formation,garrison:S._garrisonForm},
    saved:raw&&{v:raw.v,stock:raw.res.copper,upgrade:raw.armsUp.bronze_guard['${stat}'],
      allArms:raw.armsUp.bronze_guard,pool:raw.pool,expedition:raw.formation,garrison:raw.garrisonForm}}})()`);
  const text=data.rawText;delete data.rawText;
  data.raw={sha256:text===null?null:digest(Buffer.from(text)),utf8Bytes:text===null?0:Buffer.byteLength(text)};
  return data;
}
const troops=s=>JSON.stringify({army:s.state.army,pool:s.state.pool,expedition:s.state.expedition,garrison:s.state.garrison});
function savedMatches(s){return s.saved?.v===36&&s.state.version===36&&s.saved.stock===s.state.stock&&
  JSON.stringify(s.saved.allArms)===JSON.stringify(s.state.allArms)&&
  JSON.stringify(s.saved.pool)===JSON.stringify(s.state.pool)&&
  JSON.stringify(s.saved.expedition)===JSON.stringify(s.state.expedition)&&
  JSON.stringify(s.saved.garrison)===JSON.stringify(s.state.garrison)}
async function fixture(stat,stars,progress,stock){
  const configured=await evaluate(`(()=>{
    S.sciences=['sci_bronze_age'];S.res.copper=${stock};
    for(const k of Object.keys(S.pool))S.pool[k]=0;S.pool.bronze_guard=7;
    S.formation={front:[{id:409,type:'bronze_guard',count:3}],mid:[],back:[]};
    S._garrisonForm={front:[{id:410,type:'bronze_guard',count:2}],mid:[],back:[]};
    S.armsUp.bronze_guard={atk:{stars:0,progress:0},hp:{stars:0,progress:0},def:{stars:0,progress:0}};
    S.armsUp.bronze_guard['${stat}']={stars:${stars},progress:${progress}};
    const saved=save();updateUI();return{saved,material:CFG.armsUp.bronze_guard.material,
      steps:CFG.armsUp.bronze_guard.stepsPerStar,baseNeed:CFG.armsUp.bronze_guard.stepCost}})()`);
  check(`${stat} ${stars}/${progress} controlled fixture saves v36`,configured.saved.ok&&configured.material==='copper'&&
    configured.steps===1000&&configured.baseNeed===1000,configured);
  const view=await viewArms();check('Actual tech disclosure and arms category opened',view.open&&view.category==='arms'&&view.page==='tech',view);
}
async function reloadCase(record,stat,width){
  await evaluate('window.__armsP409Reload=true');await send('Page.reload',{ignoreCache:true});
  check(`${width} ${stat} actual page reload`,await ready(true));await viewArms();
  record.reloaded=await state(stat);record.reloadedRow=await row(stat);
  check(`${width} ${stat} v36 persisted payment and soldier counts`,savedMatches(record.reloaded)&&
    record.reloaded.state.stock===record.after.state.stock&&
    JSON.stringify(record.reloaded.state.allArms)===JSON.stringify(record.after.state.allArms)&&
    troops(record.reloaded)===troops(record.before)&&record.reloaded.state.army===12&&!record.reloaded.state.protected,record.reloaded);
}
async function boundary(width,stat,stars,progress,cost,times,nextCost,stock){
  await fixture(stat,stars,progress,stock);
  const record={width,stat,fixture:{stars,progress,stock},expected:{cost,times,nextCost},before:await state(stat),beforeRow:await row(stat)};
  cases.push(record);
  const quote=await evaluate(`armsUpCost('bronze_guard','${stat}',${times})`);
  record.actionQuote=quote;
  check(`${width} ${stat} visible price before crossing`,record.beforeRow.found&&record.beforeRow.visible&&!record.beforeRow.disabled&&
    record.beforeRow.cost.includes('每次 铜 '+cost)&&record.before.state.quote.ok&&record.before.state.quote.cost===cost,record.beforeRow);
  if(times===2)check(`${width} ${stat} fill button quotes two real steps`,quote.ok&&quote.cost===20000&&
    record.beforeRow.cost.includes('补满本星 20000')&&record.beforeRow.buttons.some(b=>b.text==='补满本星'&&b.onclick==="investArmsUp('bronze_guard','atk',2)"&&!b.disabled),{quote,row:record.beforeRow});
  check(`${width} ${stat} real DOM payment click`,await click(stat,times));
  await viewArms();record.after=await state(stat);record.afterRow=await row(stat);
  const debit=record.before.state.stock-record.after.state.stock;
  check(`${width} ${stat} debited exactly once and crossed star`,quote.ok&&debit===quote.cost&&
    record.after.state.upgrade.stars===stars+1&&record.after.state.upgrade.progress===0&&savedMatches(record.after)&&
    troops(record.after)===troops(record.before),{before:record.before,after:record.after,quote,debit});
  check(`${width} ${stat} immediately shows new star price`,record.afterRow.visible&&record.afterRow.cost.includes('每次 铜 '+nextCost)&&
    record.after.state.quote.ok&&record.after.state.quote.cost===nextCost,record.afterRow);
  check(`${width} ${stat} no horizontal page overflow`,!record.beforeRow.overflow&&!record.afterRow.overflow,{before:record.beforeRow,after:record.afterRow});
  await reloadCase(record,stat,width);
}
async function shortage(width){
  await fixture('atk',9,998,9999);
  const record={width,stat:'atk',fixture:{stars:9,progress:998,stock:9999},kind:'shortage',before:await state('atk'),beforeRow:await row('atk')};cases.push(record);
  check(`${width} shortage displays current fee and disables real button`,record.beforeRow.visible&&record.beforeRow.disabled&&
    record.beforeRow.cost.includes('每次 铜 10000'),record.beforeRow);
  check(`${width} disabled DOM click rejected`,!await click('atk'));
  const action=await evaluate("investArmsUp('bronze_guard','atk')");record.rejectedAction=action;record.after=await state('atk');
  check(`${width} direct shortage gate leaves raw save and state unchanged`,!action.ok&&action.reason==='insufficient-resources'&&
    JSON.stringify(record.before)===JSON.stringify(record.after),{action,before:record.before,after:record.after});
}
async function largeDefault(width){
  await fixture('def',35,0,1e18);
  const record={width,stat:'def',kind:'source-default-large-cost',fixture:{stars:35,progress:0,stock:1e18},
    expected:{cost:1e18},before:await state('def'),beforeRow:await row('def')};cases.push(record);
  check(`${width} DEF35 source default 1e18 visible and enabled`,record.beforeRow.visible&&!record.beforeRow.disabled&&
    record.beforeRow.cost.includes('每次 铜 1000000000000000000')&&record.before.state.quote.ok&&record.before.state.quote.cost===1e18,record.beforeRow);
  check(`${width} DEF35 real DOM huge payment click`,await click('def'));
  await viewArms();record.after=await state('def');record.afterRow=await row('def');
  check(`${width} DEF35 actually debits 1e18 to legal zero`,record.after.state.stock===0&&
    record.before.state.stock-record.after.state.stock===1e18&&record.after.state.upgrade.stars===35&&
    record.after.state.upgrade.progress===1&&savedMatches(record.after)&&troops(record.before)===troops(record.after),record.after);
  check(`${width} DEF35 depleted resource disables next investment`,record.afterRow.visible&&record.afterRow.disabled&&!record.afterRow.overflow,record.afterRow);
  await reloadCase(record,'def',width);
}
async function historicalBatch(width){
  await fixture('atk',0,0,1e18);
  // Keep the first actual payment and reload as the second case's input.
  // Do not reset stock/progress between the within-star and crossing-star clicks.
  for(const step of [{times:992,cost:992000,stars:0,progress:992},{times:996,cost:1984000,stars:1,progress:988}]){
    const record={width,stat:'atk',kind:'historical-stock-payable-batch',expected:step,
      before:await state('atk'),beforeRow:await row('atk')};cases.push(record);
    record.actionQuote=await evaluate(`armsUpCost('bronze_guard','atk',${step.times})`);
    const command="investArmsUp('bronze_guard','atk',"+step.times+")";
    const crosses=step.times>1000-record.before.state.upgrade.progress;
    const label=(crosses?'跨星投入':'投入')+step.times+'次';
    check(`${width} historical stock single disabled but ${step.times}-step batch visible`,record.beforeRow.visible&&record.beforeRow.disabled&&
      record.beforeRow.cost.includes('每次 铜 1000')&&record.before.state.payableBatch===step.times&&
      record.beforeRow.buttons.some(b=>b.onclick===command&&b.text===label&&!b.disabled),record.beforeRow);
    check(`${width} historical stock ${step.times}-step total price and crossing text visible`,
      record.beforeRow.cost.includes('批量 '+step.times+' 次合计 铜 '+step.cost)&&
      (crosses?record.beforeRow.cost.includes('跨星分段计价'):!record.beforeRow.cost.includes('跨星分段计价')),record.beforeRow);
    check(`${width} historical stock ${step.times}-step exact quote`,record.actionQuote.ok&&record.actionQuote.cost===step.cost&&
      record.actionQuote.stars===step.stars&&record.actionQuote.progress===step.progress,record.actionQuote);
    check(`${width} historical stock disabled single DOM click rejected`,!await click('atk'));
    check(`${width} historical stock real ${step.times}-step batch click`,await click('atk',step.times));
    await viewArms();record.after=await state('atk');record.afterRow=await row('atk');
    const debit=record.before.state.stock-record.after.state.stock;
    check(`${width} historical stock batch debits ${step.cost} with correct progress`,debit===step.cost&&
      record.after.state.upgrade.stars===step.stars&&record.after.state.upgrade.progress===step.progress&&
      savedMatches(record.after)&&troops(record.after)===troops(record.before),{before:record.before,after:record.after,debit});
    check(`${width} historical stock batch no horizontal overflow`,!record.beforeRow.overflow&&!record.afterRow.overflow,record.afterRow);
    await reloadCase(record,'atk',width);
  }
}
async function main(){
  const edge=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(fs.existsSync);
  if(!edge)throw Error('NO_BROWSER: Microsoft Edge not installed');
  tempRoot=fs.realpathSync(os.tmpdir());profile=path.resolve(fs.mkdtempSync(path.join(tempRoot,'arms-cost-p409-')));
  if(!path.isAbsolute(profile)||!profile.startsWith(tempRoot+path.sep)||fs.realpathSync(profile)!==profile)throw Error('Unsafe temporary profile path');
  browser=spawn(edge,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--no-sandbox',
    '--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
  browser.on('error',error=>{spawnError=error});browser.on('exit',()=>{exited=true});
  let port;for(let i=0;i<60;i++){if(spawnError)throw spawnError;try{port=Number(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0]);if(port)break}catch(_){}await sleep(200)}
  if(!port)throw Error('NO_DEBUG_PORT');
  const targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json(),page=targets.find(t=>t.type==='page'&&t.url==='about:blank');
  if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CDP_CONNECT_TIMEOUT')),10000);ws.onopen=()=>{clearTimeout(timer);resolve()};ws.onerror=error=>{clearTimeout(timer);reject(error)}});
  ws.onmessage=event=>{const data=JSON.parse(event.data);if(data.id&&pending.has(data.id)){
    const item=pending.get(data.id);pending.delete(data.id);clearTimeout(item.timer);data.error?item.reject(Error(JSON.stringify(data.error))):item.resolve(data.result)}
    if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.exception?.description||data.params.exceptionDetails.text)};
  ws.onclose=()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('CDP_CLOSED'))}pending.clear()};
  await send('Runtime.enable');await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const native=window.setInterval.bind(window);window.setInterval=function(fn,delay,...args){if(typeof fn==='function'&&fn.name==='tick'){window.__armsP409TickPaused=true;return 0}return native(fn,delay,...args)}})()`});
  await send('Page.navigate',{url:pathToFileURL(path.join(root,'index.html')).href});
  check('Actual game and cost helper loaded',await ready());
  const names=await evaluate(`({scripts:window.APP_SCRIPTS.join(','),paused:window.__armsP409TickPaused,copper:resourceDisplayName('copper'),version:targetSaveVersion()})`);
  check('Runtime dependency order and explicitly paused tick',names.scripts==='config.js,levels.js,sprites.js,math.js,garrison.js,technology.js,ui.js'&&names.paused===true&&names.copper==='铜'&&names.version===36,names);
  for(const width of [320,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:800,deviceScaleFactor:1,mobile:true});
    await boundary(width,'atk',9,998,10000,2,110000,20000);
    await boundary(width,'hp',99,999,10000,1,101000,10000);
    await boundary(width,'def',4,999,100000,1,1200000,100000);
    await shortage(width);await largeDefault(width);await historicalBatch(width);
  }
  check('No uncaught browser exceptions',exceptions.length===0,exceptions);
  check('Shared runtime did not change during browser check',JSON.stringify(baseline.hashes)===JSON.stringify(hashes()),{before:baseline.hashes,after:hashes()});
}
function ownedProcesses(){
  if(!profile)return[];
  const quoted=profile.replace(/'/g,"''"),script="$p='"+quoted+"'; @(Get-CimInstance Win32_Process -Filter \"Name = 'msedge.exe'\" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($p) } | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress";
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:15000});
  if(result.error||result.status!==0)throw Error('Owned process inspection failed: '+(result.error?.message||result.stderr||result.status));
  const text=result.stdout.trim();return text?([].concat(JSON.parse(text))):[];
}
async function cleanupBrowser(){
  // Browser.close is always the first shutdown action. Only this unique profile's
  // verified process IDs may be force-stopped; never enumerate/kill user Edge.
  cleanup.profile=profile;cleanup.launchedPid=browser?.pid;
  if(ws?.readyState===WebSocket.OPEN){cleanup.browserCloseAttempted=true;try{await send('Browser.close',{},2000);cleanup.browserCloseAcknowledged=true}catch(error){cleanup.browserCloseResult=error.message}}
  else cleanup.browserCloseAttempted=false;
  try{ws?.close()}catch(_){}
  cleanup.taskkill=[];
  if(profile){
    // The launcher can exit before its renderer/GPU processes. Wait for every
    // process carrying this exact unique profile rather than the launcher alone.
    let owned=ownedProcesses();const graceEnd=Date.now()+8000;
    while(owned.length&&Date.now()<graceEnd){await sleep(250);owned=ownedProcesses()}
    cleanup.afterGrace=owned.map(p=>p.ProcessId);
    for(const process of owned){if(!ownedProcesses().some(p=>p.ProcessId===process.ProcessId))continue;
      const result=spawnSync('taskkill',['/PID',String(process.ProcessId),'/T','/F'],{encoding:'utf8',windowsHide:true,timeout:10000});
      let remaining=ownedProcesses();
      // taskkill can race the acknowledged Browser.close; only accept a failed
      // kill after independently confirming that this owned PID has exited.
      if(result.error||result.status!==0)for(let i=0;i<6&&remaining.some(p=>p.ProcessId===process.ProcessId);i++){
        await sleep(250);remaining=ownedProcesses();
      }
      cleanup.taskkill.push({pid:process.ProcessId,status:result.status,error:result.error?.message,stderr:result.stderr,remaining:remaining.map(p=>p.ProcessId)});
      if((result.error||result.status!==0)&&remaining.some(p=>p.ProcessId===process.ProcessId))throw Error('TASKKILL_FAILED '+process.ProcessId+' '+(result.error?.message||result.stderr||result.status));
    }
    cleanup.remaining=ownedProcesses().map(p=>p.ProcessId);
    if(cleanup.remaining.length)throw Error('Owned Edge processes still active');
    const absolute=path.resolve(profile),temporary=fs.realpathSync(tempRoot);
    if(!path.isAbsolute(absolute)||absolute!==profile||!absolute.startsWith(temporary+path.sep)||path.basename(absolute).indexOf('arms-cost-p409-')!==0)throw Error('PROFILE_CLEANUP_PATH_REJECTED');
    if(fs.existsSync(absolute)){
      if(fs.realpathSync(absolute)!==absolute)throw Error('PROFILE_CLEANUP_REPARSE_REJECTED');
      fs.rmSync(absolute,{recursive:true,force:true,maxRetries:3,retryDelay:100});
    }
    cleanup.removed=!fs.existsSync(absolute);check('Temporary profile removed after owned browser shutdown',cleanup.removed,cleanup);
  }
}
main().catch(error=>{fatal=error.stack||String(error);console.error('BROWSER_SMOKE_ERROR',fatal);process.exitCode=2}).finally(async()=>{
  try{await cleanupBrowser()}catch(error){cleanup.error=error.stack||String(error);check('Browser and profile cleanup completed',false,cleanup);if(!process.exitCode)process.exitCode=3}
  const result={createdAt:new Date().toISOString(),node:process.version,baseline,
    final:{head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),hashes:hashes()},
    method:'Real isolated Edge, actual tech navigation/details/category/buttons and page reload; synthetic stars/resources/existing 12 soldiers, periodic tick paused. Not natural acquisition or same-save progression.',
    fixtureScope:{widths:[320,390],unit:'bronze_guard',resource:'copper',stepsPerStar:1000,tickPaused:true,naturalProgress:false},
    cases,checks,exceptions,cleanup,fatal,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length};
  try{if(process.argv.includes('--stdout'))console.log('P409_REPORT_JSON:'+JSON.stringify(result));
    else{fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output:path.relative(root,output),passed:result.passed,failed:result.failed,fatal:!!fatal,cleanup:cleanup.removed}))}}
  catch(error){console.error('REPORT_WRITE_FAILED',error.message);console.log('P409_REPORT_JSON:'+JSON.stringify(result));if(!process.exitCode)process.exitCode=3}
  if(!process.exitCode)process.exitCode=result.failed?1:0;
  for(const item of pending.values())clearTimeout(item.timer);pending.clear();process.exit(process.exitCode);
});
