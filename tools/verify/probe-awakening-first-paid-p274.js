'use strict';
// 固定随机流下从 P273 实付档连打异果来源，再支付并打第一场觉醒试炼。
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const input=fs.readFileSync(path.join(root,'docs/codex/reports/data/p273-nuclear-knowledge-six-paid-save.json'),'utf8');
const e=environment({rts_save:input});
if(e.run('loadSaveAndApply().status')!=='migrated')throw Error('expected protected candidate migration');
e.run(`globalThis.__timers=new Map();globalThis.__timerId=1;
  Date.now=()=>1790496000000;
  setTimeout=fn=>{const id=__timerId++;__timers.set(id,fn);return id};
  clearTimeout=id=>__timers.delete(id);
  __step=()=>{const pair=__timers.entries().next().value;if(!pair)return false;__timers.delete(pair[0]);pair[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  addLog=m=>S.log.push(String(m));
  globalThis.__rng=1;Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};`);
const run=e.run,record=[];
function battle(){let callbacks=0;while(run('S.battleActive')&&callbacks<4000){if(!run('__step()'))throw Error('timer queue exhausted');callbacks++}
  if(run('S.battleActive'))throw Error('battle did not finish');return{result:run("document.getElementById('battle-result').className"),callbacks};}
for(let i=0;i<35;i++){
  run("openMaterialDomain('trialFruit')");
  if(!run('S.battleActive'))throw Error('source battle did not open at '+i);
  const b=battle();
  record.push({round:i+1,...b,fruit:run('S.items.trialFruit'),kill:run('S.killValues.godSilence'),troops:run('formSoldierCount()')});
  run('exitBattle()');
  if(b.result!=='win'||run('S.items.trialFruit')>=462)break;
}
const last=record.at(-1);
if(last.result!=='win'||last.fruit<462)throw Error('first trial not payable after '+record.length+' runs: '+JSON.stringify(last));
run(`(()=>{const old=S.formation.front[0];S.pool[old.type]=(S.pool[old.type]||0)+old.count;
  S.pool.star_trooper--;S.formation.front[0]={type:'star_trooper',count:1,id:991001};save()})()`);
const cost=run('awakeningTrialCost()');
const paid=run("openAwakeningTrial('easy')");
if(!paid.ok)throw Error('trial payment rejected: '+JSON.stringify(paid));
const trial=battle();
const output={source:'P273 knowledge6 paid save',harvest:record,trial:{...trial,cost,level:run('S.awakening.star_trooper.level'),stars:run('S.awakening.star_trooper.stars'),fruit:run('S.items.trialFruit'),troops:run('formSoldierCount()')},
  mainline:run('S.defeated.length'),population:run('S.population.current')};
const text=e.store.get('rts_save');
output.saveSha256=crypto.createHash('sha256').update(text).digest('hex');
fs.writeFileSync(path.join(root,'docs/codex/reports/data/p274-awakening-first-paid.json'),JSON.stringify(output,null,2));
if(trial.result==='win')fs.writeFileSync(path.join(root,'docs/codex/reports/data/p274-awakening-first-paid-save.json'),text);
console.log(JSON.stringify({sourceBattles:record.length,first:record[0],last,trial:output.trial,saveSha256:output.saveSha256},null,2));
