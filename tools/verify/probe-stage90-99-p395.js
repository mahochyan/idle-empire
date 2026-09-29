'use strict';
// Reuse P394's authentic training/battle helpers, then test a continuous
// 90-99 first-clear path. Candidate enemy counts exist only inside each VM.
const fs=require('node:fs');
const path=require('node:path');
const sourceFile=path.join(__dirname,'probe-stage96-low-p394.js');
const source=fs.readFileSync(sourceFile,'utf8');
const marker='const stage96=[];';
if(source.split(marker).length!==2)throw new Error('P394 helper anchor changed');
const helperSource=source.split(marker)[0];
const continuation=String.raw`
const targets={90:165,91:180,92:210,93:250,94:300,95:360,96:450,97:600,98:800,99:1100};
const formal=process.argv.includes('--formal');
if(formal){
  targets[97]=603;targets[98]=798;targets[99]=800;
  configure=(run,stage,target)=>{
    const units=run('JSON.parse(JSON.stringify(CFG.enemies['+(stage-1)+'].units))');
    const count=Object.values(units).flat().reduce((n,x)=>n+x,0);
    assert.equal(count,target,'formal stage '+stage+' count differs');
    return{before:count,after:count,units};
  };
}
const target99Arg=process.argv.find(x=>x.startsWith('--stage99='));
if(target99Arg&&!formal){targets[99]=Number(target99Arg.slice('--stage99='.length));
  assert.ok(Number.isInteger(targets[99])&&targets[99]>0)}
const sampleSeeds=process.argv.includes('--pilot')?[1,7,9,16]:Array.from({length:16},(_,i)=>i+1);
const rows=[];
const input=inputs.early;
let paidStage99=null;
for(const seed of sampleSeeds){
  let env=make('early',seed),run=env.run;
  assert.equal(run('S.defeated.length'),89);
  const trajectory={seed,battles:[],blockedAt:null,seconds:0,trainingPaid:{}};
  for(let stage=90;stage<=99;stage++){
    assert.equal(run('S.defeated.length'),stage-1);
    let prep=prepare(run,formations.armorAlloy);
    trajectory.seconds+=prep.seconds;
    for(const [rk,n] of Object.entries(prep.paid))trajectory.trainingPaid[rk]=(trajectory.trainingPaid[rk]||0)+n;
    let battle=fight(env,stage,targets[stage]);
    const attempt={stage,prep:{seconds:prep.seconds,trained:prep.trained,paid:prep.paid,
      armyBefore:prep.before.army,armyAfter:prep.after.army},
      first:compactFight(battle),retries:[]};
    for(let retry=1;retry<=3&&!battle.won;retry++){
      env=make('early',seed+retry*100,battle.raw);run=env.run;
      prep=prepare(run,formations.armorAlloy);
      trajectory.seconds+=prep.seconds;
      for(const [rk,n] of Object.entries(prep.paid))trajectory.trainingPaid[rk]=(trajectory.trainingPaid[rk]||0)+n;
      battle=fight(env,stage,targets[stage]);
      attempt.retries.push({seed:seed+retry*100,
        prep:{seconds:prep.seconds,trained:prep.trained,paid:prep.paid},
        battle:compactFight(battle)});
    }
    trajectory.battles.push(attempt);
    if(!battle.won){trajectory.blockedAt=stage;break}
    if(stage===98){
      const file='p395-stage98-low-paid-seed'+seed+'-save.json';
      fs.writeFileSync(path.join(data,file),battle.raw,'utf8');
      attempt.checkpoint={file,sha256:sha(battle.raw)};
    }
    if(stage===99&&seed===9){
      const file='p395-stage99-low-paid-seed9-target'+targets[99]+(formal?'-formal':'')+'-save.json';
      fs.writeFileSync(path.join(data,file),battle.raw,'utf8');
      paidStage99={file,sha256:sha(battle.raw),scienceGate:run('campaignStageSelectable(99)'),
        tick:run('S.tick'),army:run('armyCount()'),
        selectionAccepted:run('selEnemy(99)')};
      assert.equal(paidStage99.scienceGate,false);
      assert.equal(paidStage99.selectionAccepted,false);
      assert.equal(env.store.get('rts_save'),battle.raw);
    }
  }
  rows.push(trajectory);
}
const summary={seeds:sampleSeeds,targets,
  firstClearByStage:Object.fromEntries(Object.keys(targets).map(stage=>[stage,
    {firstWins:rows.filter(r=>r.battles.find(b=>b.stage===Number(stage))?.first.won).length,
     eventuallyWon:rows.filter(r=>{const b=r.battles.find(x=>x.stage===Number(stage));return b&&(b.retries.at(-1)?.battle.won??b.first.won)}).length,
     reached:rows.filter(r=>r.battles.some(b=>b.stage===Number(stage))).length}])),
  completed:rows.filter(r=>!r.blockedAt).length,blocked:rows.filter(r=>r.blockedAt).map(r=>({seed:r.seed,stage:r.blockedAt})),
  paidStage99};
const report={kind:formal?'P395 formal continuous low army first-clear and paid recovery':
  'P395 continuous low army first-clear and paid recovery candidate',
  unit:'online seconds, soldiers, raw resource units',head,mode,
  input:{file:input.file,sha256:input.sha256},sourceHashes,
  helperFile:path.basename(__sourceFile),helperSha256:sha(__source),summary,rows};
const out=path.join(data,(formal?'p395-stage90-99-formal':process.argv.includes('--pilot')?
  'p395-stage90-99-pilot':'p395-stage90-99-full')+
  '-target'+targets[99]+'.json');
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
assert.equal(sha(fs.readFileSync(path.join(data,input.file),'utf8')),input.sha256);
console.log(JSON.stringify({out,summary,
  rows:rows.map(r=>({seed:r.seed,blockedAt:r.blockedAt,seconds:r.seconds,
    stages:r.battles.map(b=>({stage:b.stage,first:b.first.won,loss:b.first.loss,
      retries:b.retries.map(x=>({seed:x.seed,won:x.battle.won,loss:x.battle.loss,seconds:x.prep.seconds}))}))}))},null,2));
`;
new Function('require','console','__dirname','__sourceFile','__source',helperSource+continuation)(
  require,console,__dirname,sourceFile,source);
