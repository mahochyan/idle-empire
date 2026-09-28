'use strict';
// 接续真实零胜利蒸汽路线，验证合金后的神之领域研究能由在线生产支付。
// 时间单位为在线秒；不注入资源、人口、科技或胜利。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const prior=fs.readFileSync(path.join(__dirname,'probe-steam-era.js'),'utf8');
const {run,action,assign,waitFor,upgradeTo,build,point,points,actions,extraActions}=new Function(
  'require','console','__dirname',prior+'\nreturn {run,action,assign,waitFor,upgradeTo,build,point,points,actions,extraActions};'
)(require,{log(){}},__dirname);
assert.equal(run("S.sciences.includes('sci_alloy_age')"),true);
assert.equal(run("S.sciences.includes('sci_god_domain')"),false);
assert.ok(run("resCap('tech')")>=50000);
assert.ok(run("resCap('steel')")>=5000);
assign({food:6,tech:20});
waitFor('S.res.tech>=50000',20000);
assign({food:2,stone:8,coal:7,iron:5,steel:4});
waitFor('S.res.steel>=5000',20000);
const before=run('({tech:S.res.tech,steel:S.res.steel})');
action("researchScience('sci_god_domain')",'research','神之领域');
assert.equal(run('S.res.tech'),before.tech-50000);
assert.equal(run('S.res.steel'),before.steel-5000);
assert.equal(run("S.sciences.includes('sci_god_domain')"),true);
assert.equal(run('S.defeated.length'),0);
point('god-domain-researched');
// 从已完成的合金兵坊出发，实际升级产能、支付招募材料并用编队动作开战。
assign({wood:8,stone:8,food:4,tech:6});
upgradeTo('alloy_armory',4);
if(run("bldSt('barracks').lv")===0)build('barracks');
upgradeTo('barracks',3);
assert.ok(run('regMax()')>=16);
assign({food:2,stone:8,coal:7,iron:5,steel:4});
waitFor('S.res.steel>=1500',20000);
assign({food:26});
const recruitNeed=16-run('S.pool.alloy_special');
assert.ok(recruitNeed>0&&recruitNeed<=15,'合金兵补员数非法');
const recruit=run(`train('alloy_special',${recruitNeed})`);
assert.equal(recruit?.ok,true,JSON.stringify(recruit));
assert.equal(recruit.qty,recruitNeed);
extraActions.train++;
waitFor('S.pool.alloy_special>=16',20000);
assert.ok(run('S.pool.alloy_special')>=16);
point('alloy-army-trained');
run("openFormModal('expedition','front',0);S._formModalSel='alloy_special';S._formModalQty=16;confirmForm()");
assert.equal(run('S.formation.front.length'),1);
assert.equal(run('S.formation.front[0].count'),16);
assert.equal(run('S.pool.alloy_special'),0);
run('globalThis.__originalGodRandom=Math.random;Math.random=()=>0.5');
run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
  globalThis.setTimeout=(fn,delay)=>{const id=__nextTimer++;__timers.set(id,fn);return id};
  globalThis.clearTimeout=id=>__timers.delete(id);
  globalThis.__step=()=>{const first=__timers.entries().next().value;if(!first)return false;__timers.delete(first[0]);first[1]();return true};
  globalThis.__nodes=new Map();document.getElementById=id=>{
    if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
    if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
      classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
    return __nodes.get(id)};
  globalThis.addLog=m=>S.log.push(String(m));openGodDomain();`);
assert.equal(run('S.battleActive'),true);
for(let n=0;n<500&&run('S.battleActive');n++)assert.equal(run('__step()'),true,'战斗回调应存在');
assert.equal(run('S.battleActive'),false,'战斗应结算');
assert.equal(run('S.items.godCrystal'),1,'真实新档路线的首场神域胜利应获得水晶');
assert.equal(run('S.defeated.length'),0);
point('first-god-crystal-win');
const refill=16-run('S.formation.front[0].count');
assert.ok(refill>0&&refill<16,'首战应有可补充的非致命战损');
run('exitBattle()');
assign({food:2,stone:8,coal:7,iron:5,steel:4});
waitFor(`S.res.steel>=${refill*100}`,20000);
assign({food:26});
const retrain=run(`train('alloy_special',${refill})`);
assert.equal(retrain?.ok,true,JSON.stringify(retrain));
extraActions.train++;
waitFor(`S.pool.alloy_special>=${refill}`,20000);
run(`openFormModal('expedition','front',0);S._formModalSel='alloy_special';S._formModalQty=${refill};confirmForm()`);
assert.equal(run('S.formation.front[0].count'),16);
run('openGodDomain()');
for(let n=0;n<500&&run('S.battleActive');n++)assert.equal(run('__step()'),true,'复刷战斗回调应存在');
assert.equal(run('S.battleActive'),false);
assert.equal(run('S.items.godCrystal'),2,'补足真实战损后应能重复取得水晶');
assert.equal(run('S.defeated.length'),0);
point('second-god-crystal-win');
run('Math.random=__originalGodRandom');
console.log(JSON.stringify({unit:'online seconds',onlineSeconds:run('S.tick'),population:run('S.population.current'),wins:run('S.defeated.length'),
  techCap:run("resCap('tech')"),steelCap:run("resCap('steel')"),researchPayment:before,
  godDomainResearch:true,crystal:run('S.items.godCrystal'),survivingAlloy:run("S.formation.front.reduce((n,u)=>n+u.count,0)"),
  actions:{...actions,...extraActions},milestones:points.filter(p=>['god-domain-researched','alloy-army-trained','first-god-crystal-win','second-god-crystal-win'].includes(p.label))
    .map(p=>({label:p.label,second:p.onlineSeconds,population:p.population,food:p.resources.food,steel:p.resources.steel,crystal:p.label==='second-god-crystal-win'?2:p.label==='first-god-crystal-win'?1:0}))},null,2));
