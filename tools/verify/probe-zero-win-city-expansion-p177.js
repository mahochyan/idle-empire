'use strict';
// P177: continue P158's exact zero-win saves through researched city housing.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p158Path='docs/codex/reports/data/p158-short-session-population-18-to-20.json';
const p164Path='docs/codex/reports/data/p164-zero-win-population-20-to-28.json';
const outputPath='docs/codex/reports/data/p177-zero-win-city-expansion.json';
const activeWindow=600,offlineWindow=28800;
const reserve={wood:100,stone:1000,food:1000};
function digest(file){return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')}
function checkInputs(data,label){
  for(const input of data.inputs||[])assert.equal(digest(input.file),input.sha256,`${label} source changed: ${input.file}`);
}
function snap(run){return JSON.parse(JSON.stringify(run(`({tick:S.tick,population:popCurrent(),capacity:maxPop(),
  allocated:popAllocTotal(),free:popFree(),growthClock:S.population.growthClock,
  workers:{...S.popAlloc},resources:{...S.res},settlements:{...S.settlements},
  sciences:[...S.sciences],battleWins:S.defeated.length})`)))}
const headCall=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'});
assert.equal(headCall.status,0,headCall.stderr||'HEAD unavailable');
const head=headCall.stdout.trim();
const p158=JSON.parse(fs.readFileSync(path.join(root,p158Path),'utf8'));
const p164=JSON.parse(fs.readFileSync(path.join(root,p164Path),'utf8'));
assert.equal(p158.sourceHead,head);
assert.equal(p164.sourceHead,head);
checkInputs(p158,'P158');checkInputs(p164,'P164');
assert.equal(p158.results.length,3);

function scenario(source){
  const oldNow=Date.now;
  let virtualNow=JSON.parse(source.finalStateSave).ts;
  assert.ok(Number.isFinite(virtualNow));
  Date.now=()=>virtualNow;
  try{
    const e=environment({rts_save:source.finalStateSave});
    const run=e.run;
    assert.equal(run('loadSaveAndApply().status'),'ok');
    const start=snap(run);
    assert.equal(start.population,20);assert.equal(start.capacity,20);
    assert.equal(start.battleWins,0);assert.equal(start.resources.deed,0);
    for(const [key,value] of Object.entries(source.final))
      assert.deepEqual(start[key],value,`${source.name}: P158 reload mismatch for ${key}`);
    assert.ok(start.sciences.includes('sci_iron'));
    assert.ok(!start.sciences.includes('sci_city'));
    assert.deepEqual(start.settlements,{village:6,smallTown:5,city:1});
    run(`(()=>{const g=globalThis;g.__p177minFood=S.res.food;
      const original=productionSecond;
      productionSecond=function(...args){const next=original(...args);
        if(Number.isFinite(next.food))g.__p177minFood=Math.min(g.__p177minFood,next.food);
        return next;};})()`);
    let minFood=start.resources.food,activeSeconds=0;
    let nextPause=activeWindow-(source.totalActiveOnlineSeconds%activeWindow);
    if(nextPause===0)nextPause=activeWindow;
    const windows=[],steps=[];
    function observe(){minFood=Math.min(minFood,run('S.res.food'),run('globalThis.__p177minFood'))}
    function checkReload(expected){
      assert.equal(run('save().ok'),true);
      const text=run("localStorage.getItem('rts_save')");
      const reload=environment({rts_save:text});
      assert.equal(reload.run('loadSaveAndApply().status'),'ok');
      assert.deepEqual(snap(reload.run),expected);
      return text;
    }
    function tickOne(){
      run('tick()');activeSeconds++;virtualNow+=1000;observe();
      if(activeSeconds<nextPause)return;
      assert.equal(run('save().ok'),true);
      const before=snap(run),savedTs=Number(run('_loadedTs'));
      assert.ok(Number.isFinite(savedTs));
      virtualNow=savedTs+offlineWindow*1000;
      const result=run('settleOffline()');
      assert.equal(result?.ok,true,JSON.stringify(result));
      assert.equal(result.durationSec,offlineWindow,'offline truncated');
      assert.equal(result.truncated,false,'offline truncated');
      const after=snap(run);
      assert.equal(after.population,before.population);
      assert.equal(after.capacity,before.capacity);
      assert.equal(after.growthClock,before.growthClock);
      observe();
      checkReload(after);
      windows.push({activeAt:source.totalActiveOnlineSeconds+activeSeconds,
        seconds:result.durationSec,before,after});
      nextPause+=activeWindow;
    }
    const beforeResearch=snap(run);
    const researched=run("researchScience('sci_city')");
    assert.equal(researched?.ok,true,JSON.stringify(researched));
    const afterResearch=snap(run);
    assert.equal(afterResearch.resources.tech,beforeResearch.resources.tech-2200);
    assert.ok(afterResearch.sciences.includes('sci_city'));
    assert.equal(afterResearch.battleWins,0);
    checkReload(afterResearch);
    const rate=run("CFG.market.rates.find(x=>x.from==='coin'&&x.to==='deed'&&x.early)?.rate");
    assert.equal(rate,0.01);

    for(const target of [24,28]){
      const segmentStart=snap(run),activeStart=activeSeconds,offlineStart=windows.length;
      const preview=run("settlementBatchPreview('city',1)");
      assert.equal(preview.ok,false);
      assert.match(preview.reason,/地契不足/);
      const deedCost=preview.cost;
      assert.ok(Number.isSafeInteger(deedCost)&&deedCost>0);
      const coinCost=Math.ceil(deedCost/rate);
      const sales=[];
      let guard=0;
      while(run('S.res.coin')+1e-7<coinCost){
        assert.ok(++guard<100,`${source.name}: market loop`);
        let sold=false;
        for(const key of ['wood','stone','food']){
          const amount=Math.floor(run(`S.res.${key}`)-reserve[key]);
          if(amount<1000)continue;
          const result=run(`exchangeResource('${key}','coin',${amount})`);
          assert.equal(result?.ok,true,`${source.name}: sell ${key}: ${JSON.stringify(result)}`);
          sales.push({key,amount,coinReceived:result.get});
          sold=true;observe();
        }
        if(run('S.res.coin')+1e-7>=coinCost)break;
        if(sold)continue;
        const possible=['wood','stone','food'].filter(key=>reserve[key]+1000<=run(`resCap('${key}')`));
        assert.ok(possible.length,`${source.name}: no marketable storage`);
        let waited=0;
        while(!possible.some(key=>run(`S.res.${key}>=${reserve[key]+1000}`))){
          assert.ok(waited++<20000,`${source.name}: production stalled`);
          tickOne();
        }
      }
      const beforeTrade=snap(run);
      const trade=run(`exchangeResource('coin','deed',${coinCost})`);
      assert.equal(trade?.ok,true,JSON.stringify(trade));
      assert.equal(trade.get,deedCost);
      assert.equal(run('S.res.coin'),beforeTrade.resources.coin-coinCost);
      assert.equal(run('S.res.deed'),beforeTrade.resources.deed+deedCost);
      const beforeBuild=snap(run);
      const build=run("upgradeSettlement('city')");
      assert.equal(build?.ok,true,JSON.stringify(build));
      assert.equal(run('maxPop()'),target);
      assert.equal(run('S.res.deed'),beforeBuild.resources.deed-deedCost);
      let birthSeconds=0;
      while(run('popCurrent()')<target){
        assert.ok(birthSeconds++<40,`${source.name}: birth stalled`);
        const beforePop=run('popCurrent()');
        tickOne();
        const newResidents=run('popCurrent()')-beforePop;
        assert.ok(newResidents>=0&&newResidents<=2);
        if(newResidents>0){
          const workers=run('S.popAlloc.wood')+newResidents;
          const assigned=run(`setPopAlloc('wood',${workers})`);
          assert.equal(assigned?.ok,true,JSON.stringify(assigned));
        }
      }
      const births=birthSeconds;
      const end=snap(run);
      assert.equal(end.population,target);assert.equal(end.capacity,target);
      assert.equal(end.free,start.free);
      assert.equal(end.battleWins,0);assert.equal(end.resources.deed,0);
      checkReload(end);
      steps.push({target,deedCost,coinCost,sales,beforeBuild,birthSeconds:births,
        activeSeconds:activeSeconds-activeStart,offlineWindows:windows.length-offlineStart,
        segmentStart,end});
    }
    const final=snap(run),finalStateSave=checkReload(final);
    assert.ok(minFood>=reserve.food-1e-9,`${source.name}: food reserve violated ${minFood}`);
    return{name:source.name,start,beforeResearch,afterResearch,steps,windows,final,
      activeOnlineSeconds:activeSeconds,offlineSeconds:windows.length*offlineWindow,
      totalActiveOnlineSeconds:source.totalActiveOnlineSeconds+activeSeconds,
      totalOfflineSeconds:source.totalSettledOfflineSeconds+windows.length*offlineWindow,
      minFood,finalStateSave};
  }finally{Date.now=oldNow}
}

const results=p158.results.map(scenario);
const baseline=p164.results.map(x=>({name:x.name.split('-20-to-28')[0],
  activeOnlineSeconds:x.activeOnlineSeconds,offlineWindows:x.offlineSessions.length,
  deeds:x.steps.reduce((n,step)=>n+(step.deedCost||0),0),
  totalActiveOnlineSeconds:x.totalActiveOnlineSeconds,totalOfflineSeconds:x.totalOfflineSeconds}));
const files=['config.js','levels.js','math.js','garrison.js','technology.js',
  'tests/progression/harness.js','tools/verify/probe-population-short-session-18-to-20-p158.js',
  'tools/verify/probe-zero-win-population-20-to-28-p164.js',p158Path,p164Path,
  'tools/verify/probe-zero-win-city-expansion-p177.js'];
const artifact={batch:'P177',sourceHead:head,sourceBatch:'P158',compareBatch:'P164',
  method:'exact P158 20-population zero-win saves; real sci_city research, market trades, city upgrades, online births, staffing, saves/reloads, and complete settleOffline windows',
  units:'online/offline seconds; population; deeds; resource units',sessionProfile:{activeWindow,offlineWindow},reserve,
  baseline,results,inputs:files.map(file=>({file,sha256:digest(file)}))};
fs.writeFileSync(path.join(root,outputPath),JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify({batch:'P177',baseline,results:results.map(x=>({name:x.name,
  activeOnlineSeconds:x.activeOnlineSeconds,offlineWindows:x.windows.length,
  totalActiveOnlineSeconds:x.totalActiveOnlineSeconds,totalOfflineSeconds:x.totalOfflineSeconds,
  deedCosts:x.steps.map(s=>s.deedCost),birthSeconds:x.steps.map(s=>s.birthSeconds),
  finalPopulation:x.final.population,finalCapacity:x.final.capacity,
  finalTech:x.final.resources.tech,minFood:x.minFood})),outputPath},null,2));
