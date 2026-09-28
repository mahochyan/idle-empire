'use strict';
// Conditional late-unit stat envelope against the paid stage-99 army; no runtime balance change.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..');
const sourceFile='docs/codex/reports/data/p271-stage99-fulltech-seed1-save.json';
const paidStarFile='docs/codex/reports/data/p271-stage100-star-paid-save.json';
const paid=process.argv.includes('--paid');
const raw=fs.readFileSync(path.join(root,sourceFile),'utf8');
const paidRaw=paid?fs.readFileSync(path.join(root,paidStarFile),'utf8'):null;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const twoGroups=process.argv.includes('--two');
const profiles={
  noStar:null,
  current:{hpPerSoldier:4,atk:40,def:18,spd:8},
  balanced:{hpPerSoldier:6.5,atk:55,def:22,spd:9},
  strong:{hpPerSoldier:8,atk:65,def:24,spd:9},
  extreme:{hpPerSoldier:10,atk:75,def:26,spd:10}
};
const scales=[100,120,140,160,180,200];
const rows=[];
for(const [profile,stats] of Object.entries(profiles))for(const scale of scales)for(let seed=1;seed<=16;seed++){
  const e=environment({rts_save:paid&&stats?paidRaw:raw}),run=e.run;
  assert.equal(run('loadSaveAndApply().status'),'ok');assert.equal(run('S.defeated.length'),99);
  run(`globalThis.__timers=new Map();globalThis.__nextTimer=1;
    globalThis.setTimeout=fn=>{let id=__nextTimer++;__timers.set(id,fn);return id};
    globalThis.clearTimeout=id=>__timers.delete(id);
    globalThis.__step=()=>{const x=__timers.entries().next().value;if(!x)return false;__timers.delete(x[0]);x[1]();return true};
    globalThis.__nodes=new Map();document.getElementById=id=>{
      if(id.startsWith('ou-')||id.startsWith('eu-'))return null;
      if(!__nodes.has(id))__nodes.set(id,{style:{},innerHTML:'',textContent:'',scrollHeight:0,scrollTop:0,
        classList:{add(){},remove(){},toggle(){},contains(){return false}},setAttribute(){},appendChild(){},remove(){}});
      return __nodes.get(id)};
    globalThis.addLog=m=>S.log.push(String(m));
    globalThis.__rng=${seed};Math.random=()=>{let x=__rng;x^=x<<13;x^=x>>>17;x^=x<<5;__rng=x>>>0;return __rng/4294967296};
    CFG.enemies[99].units=Object.fromEntries(Object.entries(CFG.enemies[99].units).map(([type,counts])=>[type,counts.map(()=>${scale})]));`);
  if(stats){
    run(`Object.assign(CFG.units.star_trooper,${JSON.stringify(stats)})`);
    if(!paid){
      run("S.formation.front[2].type='star_trooper'");
      if(twoGroups)run("S.formation.front[1].type='star_trooper'");
    }else assert.equal(run("expeditionCount('star_trooper')"),101);
  }
  const before=run('Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0)');assert.equal(before,516);
  run('selEnemy(99);openBattle()');assert.equal(run('S.battleActive'),true);
  let callbacks=0;while(run('S.battleActive')&&callbacks<2000){assert.equal(run('__step()'),true);callbacks++}
  assert.equal(run('S.battleActive'),false);
  const won=run("document.getElementById('battle-result').className")==='win';
  const after=run("({deployed:Object.values(S.formation).flat().reduce((n,u)=>n+u.count,0),remainingHp:B.enemyUnits.reduce((n,u)=>n+Math.max(0,u.hp),0),round:B.round})");
  rows.push({profile,scale,seed,won,loss:before-after.deployed,remainingHp:after.remainingHp,round:after.round,callbacks});
}
const summary=[];
for(const profile of Object.keys(profiles))for(const scale of scales){
  const entries=rows.filter(x=>x.profile===profile&&x.scale===scale),wins=entries.filter(x=>x.won);
  summary.push({profile,scale,wins:wins.length,meanWinLoss:wins.length?wins.reduce((n,x)=>n+x.loss,0)/wins.length:null,
    maxWinLoss:wins.length?Math.max(...wins.map(x=>x.loss)):null,minEnemyRemainingHp:Math.min(...entries.map(x=>x.remainingHp))});
}
const report={batch:'P271',sourceFile,sourceSha256:sha(raw),paidStarFile:paid?paidStarFile:null,paidStarSha256:paid?sha(paidRaw):null,
  unit:'soldiers and real battle callbacks',method:paid?'100 star troops actually trained and 101 deployed; only stats/enemy are conditional':`conditional ${twoGroups?'101':'55'}-soldier replacement and temporary star stats; no training payment`,profiles,scales,summary,rows};
const output=`docs/codex/reports/data/p271-star-growth-sensitivity${paid?'-paid':twoGroups?'-two-groups':''}.json`;
fs.writeFileSync(path.join(root,output),JSON.stringify(report,null,2),'utf8');
assert.equal(sha(fs.readFileSync(path.join(root,sourceFile),'utf8')),report.sourceSha256);
if(paid)assert.equal(sha(fs.readFileSync(path.join(root,paidStarFile),'utf8')),report.paidStarSha256);
console.log(JSON.stringify({sourceSha256:report.sourceSha256,summary,output}));
