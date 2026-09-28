'use strict';
// P250: paid iron point -> iron warehouse -> iron era -> iron spearman.
// Reconstructs P249 flow 5 with real player actions and reloads each milestone.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {execFileSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p248File=path.join(__dirname,'probe-border-iron-continuous-p248.js');
const sourceFile='docs/codex/reports/data/p245-outer-village-l10-save.json';
const flowArg=process.argv.find(arg=>arg.startsWith('--flow='));
const flow=flowArg?Number(flowArg.slice(7)):5;
assert.ok(Number.isInteger(flow)&&flow>=1&&flow<=16,'flow must be 1..16');
const noWrite=process.argv.includes('--no-write');
const checkpointFile='docs/codex/reports/data/p250-iron-point-l15-save.json';
const outputFile='docs/codex/reports/data/p250-iron-point-to-army.json';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const source=fs.readFileSync(p248File,'utf8');
const marker='try{\n  const flows=[];';
const at=source.indexOf(marker);
assert.ok(at>=0&&source.indexOf(marker,at+marker.length)<0,'P248 export marker changed');
const apisource=source.slice(0,at)+'return {boot,fight,recover,reload,state,own,sourceSave,realDate};\n';
const p248=new Function('require','console','__dirname','process',apisource)(
  createRequire(p248File),{log(){},error:console.error},path.dirname(p248File),
  {argv:['node',p248File,'--formal']});
const events=[];
let ctx;
function capture(label,extra={}){
  const {run,env}=ctx;
  const row=plain(run(`({tick:S.tick,science:[...S.sciences],res:{...S.res},
    caps:{iron:resCap('iron'),tech:resCap('tech')},workers:{...S.popAlloc},
    buildings:JSON.parse(JSON.stringify(S.buildings)),
    point:{...S.development.border.sites.iron},activeSite:S.development.border.collection.activeSite,
    army:{ironSpearman:(S.pool.iron_spearman||0)+expeditionCount('iron_spearman')+garrisonCount('iron_spearman')},
    defeated:[...S.defeated],queue:JSON.parse(JSON.stringify(S.queue))})`));
  assert.equal(row.defeated.includes(19),false);
  assert.equal(row.workers.iron,0);
  assert.ok(Object.values(row.res).every(x=>Number.isFinite(x)&&x>=0),'invalid resource');
  events.push({label,...extra,state:row,saveSha256:sha(env.store.get('rts_save'))});
  return row;
}
function reload(label){
  const next=p248.reload(ctx);
  ctx=next;
  capture(label);
  return next;
}
function action(label,expression){
  const before=capture(label+' before');
  const result=plain(ctx.run(expression));
  assert.equal(result.ok,true,label+' '+JSON.stringify(result));
  reload(label+' after');
  return{before,result,after:events.at(-1).state};
}

try{
  // Same paid L10 source as P247–P249. Formation, combat, recruitment, online
  // production, point activation and every save are provided by the real code.
  ctx=p248.boot(p248.sourceSave);
  const start=capture('paid L10 start');
  assert.equal(start.point.level,0);
  const battleRows=[];
  for(let attempt=1;attempt<=15;attempt++){
    const battle=p248.fight(ctx,flow,attempt);
    assert.equal(battle.won,true,`flow ${flow} iron win ${attempt}`);
    const recovered=p248.recover(ctx,battle);
    assert.equal(recovered.record.ready,true);
    battleRows.push({attempt,loss:battle.loss,waitSec:recovered.record.seconds,
      paid:recovered.record.paid,ironActual:recovered.record.ironActual,
      battleSaveSha256:battle.battleSaveSha256,recoverySaveSha256:recovered.record.saveSha256});
    ctx=recovered.next;
  }
  const point15=capture('15 iron-point wins and paid recovery');
  assert.equal(point15.point.level,15);
  assert.equal(point15.point.wins,15);
  assert.equal(point15.activeSite,'iron');
  assert.ok(point15.res.iron>=200);
  const checkpointRaw=ctx.env.store.get('rts_save');
  if(!noWrite)fs.writeFileSync(path.join(root,checkpointFile),checkpointRaw+'\n');

  const warehouseResearch=action('research iron warehouse',"researchScience('sci_iron_warehouse')");
  assert.equal(warehouseResearch.after.res.tech,warehouseResearch.before.res.tech-1000);
  assert.equal(warehouseResearch.after.science.filter(id=>id==='sci_iron_warehouse').length,1);
  const storeBuild=action('pay and start iron store',"buildAct('iron_store')");
  assert.equal(storeBuild.after.res.iron,storeBuild.before.res.iron-200);
  assert.equal(storeBuild.after.buildings.iron_store.state,'building');
  let storeSeconds=0;
  while(ctx.run("bldSt('iron_store').state")!=='idle'&&storeSeconds<30){ctx.run('tick()');storeSeconds++}
  assert.equal(ctx.run("bldSt('iron_store').lv"),1);
  reload('iron store completed');
  assert.equal(events.at(-1).state.caps.iron,start.caps.iron+200);

  // The paid L10 save has no idle scholar. Move one existing wood worker to
  // research rather than injecting points, and let the real online ticks accrue.
  action('free wood worker',"setPopAlloc('wood',S.popAlloc.wood-1)");
  action('assign scholar',"setPopAlloc('tech',S.popAlloc.tech+1)");
  const knowledgeStart=capture('knowledge production start');
  assert.ok(knowledgeStart.res.tech<2500);
  let knowledgeSeconds=0,minFood=knowledgeStart.res.food;
  while(ctx.run('S.res.tech')<2500&&knowledgeSeconds<7200){
    ctx.run('tick()');knowledgeSeconds++;
    minFood=Math.min(minFood,ctx.run('S.res.food'));
  }
  assert.ok(knowledgeSeconds<7200,'iron-age knowledge did not accrue');
  assert.ok(minFood>=0);
  reload('knowledge ready');
  const ironEra=action('research iron era',"researchScience('sci_iron_age')");
  assert.equal(ironEra.after.res.tech,ironEra.before.res.tech-2500);
  assert.equal(ironEra.after.science.filter(id=>id==='sci_iron_age').length,1);
  const forgeBuild=action('pay and start iron forge',"buildAct('iron_forge')");
  assert.equal(forgeBuild.after.buildings.iron_forge.state,'building');
  let forgeSeconds=0;
  while(ctx.run("bldSt('iron_forge').state")!=='idle'&&forgeSeconds<30){ctx.run('tick()');forgeSeconds++}
  assert.equal(ctx.run("bldSt('iron_forge').lv"),1);
  reload('iron forge completed');

  const trainedBefore=capture('first spearman before queue');
  const queued=action('queue first iron spearman',"train('iron_spearman',1)");
  assert.equal(queued.after.queue.iron_spearman.count,1);
  let trainingSeconds=0,minFoodTraining=queued.after.res.food;
  while(p248.own(ctx.run,'iron_spearman')<1&&trainingSeconds<120){
    ctx.run('tick()');trainingSeconds++;
    minFoodTraining=Math.min(minFoodTraining,ctx.run('S.res.food'));
  }
  assert.equal(p248.own(ctx.run,'iron_spearman'),1,'iron spearman not paid and trained');
  reload('first iron spearman completed');
  const final=events.at(-1).state;
  assert.equal(final.army.ironSpearman,1);
  assert.equal(final.point.level,15);
  assert.equal(final.res.iron,trainedBefore.res.iron-100);
  assert.ok(final.defeated.length===10);

  const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js',sourceFile,
    'tools/verify/probe-border-iron-continuous-p248.js',
    'tools/verify/probe-iron-point-to-army-p250.js'];
  const result={batch:'P250',unit:'game simulated online tick seconds, resources and soldiers',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    policy:{sourceSaveSha256:sha(p248.sourceSave),flow,ironWins:15,
      checkpointFile,checkpointSha256:sha(checkpointRaw),ironWorkers:0,
      playerActions:'research, build, assign workers, train and save/reload via real game functions'},
    inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),
    battleRows,storeSeconds,knowledgeSeconds,minFood,forgeSeconds,
    trainingSeconds,minFoodTraining,events};
  const dest=path.join(root,outputFile);
  if(!noWrite)fs.writeFileSync(dest,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({batch:'P250',flow,point15:{tick:point15.tick,iron:point15.res.iron,tech:point15.res.tech,food:point15.res.food},
    storeSeconds,knowledgeSeconds,minFood,forgeSeconds,trainingSeconds,minFoodTraining,
    final:{tick:final.tick,iron:final.res.iron,tech:final.res.tech,food:final.res.food,
      ironCap:final.caps.iron,ironSpearman:final.army.ironSpearman,defeated:final.defeated.length},
    outputFile,checkpointFile},null,2));
}finally{global.Date=p248.realDate}
