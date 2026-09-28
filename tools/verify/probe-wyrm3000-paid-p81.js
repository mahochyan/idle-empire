'use strict';
// P81：沿实付图纸档真实赢一场铁脊蜥龙3000，保留战损；不条件补兵或改敌人。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const source=fs.readFileSync(path.resolve(__dirname,'../../docs/codex/reports/data/p81-stock-scroll-paid.json'),'utf8');
const outArg=process.argv.find(x=>x.startsWith('--snapshot-final='));
const e=environment({rts_save:source}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'ok');
assert.equal(run('S.killValues.wildWyrm'),3000);
assert.equal(run('S.items.wyrmSinew'),72);
assert.equal(run('armyCount()'),437);
const before=run("({tick:S.tick,army:armyCount(),kill:S.killValues.wildWyrm,stock:S.items.wyrmSinew,formation:JSON.parse(JSON.stringify(S.formation)),res:{...S.res}})");
run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));
  globalThis.__rng=10;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
run("openMaterialDomain('wyrmSinew')");
assert.equal(run('S.battleActive'),true);
let callbacks=0;
while(run('S.battleActive')&&callbacks<1000){assert.equal(run('__step()'),true);callbacks++}
assert.equal(run('S.battleActive'),false);
const after=run("({tick:S.tick,round:B.round,enemyHp:B.enemyUnits[0].hp,army:armyCount(),kill:S.killValues.wildWyrm,stock:S.items.wyrmSinew,formation:JSON.parse(JSON.stringify(S.formation)),res:{...S.res}})");
assert.equal(after.enemyHp,0);
assert.equal(after.kill,3010);
assert.equal(after.stock,97);
assert.equal(after.army,382);
assert.equal(run('save().ok'),true);
const final=e.store.get('rts_save'),check=environment({rts_save:final});
assert.equal(check.run('loadSaveAndApply().status'),'ok');
assert.equal(check.run('S.items.wyrmSinew'),after.stock);
assert.equal(check.run('armyCount()'),after.army);
if(outArg)fs.writeFileSync(path.resolve(outArg.slice('--snapshot-final='.length)),final);
const byType=form=>Object.fromEntries([...new Set(form.front.concat(form.mid,form.back).map(u=>u.type))].map(type=>[type,form.front.concat(form.mid,form.back).filter(u=>u.type===type).reduce((a,u)=>a+u.count,0)]));
const oldTypes=byType(before.formation),newTypes=byType(after.formation);
const lost=Object.fromEntries(Object.entries(oldTypes).map(([type,count])=>[type,count-(newTypes[type]||0)]).filter(([,n])=>n>0));
assert.equal(Object.values(lost).reduce((a,b)=>a+b,0),55);
console.log(JSON.stringify({unit:'battle rounds; soldiers; items; simulated online seconds',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),
  before:{tick:before.tick,army:before.army,kill:before.kill,stock:before.stock},
  after:{tick:after.tick,round:after.round,enemyHp:after.enemyHp,army:after.army,kill:after.kill,stock:after.stock},
  callbacks,lost,finalSha256:crypto.createHash('sha256').update(final).digest('hex')},null,2));
