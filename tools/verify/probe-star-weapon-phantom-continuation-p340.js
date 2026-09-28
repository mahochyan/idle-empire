'use strict';
// One uninterrupted random stream of real phantom-domain actions from the P338 paid save.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data='docs/codex/reports/data/';
const sourceFile=data+'p338-soul-production-knowledge-restored-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const origin=JSON.parse(raw),e=environment({rts_save:raw}),r=e.run;
assert.ok(['ok','migrated'].includes(r('loadSaveAndApply().status')));
const seed=Number(process.argv[2]||1),maxBattles=Number(process.argv[3]||80);
assert.ok(Number.isSafeInteger(seed)&&seed>0&&Number.isSafeInteger(maxBattles)&&maxBattles>=1&&maxBattles<=120);
r(`globalThis.__RealDate=Date;globalThis.Date=class extends __RealDate {static now(){return ${origin.ts}+(S.tick-${origin.tick})*1000}};
  globalThis.__timers=new Map();globalThis.__nextTimer=1;
  setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',className:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  addLog=m=>S.log.push(String(m));
  globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
function snap(){return r('({army:armyCount(),deployed:formSoldierCount(),medal:S.res.medal,core:S.items.godCore,alert:S.killValues.godPhantom,food:S.res.food,rng:__rng})')}
const opening=snap(),battles=[];
for(let n=1;n<=maxBattles;n++){
  const before=snap();
  if(before.deployed<1)break;
  r("openMaterialDomain('phantomFlower')");assert.equal(r('S.battleActive'),true);
  const enemy=r('({hp:B.enemyUnits[0].hp,atk:B.enemyUnits[0].atk,def:B.enemyUnits[0].def,amount:B.enemyUnits[0].initialCount})');
  const reward=r('({medal:B.enemyCfg.reward?.medal||0})');
  let callbacks=0;while(r('S.battleActive')&&callbacks++<3000)assert.equal(r('__step()'),true);
  assert.ok(callbacks<3000);
  const result=r("document.getElementById('battle-result').className"),after=snap();
  assert.ok(after.army<=before.army);
  if(result==='win'){
    assert.equal(after.alert,before.alert+100);assert.equal(after.medal-before.medal,reward.medal);
  }else{assert.equal(after.alert,before.alert);assert.equal(after.medal,before.medal)}
  battles.push({n,result,before,enemy,reward,after,callbacks});
  r('exitBattle()');
  if(result!=='win')break;
}
const final=snap();assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),sha(raw));
const save=e.store.get('rts_save'),reload=environment({rts_save:save});assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.res.medal'),final.medal);assert.equal(reload.run('S.killValues.godPhantom'),final.alert);
const saveFile=data+'p340-phantom-continuation-save.json';fs.writeFileSync(path.join(root,saveFile),save,'utf8');
const report={sourceFile,sourceSha256:sha(raw),seed,unit:'real battle count, soldiers, resource units',opening,
  battles,final,saveFile,saveSha256:sha(save),limit:'One uninterrupted fixed RNG stream; no roster restoration or calendar advancement.'};
const out=data+'p340-phantom-continuation.json';fs.writeFileSync(path.join(root,out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceFile,sourceSha256:sha(raw),seed,opening,battles:battles.length,wins:battles.filter(b=>b.result==='win').length,
  last:battles.at(-1),final,out,saveFile,saveSha256:sha(save)},null,2));
