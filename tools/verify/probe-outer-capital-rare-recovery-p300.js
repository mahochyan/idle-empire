'use strict';
// P300: replay the paid golden-capital route under current rare drops and try one paid retry after its first loss.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {execFileSync}=require('node:child_process');
const {environment}=require('../../tests/progression/harness');

const root=path.resolve(__dirname,'../..');
const p259File=path.join(__dirname,'probe-outer-capital-live-p259.js');
const source=fs.readFileSync(p259File,'utf8');
const marker='try{\n  const flows=[];';
const at=source.indexOf(marker);
assert.ok(at>=0&&source.indexOf(marker,at+marker.length)<0,'P259 helper marker changed');
const engine=new Function('require','console','__dirname','process',source.slice(0,at)+
  'return {fight,recover,api,entry,entryFile,maxWins,maxRecoverySeconds,workerCycle,sha,plain,root};\n')(
    createRequire(p259File),{log(){},error:console.error},path.dirname(p259File),
    {argv:['node',p259File]});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const flowLimit=process.argv.includes('--pilot')?1:16;
const normalizedWorld=environment({rts_save:engine.entry});
const migrationStatus=normalizedWorld.run('loadSaveAndApply().status');
assert.ok(['ok','migrated'].includes(migrationStatus),'gold entry load failed');
const entry=normalizedWorld.store.get('rts_save');
assert.equal(engine.api.boot(entry).run('saveProtected()'),false);
function rareState(run){return plain(run('({blood:S.items.sacredBlood,ember:S.items.emberElixir})'))}
function chance(run){return plain(run("({blood:materialDomainEncounter('outerCapital').bloodDropChance,ember:materialDomainEncounter('outerCapital').emberDropChance})"))}
function delta(before,after){return{blood:after.blood-before.blood,ember:after.ember-before.ember}}
function paidTotal(rows){
  const total={};
  for(const row of rows)for(const [key,value] of Object.entries(row.recovery?.paid||{}))total[key]=(total[key]||0)+value;
  return total;
}
try{
  const flows=[];
  let hardCheckpoint=null;
  for(let flow=1;flow<=flowLimit;flow++){
    let ctx=engine.api.boot(entry),workerCursor=0;
    const rows=[];
    let firstLoss=null,retry=null;
    for(let attempt=1;attempt<=engine.maxWins;attempt++){
      const before=rareState(ctx.run),preChance=chance(ctx.run);
      const battle=engine.fight(ctx,flow,attempt);
      const after=rareState(ctx.run),loot=delta(before,after);
      assert.ok(loot.blood>=0&&loot.blood<=1&&loot.ember>=0&&loot.ember<=1,'rare reward count');
      if(!battle.won)assert.deepEqual(loot,{blood:0,ember:0},'loss cannot grant rare reward');
      const row={attempt,won:battle.won,alert:battle.enemy.alert,
        chance:preChance,loot,loss:battle.loss,callbacks:battle.callbacks,
        battleSaveSha256:battle.battleSaveSha256,recovery:null};
      if(!battle.won){firstLoss={attempt,alert:battle.enemy.alert,loss:battle.loss};
        const recovery=engine.recover(ctx,battle,flow,workerCursor);
        row.recovery=recovery.record;workerCursor=recovery.workerCursor;
        ctx=recovery.next;
        assert.deepEqual(rareState(ctx.run),after,'rare stock lost in failed-battle recovery');
        if(flow===11&&flowLimit===16){
          const raw=ctx.world.store.get('rts_save');
          assert.equal(sha(raw),ctx.saveSha256,'failed-battle recovery save hash');
          hardCheckpoint={raw,flow,alert:firstLoss.alert};
        }
        if(recovery.record.ready){
          const retryBefore=rareState(ctx.run),retryChance=chance(ctx.run);
          const retryBattle=engine.fight(ctx,flow,attempt+1);
          const retryAfter=rareState(ctx.run);
          retry={won:retryBattle.won,alert:retryBattle.enemy.alert,
            chance:retryChance,loot:delta(retryBefore,retryAfter),loss:retryBattle.loss,
            callbacks:retryBattle.callbacks,battleSaveSha256:retryBattle.battleSaveSha256};
          assert.equal(retry.alert,firstLoss.alert,'failed battle must not raise alert');
          if(!retry.won)assert.deepEqual(retry.loot,{blood:0,ember:0});
          assert.deepEqual(rareState(engine.api.boot(ctx.world.store.get('rts_save')).run),retryAfter,
            'retry rare stock reload');
        }
        rows.push(row);break;
      }
      const recovered=engine.recover(ctx,battle,flow,workerCursor);
      row.recovery=recovered.record;workerCursor=recovered.workerCursor;
      rows.push(row);ctx=recovered.next;
      assert.deepEqual(rareState(ctx.run),after,'rare stock lost in recovery');
      if(!recovered.record.ready)break;
    }
    flows.push({flow,rows,firstLoss,retry,
      winsBeforeLoss:rows.filter(row=>row.won).length,
      rare:rareState(ctx.run),paid:paidTotal(rows),
      recoverySeconds:rows.reduce((sum,row)=>sum+(row.recovery?.seconds||0),0),
      recoveryIncomplete:rows.some(row=>row.recovery&&!row.recovery.ready),
      capital:plain(ctx.run('({...S.development.outer.capital})')),
      final:engine.api.state(ctx.run),finalSaveSha256:sha(ctx.world.store.get('rts_save'))});
  }
  const compact=flows.map(f=>({flow:f.flow,wins:f.winsBeforeLoss,
    firstLoss:f.firstLoss?.alert??null,rare:f.rare,
    recoverySeconds:f.recoverySeconds,recoveryIncomplete:f.recoveryIncomplete,
    retryReady:!!f.retry,retryWon:f.retry?.won??null}));
  const result={batch:'P300',unit:'simulated online seconds, paid resources and actual soldiers',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    policy:{flowLimit,maxWins:engine.maxWins,maxRecoverySeconds:engine.maxRecoverySeconds,
      target:engine.api.target,workerCycle:engine.workerCycle,
      sourceSaveSha256:sha(engine.entry),migrationStatus,normalizedSaveSha256:sha(entry),
      battle:'P259 real asynchronous capital fight, one rare draw per eligible item',
      recovery:'P259 real housing, birth, staffing, training payment and reload',
      retry:'one fully paid same-formation attempt after first failure if recovered',
      time:'game simulated online seconds; clicks, animation and offline excluded'},
    checkpoint:hardCheckpoint?{file:'docs/codex/reports/data/p300-outer-capital-flow11-recovered-save.json',
      sha256:sha(hardCheckpoint.raw),flow:hardCheckpoint.flow,alert:hardCheckpoint.alert}:null,
    inputs:['config.js','levels.js','math.js','garrison.js','technology.js',
      'tests/progression/harness.js',engine.entryFile,
      'tools/verify/probe-outer-village-continuous-p246.js',
      'tools/verify/probe-outer-capital-live-p259.js',
      'tools/verify/probe-outer-capital-rare-recovery-p300.js'].map(file=>
      ({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),flows};
  if(flowLimit===16){
    assert.ok(hardCheckpoint,'missing hard-wall checkpoint');
    const output=path.join(root,'docs/codex/reports/data/p300-outer-capital-rare-recovery.json');
    fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    fs.writeFileSync(path.join(root,result.checkpoint.file),hardCheckpoint.raw);
  }
  console.log(JSON.stringify({batch:'P300',flowLimit,compact,summary:{
    wins:flows.map(f=>f.winsBeforeLoss),
    totalWins:flows.reduce((n,f)=>n+f.winsBeforeLoss,0),
    blood:flows.reduce((n,f)=>n+f.rare.blood,0),
    ember:flows.reduce((n,f)=>n+f.rare.ember,0),
    retries:flows.filter(f=>f.retry).length,
    retryWins:flows.filter(f=>f.retry?.won).length,
    incompleteRecovery:flows.filter(f=>f.recoveryIncomplete).map(f=>f.flow)},
    output:flowLimit===16?'docs/codex/reports/data/p300-outer-capital-rare-recovery.json':null},null,2));
}finally{global.Date=engine.api.RealDate}
