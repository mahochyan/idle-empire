'use strict';
// P253: isolated outer-town candidate, reached through paid village wins.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {execFileSync}=require('node:child_process');

const root=path.resolve(__dirname,'../..');
const p246File=path.join(__dirname,'probe-outer-village-continuous-p246.js');
const source=fs.readFileSync(p246File,'utf8');
const marker='try{\n  const flows=[];';
const at=source.indexOf(marker);
assert.ok(at>=0&&source.indexOf(marker,at+marker.length)<0,'P246 helper marker changed');
const api=new Function('require','console','__dirname','process',source.slice(0,at)+
  'return {boot,fight,spendAndRecover,formArmy,seedBattle,state,own,target,initialSave,RealDate};\n')(
    createRequire(p246File),{log(){},error:console.error},path.dirname(p246File),
    {argv:['node',p246File,'--deed=12']});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const scaleArg=process.argv.find(arg=>arg.startsWith('--scale='));
const scale=scaleArg?Number(scaleArg.slice(8)):1;
assert.ok([1,1.25,1.5,1.75,2].includes(scale),'scale must be one of 1, 1.25, 1.5, 1.75, 2');
const stages=scale===1?[0,1,5,10,15]:[10];
const scaled=groups=>Object.fromEntries(Object.entries(groups).map(([type,counts])=>
  [type,counts.map(count=>Math.round(count*scale))]));
const candidate={key:'outerTown',region:'town',name:'外域工造军镇',needScience:'sci_bronze_age',
  developmentOuter:true,boss:false,
  units:scaled({infantry:[7,5,3],archer:[7,5,3],cavalry_t1:[5,4,2]}),
  alertPerWin:20,reward:{deed:20,medal:7}};
const rows=[];
try{
  for(const winsBefore of stages){
    for(let flow=1;flow<=16;flow++){
      let ctx=api.boot(api.initialSave),workerCursor=0;
      for(let attempt=1;attempt<=winsBefore;attempt++){
        const battle=api.fight(ctx,flow,attempt);
        assert.equal(battle.won,true,`flow ${flow} village ${attempt}`);
        const recovery=api.spendAndRecover(ctx,battle,flow,workerCursor);
        assert.equal(recovery.record.ready,true,`flow ${flow} village recovery ${attempt}`);
        workerCursor=recovery.workerCursor;
        ctx=recovery.next;
      }
      const {run,world}=ctx;
      const checkpoint=world.store.get('rts_save');
      const before=api.state(run);
      assert.equal(before.region.wins,winsBefore);
      assert.equal(before.defeated.length,10);
      run(`CFG.developmentOuter.town=${JSON.stringify(candidate)}`);
      api.formArmy(run);
      const ownedBefore=Object.fromEntries(Object.keys(api.target).map(type=>[type,api.own(run,type)]));
      api.seedBattle(run,flow,winsBefore+1);
      run("openDevelopmentOuter('town')");
      assert.equal(run('S.battleActive'),true);
      const enemy=plain(run(`({alert:B.enemyCfg.alert,units:B.enemyCfg.units,
        groups:B.enemyUnits.length,people:B.enemyUnits.reduce((n,u)=>n+u.initialCount,0),
        hp:B.enemyUnits.reduce((n,u)=>n+u.hp,0),
        attackMass:B.enemyUnits.reduce((n,u)=>n+u.atk*combatAttackMass(u),0)})`));
      let callbacks=0;
      while(run('S.battleActive')&&callbacks<1500){
        assert.equal(run('__step()'),true,'town callback missing');callbacks++;
      }
      assert.equal(run('S.battleActive'),false,'town battle unfinished');
      const won=run("document.getElementById('battle-result').className")==='win';
      const after=api.state(run);
      const town=plain(run('({...S.development.outer.town})'));
      const loss=Object.fromEntries(Object.keys(api.target)
        .map(type=>[type,ownedBefore[type]-api.own(run,type)]));
      const battleSave=world.store.get('rts_save');
      if(won){
        assert.equal(town.wins,1);assert.equal(town.alert,20);
        assert.equal(after.res.deed-before.res.deed,20);
        assert.equal(after.res.medal-before.res.medal,7);
      }else{
        assert.equal(town.wins,0);assert.equal(town.alert,0);
        assert.equal(after.res.deed,before.res.deed);
        assert.equal(after.res.medal,before.res.medal);
      }
      assert.deepEqual(after.defeated,before.defeated);
      const fresh=api.boot(battleSave);
      assert.deepEqual(api.state(fresh.run),after,'town battle save reload');
      assert.deepEqual(plain(fresh.run('({...S.development.outer.town})')),town);
      run('exitBattle()');
      let recovery=null;
      if(won){
        const recovered=api.spendAndRecover(ctx,{won},flow,workerCursor);
        recovery=recovered.record;
      }
      rows.push({winsBefore,flow,before,enemy,won,callbacks,after,town,loss,
        checkpointSha256:sha(checkpoint),battleSaveSha256:sha(battleSave),recovery});
    }
  }
  const inputs=['config.js','levels.js','math.js','garrison.js','technology.js',
    'tests/progression/harness.js','docs/codex/reports/data/p245-outer-village-l10-save.json',
    'tools/verify/probe-outer-village-continuous-p246.js',
    'tools/verify/probe-outer-town-frontier-p253.js'];
  const result={batch:'P253',unit:'game simulated online tick seconds, resources and soldiers',
    head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    policy:{candidate,scale,stages,flows:'1..16 per stage',sourceSaveSha256:sha(api.initialSave),
      village:'formal P246 wins and paid recovery',town:'isolated CFG injection, real battle/settlement/recruitment functions'},
    inputs:inputs.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))})),rows};
  const output=scale===1?'docs/codex/reports/data/p253-outer-town-frontier.json':
    `docs/codex/reports/data/p253-outer-town-scale-${String(scale).replace('.','-')}.json`;
  fs.writeFileSync(path.join(root,output),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({batch:'P253',scale,summary:stages.map(n=>{
    const r=rows.filter(x=>x.winsBefore===n);
    return{villageWins:n,townWins:r.filter(x=>x.won).length,
      recovered:r.filter(x=>x.recovery?.ready).length,
      minFoodAfterPayment:Math.min(...r.map(x=>x.recovery?.minFoodAfterPayment??Infinity)),
      waitRange:[Math.min(...r.map(x=>x.recovery?.seconds??Infinity)),
        Math.max(...r.map(x=>x.recovery?.seconds??0))]};
  }),output},null,2));
}finally{global.Date=api.RealDate}
