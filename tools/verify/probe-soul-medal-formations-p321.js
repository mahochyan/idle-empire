'use strict';
// Conditional formation screen from the P319 paid roster. Reassigning the existing soldiers is free; no soldiers are injected.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p319-armored18-crystal-alert5200-recovered-save.json';
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(sha(raw),'983b8afdbc24c8c9143f58024139c51663ef870b7ed8c516811a7c6059c3fde4');
const origin=JSON.parse(raw),total={...origin.pool};
for(const groups of Object.values(origin.formation))for(const u of groups)total[u.type]=(total[u.type]||0)+u.count;
function form(front,mid=[],back=[['archer',55],['archer',55],['archer',55],['archer',55]]){
  let id=9500;const row=a=>a.map(([type,count])=>({type,count,id:id++}));
  return{front:row(front),mid:row(mid),back:row(back)};
}
const variants=[
  {name:'baseline',formation:origin.formation},
  {name:'armor-alloy-electro55',formation:form([['armored_trooper',55],['alloy_special',55],['electro_trooper',55]], [['star_trooper',55],['star_trooper',54],['star_trooper',46],['gold_cavalry',40]])},
  {name:'armor-alloy-star55-54',formation:form([['armored_trooper',55],['alloy_special',55],['star_trooper',55],['star_trooper',54]], [['star_trooper',46],['gold_cavalry',40]])},
  {name:'armor-alloy-star55-electro55',formation:form([['armored_trooper',55],['alloy_special',55],['star_trooper',55],['electro_trooper',55]], [['star_trooper',54],['star_trooper',46],['gold_cavalry',40]])},
  {name:'armor-alloy',formation:form([['armored_trooper',55],['alloy_special',55]], [['star_trooper',55],['star_trooper',54],['star_trooper',46],['gold_cavalry',40]])},
  {name:'armor-only',formation:form([['armored_trooper',55]], [['star_trooper',55],['star_trooper',54],['star_trooper',46],['gold_cavalry',40]])},
  {name:'electro55-only',formation:form([['electro_trooper',55]], [['star_trooper',55],['star_trooper',54],['star_trooper',46],['gold_cavalry',40]])},
  {name:'alloy55-only',formation:form([['alloy_special',55]], [['star_trooper',55],['star_trooper',54],['star_trooper',46],['gold_cavalry',40]])},
  {name:'armor-star55-54-46',formation:form([['armored_trooper',55],['star_trooper',55],['star_trooper',54],['star_trooper',46]], [['gold_cavalry',40]])},
  {name:'armor-silver15',formation:form([['armored_trooper',55],['silver_heavy',15]], [['star_trooper',55],['star_trooper',54],['star_trooper',46],['gold_cavalry',40]])}
];
function setup(){
  const e=environment({rts_save:raw}),load=e.run('loadSaveAndApply().status');assert.ok(['ok','migrated'].includes(load));
  e.run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{const id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));Math.random=()=>0.5;`);
  return e;
}
function screen(variant,key){
  const e=setup(),r=e.run,chosen={};
  for(const groups of Object.values(variant.formation))for(const u of groups)chosen[u.type]=(chosen[u.type]||0)+u.count;
  const pool={...total};for(const [type,count] of Object.entries(chosen)){
    assert.ok(Number.isSafeInteger(count)&&count>=0&&count<=(total[type]||0),variant.name+' '+type);
    pool[type]-=count;
  }
  assert.ok(Object.values(variant.formation).every(groups=>groups.length<=4&&groups.every(u=>u.count<=55)));
  r(`S.formation=${JSON.stringify(variant.formation)};S.pool=${JSON.stringify(pool)}`);
  assert.equal(r('totalSoldiers()'),671);
  assert.equal(r('validateSave(serializeSave()).ok'),true);
  const before=r('({bone:S.res.bone,medal:S.res.medal,army:formSoldierCount(),form:JSON.parse(JSON.stringify(S.formation))})');
  r(`openMaterialDomain('${key}')`);assert.equal(r('S.battleActive'),true);
  let steps=0;while(r('S.battleActive')&&steps++<2000)assert.equal(r('__step()'),true,variant.name+' '+key);
  assert.ok(steps<2000);
  const after=r('({bone:S.res.bone,medal:S.res.medal,army:formSoldierCount(),form:JSON.parse(JSON.stringify(S.formation)),round:B.round,result:document.getElementById("battle-result").className,enemyHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0)})');
  const byType=f=>Object.values(f).flat().reduce((x,u)=>(x[u.type]=(x[u.type]||0)+u.count,x),{});
  const start=byType(before.form),end=byType(after.form);
  const lossByType=Object.fromEntries(Object.entries(start).map(([unit,n])=>[unit,n-(end[unit]||0)]).filter(([,n])=>n>0));
  return{name:variant.name,key,result:after.result,round:after.round,enemyHp:after.enemyHp,loss:before.army-after.army,
    lossByType,boneGain:after.bone-before.bone,medalEquivalent:Math.floor((after.bone-before.bone)/68)*136};
}
const results=variants.flatMap(v=>['turtleShell','snakeGall'].map(key=>screen(v,key)));
const report={batch:'P321',kind:'conditional same-seed formation screen, not a paid repeated route',sourceFile,sourceSha256:sha(raw),seed:'Math.random=0.5',variants:variants.map(v=>v.name),results};
const dataFile='docs/codex/reports/data/p321-medal-formations.json';
fs.writeFileSync(path.join(root,dataFile),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,results:results.map(({name,key,result,loss,boneGain,medalEquivalent,enemyHp,lossByType})=>({name,key,result,loss,boneGain,medalEquivalent,enemyHp,lossByType})),dataFile},null,2));
