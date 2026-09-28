'use strict';
// Fixed-scroll capacity lower bounds plus isolated real material fights; no player save is written.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const sources=[
  'p273-nuclear-knowledge-six-paid-save.json',
  'p285-awakening-stage6-full-roster-paid-save.json'
];
const sourceRaw=Object.fromEntries(sources.map(name=>[name,fs.readFileSync(path.join(data,name),'utf8')]));
const sourceSha256=Object.fromEntries(sources.map(name=>[name,hash(sourceRaw[name])]));
const paid=environment({rts_save:sourceRaw[sources[0]]}),run=paid.run;
assert.equal(run('loadSaveAndApply().status'),'migrated');
assert.equal(paid.store.get('rts_save_premigration'),sourceRaw[sources[0]]);
const paidState=run("({cap:resCap('tech'),tech:S.res.tech,medal:S.res.medal,scroll:S.beastExchange.scrollUsed,levels:{steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,nuclear:S.eraStorage.nuclearKnowledge},items:{godCrystal:S.items.godCrystal,guardianStone:S.items.guardianStone,revivalLeaf:S.items.revivalLeaf},next:{steam:eraStorageCost('steamKnowledge'),electric:eraStorageCost('electricKnowledge'),nuclear:eraStorageCost('nuclearKnowledge')},sourceAlerts:{godCrystal:S.killValues.godRevival,guardianStone:S.killValues.godGuardian,revivalLeaf:S.killValues.godRebirth}})");
assert.equal(paidState.cap,160589045);
const capacityFrontier=run(`(()=>{
  const goal=3000000000,initial={steam:S.eraStorage.steamKnowledge,electric:S.eraStorage.electricKnowledge,nuclear:S.eraStorage.nuclearKnowledge,scroll:S.beastExchange.scrollUsed};
  const sum=(from,to)=>(from+1+to)*(to-from)/2;
  const price=(key,from,to)=>({tech:CFG.eraStorage[key].techBase*sum(from,to),material:(CFG.eraStorage[key].lateMaterialBase??CFG.eraStorage[key].lateCrystalBase)*sum(from,to)});
  const results=[];
  for(const scroll of [initial.scroll,CFG.beastExchange.scrollUseLimit]){
    S.beastExchange.scrollUsed=scroll;
    let best=null;
    for(let steam=initial.steam;steam<=100;steam++){
      S.eraStorage.steamKnowledge=steam;
      for(let electric=initial.electric;electric<=100;electric++){
        S.eraStorage.electricKnowledge=electric;
        S.eraStorage.nuclearKnowledge=100;
        if(resCap('tech')<goal)continue;
        let lo=initial.nuclear,hi=100;
        while(lo<hi){const mid=Math.floor((lo+hi)/2);S.eraStorage.nuclearKnowledge=mid;if(resCap('tech')>=goal)hi=mid;else lo=mid+1}
        S.eraStorage.nuclearKnowledge=lo;
        const st=price('steamKnowledge',initial.steam,steam),el=price('electricKnowledge',initial.electric,electric),nu=price('nuclearKnowledge',initial.nuclear,lo);
        const tech=st.tech+el.tech+nu.tech;
        if(best===null||tech<best.tech){best={scroll,extraScroll:scroll-initial.scroll,levels:{steam,electric,nuclear:lo},cap:resCap('tech'),tech,materials:{godCrystal:st.material,guardianStone:el.material,revivalLeaf:nu.material}}}
      }
    }
    results.push(best);
  }
  for(const result of results){
    const targets=[['steamKnowledge',initial.steam,result.levels.steam,'godCrystal'],
      ['electricKnowledge',initial.electric,result.levels.electric,'guardianStone'],
      ['nuclearKnowledge',initial.nuclear,result.levels.nuclear,'revivalLeaf']];
    const actual={tech:0,materials:{godCrystal:0,guardianStone:0,revivalLeaf:0}};
    for(const [key,from,to,material] of targets)for(let level=from;level<to;level++){
      S.eraStorage[key]=level;const cost=eraStorageCost(key);
      actual.tech+=cost.tech;actual.materials[material]+=cost[material]||0;
    }
    if(actual.tech!==result.tech||Object.keys(actual.materials).some(key=>actual.materials[key]!==result.materials[key]))throw Error('capacity price disagrees with eraStorageCost');
  }
  S.eraStorage.steamKnowledge=initial.steam;S.eraStorage.electricKnowledge=initial.electric;S.eraStorage.nuclearKnowledge=initial.nuclear;S.beastExchange.scrollUsed=initial.scroll;
  return{goal,results,restoredCap:resCap('tech')};
})()`);
assert.equal(capacityFrontier.restoredCap,paidState.cap);
assert.ok(capacityFrontier.results.every(x=>x&&x.cap>=capacityFrontier.goal));
for(const result of capacityFrontier.results){
  result.materialDeficit=Object.fromEntries(Object.entries(result.materials).map(([key,amount])=>[key,Math.max(0,amount-paidState.items[key])]));
}

function battle(sourceName,domain,seed,alertOverride=null){
  const raw=sourceRaw[sourceName],origin=JSON.parse(raw),e=environment({rts_save:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'migrated');
  if(alertOverride!==null){assert.equal(domain,'guardianStone');run(`S.killValues.godGuardian=${alertOverride}`)}
  run(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
    globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
  const before=run(`({item:S.items.${domain},alert:S.killValues.${domain==='godCrystal'?'godRevival':domain==='guardianStone'?'godGuardian':'godRebirth'},army:armyCount(),defeated:S.defeated.length})`);
  run(`openMaterialDomain('${domain}')`);
  assert.equal(run('S.battleActive'),true,sourceName+' '+domain);
  const enemy=run("({hp:B.enemyUnits[0].hp,def:B.enemyUnits[0].def,atk:B.enemyUnits[0].atk})");
  let callbacks=0;
  while(run('S.battleActive')&&callbacks<3000){assert.equal(run('__step()'),true);callbacks++}
  assert.ok(callbacks<3000);
  const result=run("document.getElementById('battle-result').className");
  const after=run(`({item:S.items.${domain},alert:S.killValues.${domain==='godCrystal'?'godRevival':domain==='guardianStone'?'godGuardian':'godRebirth'},army:armyCount(),defeated:S.defeated.length,enemyHp:B.enemyUnits[0].hp})`);
  assert.equal(after.defeated,before.defeated);
  assert.ok(after.army<=before.army);
  if(result==='win'){assert.ok(after.item>before.item);assert.equal(after.alert,before.alert+100)}
  else{assert.equal(after.item,before.item);assert.equal(after.alert,before.alert)}
  assert.equal(hash(fs.readFileSync(path.join(data,sourceName),'utf8')),sourceSha256[sourceName]);
  return{seed,result,before,enemy,after,callbacks};
}
const battleSamples={};
for(const sourceName of sources){
  battleSamples[sourceName]={};
  for(const domain of ['godCrystal','guardianStone','revivalLeaf']){
    const rows=Array.from({length:11},(_,i)=>battle(sourceName,domain,i+1));
    battleSamples[sourceName][domain]={wins:rows.filter(x=>x.result==='win').length,rows};
  }
}
// Unpaid alert conditions identify whether an existing cleanser route merits a future paid probe.
const guardianSensitivity={};
for(const alert of [4400,4300,4200,4000]){
  const rows=Array.from({length:11},(_,i)=>battle(sources[1],'guardianStone',i+1,alert));
  guardianSensitivity[alert]={wins:rows.filter(x=>x.result==='win').length,rows};
}
const output={batch:'P304',kind:'fixed-scroll paid-state capacity search and isolated one-battle material pressure, not a paid route',
  units:'resource units, material items, soldiers, battle callbacks; capacity conditions do not advance simulated time',
  sourceSha256,paidState,capacityFrontier,battleSamples,guardianSensitivity};
const outputFile='p304-quantum-capacity-frontier.json';
fs.writeFileSync(path.join(data,outputFile),JSON.stringify(output,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256,paidState,frontier:capacityFrontier.results,
  battles:Object.fromEntries(Object.entries(battleSamples).map(([source,domains])=>[source,Object.fromEntries(Object.entries(domains).map(([name,x])=>[name,x.wins+'/11']))])),
  guardianSensitivity:Object.fromEntries(Object.entries(guardianSensitivity).map(([alert,x])=>[alert,x.wins+'/11'])),outputFile},null,2));
