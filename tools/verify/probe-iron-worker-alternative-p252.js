'use strict';
// P252: same paid L10 save, no border battle; one temporary iron worker pays
// the first iron store and spearman, then becomes the scholar for iron age.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p245-outer-village-l10-save.json';
const outputFile='docs/codex/reports/data/p252-iron-worker-alternative.json';
const sourceSave=fs.readFileSync(path.join(root,sourceFile),'utf8').trim();
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const realDate=global.Date;
global.Date=class extends realDate{
  constructor(...args){super(...(args.length?args:[1790400000001]))}
  static now(){return 1790400000001}
};
function boot(save){
  const env=environment({rts_save:save});
  assert.equal(env.run('loadSaveAndApply().status'),'ok');
  return env;
}
function state(run){return plain(run(`({tick:S.tick,res:{...S.res},
  caps:{iron:resCap('iron'),tech:resCap('tech')},workers:{...S.popAlloc},
  buildings:JSON.parse(JSON.stringify(S.buildings)),science:[...S.sciences],
  point:{...S.development.border.sites.iron},activeSite:S.development.border.collection.activeSite,
  ironSpearman:(S.pool.iron_spearman||0)+expeditionCount('iron_spearman')+garrisonCount('iron_spearman'),
  defeated:[...S.defeated]})`))}
const events=[];
let env,run;
function capture(label,extra={}){
  const s=state(run);
  assert.equal(s.point.level,0);
  assert.equal(s.activeSite,null);
  assert.deepEqual(s.defeated,Array.from({length:10},(_,i)=>i+1));
  assert.ok(Object.values(s.res).every(x=>Number.isFinite(x)&&x>=0));
  events.push({label,...extra,state:s,saveSha256:sha(env.store.get('rts_save'))});
  return s;
}
function reload(label){
  assert.equal(run('save().ok'),true);
  const raw=env.store.get('rts_save'),old=state(run);
  env=boot(raw);run=env.run;
  assert.deepEqual(state(run),old);
  return capture(label);
}
function action(label,expression){
  const before=capture(label+' before');
  const result=plain(run(expression));
  assert.equal(result.ok,true,label+' '+JSON.stringify(result));
  const after=reload(label+' after');
  return{before,result,after};
}

try{
  env=boot(sourceSave);run=env.run;
  const start=capture('paid L10 start');
  assert.equal(start.res.iron,179);
  assert.equal(start.workers.iron,0);
  action('research iron warehouse',"researchScience('sci_iron_warehouse')");
  const noIronBuild=plain(run("buildAct('iron_store')"));
  assert.equal(noIronBuild.ok,false);
  assert.equal(noIronBuild.reason,'resources');
  assert.equal(run('S.res.iron'),179);
  action('free wood worker',"setPopAlloc('wood',S.popAlloc.wood-1)");
  action('assign iron worker',"setPopAlloc('iron',S.popAlloc.iron+1)");
  const productionStart=capture('iron worker production start');
  let ironSeconds=0,minFood=productionStart.res.food;
  while(run('S.res.iron')<300&&ironSeconds<1000){
    run('tick()');ironSeconds++;
    minFood=Math.min(minFood,run('S.res.food'));
  }
  assert.ok(ironSeconds<1000,'iron worker failed to produce 121 iron');
  const productionEnd=reload('iron worker stock ready');
  assert.ok(productionEnd.res.iron>=300);
  const store=action('pay iron and start store',"buildAct('iron_store')");
  assert.equal(store.after.res.iron,store.before.res.iron-200);
  let storeSeconds=0;
  while(run("bldSt('iron_store').state")!=='idle'&&storeSeconds<30){run('tick()');storeSeconds++}
  assert.equal(run("bldSt('iron_store').lv"),1);
  reload('iron store complete');
  action('release iron worker',"setPopAlloc('iron',S.popAlloc.iron-1)");
  action('assign scholar',"setPopAlloc('tech',S.popAlloc.tech+1)");
  const knowledgeStart=capture('knowledge production start');
  let knowledgeSeconds=0;
  while(run('S.res.tech')<2500&&knowledgeSeconds<7200){
    run('tick()');knowledgeSeconds++;
    minFood=Math.min(minFood,run('S.res.food'));
  }
  assert.ok(knowledgeSeconds<7200);
  reload('iron-age knowledge ready');
  action('research iron era',"researchScience('sci_iron_age')");
  const forge=action('pay and start iron forge',"buildAct('iron_forge')");
  assert.equal(forge.after.buildings.iron_forge.state,'building');
  let forgeSeconds=0;
  while(run("bldSt('iron_forge').state")!=='idle'&&forgeSeconds<30){run('tick()');forgeSeconds++}
  assert.equal(run("bldSt('iron_forge').lv"),1);
  reload('iron forge complete');
  const trainBefore=capture('spearman before queue');
  action('queue iron spearman',"train('iron_spearman',1)");
  let trainSeconds=0;
  while(run("(S.pool.iron_spearman||0)+expeditionCount('iron_spearman')+garrisonCount('iron_spearman')")<1&&trainSeconds<120){
    run('tick()');trainSeconds++;
    minFood=Math.min(minFood,run('S.res.food'));
  }
  assert.ok(trainSeconds<120);
  const final=reload('first iron spearman paid and trained');
  assert.equal(final.ironSpearman,1);
  assert.equal(final.caps.iron,800);
  assert.equal(final.res.iron,trainBefore.res.iron-100);
  assert.equal(final.workers.iron,0);

  const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js',sourceFile,
    'tools/verify/probe-iron-worker-alternative-p252.js'];
  const result={batch:'P252',unit:'game simulated online tick seconds, resources and soldiers',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    policy:{sourceSaveSha256:sha(sourceSave),battleWins:0,ironPointLevel:0,
      worker:'one wood worker to iron until stock >=300, then same person to scholar',
      noInjectedResources:true},
    inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),
    noIronBuild,ironSeconds,minFood,storeSeconds,knowledgeSeconds,forgeSeconds,
    trainSeconds,events};
  fs.writeFileSync(path.join(root,outputFile),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({batch:'P252',ironSeconds,
    ironPaidFromWorker:productionEnd.res.iron-productionStart.res.iron,
    stoneStockChangeDuringIronJob:productionEnd.res.stone-productionStart.res.stone,
    coalStockChangeDuringIronJob:productionEnd.res.coal-productionStart.res.coal,
    minFood,storeSeconds,knowledgeSeconds,forgeSeconds,trainSeconds,
    totalOnlineSeconds:final.tick-start.tick,
    final:{iron:final.res.iron,tech:final.res.tech,food:final.res.food,
      ironSpearman:final.ironSpearman,pointLevel:final.point.level},outputFile},null,2));
}finally{global.Date=realDate}
