'use strict';
// Real local-state barter ceiling against the source science costs; reference science is not yet implemented.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const root=path.resolve(__dirname,'../..'),data=path.join(root,'docs/codex/reports/data');
const source='p285-awakening-stage6-full-roster-paid-save.json';
const raw=fs.readFileSync(path.join(data,source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const e=environment({rts_save:raw}),run=e.run;
assert.equal(run('loadSaveAndApply().status'),'migrated');
assert.equal(e.store.get('rts_save_premigration'),raw);
const before=run("({medal:S.res.medal,bone:S.res.bone,tech:S.res.tech,techCap:resCap('tech'),medalCap:resCap('medal'),boneTradeCost:beastBoneTradeCost(),boneTradeReward:beastBoneTradeReward(),armory:bldSt('electric_armory').lv,core:S.items.godCore,level:S.awakening.star_trooper.level})");
assert.equal(before.level,6);assert.equal(before.armory,50);
const trades=Math.floor(before.bone/before.boneTradeCost);
const trade=run(`exchangeBonesForMedals(${trades})`);
assert.equal(trade.ok,true);
const after=run("({medal:S.res.medal,bone:S.res.bone,tech:S.res.tech,core:S.items.godCore,level:S.awakening.star_trooper.level})");
assert.equal(after.medal,before.medal+trade.medalGain);
assert.equal(after.bone,before.bone-trade.boneCost);
assert.equal(after.level,before.level);
assert.equal(sha(fs.readFileSync(path.join(data,source),'utf8')),sha(raw));
const firstMedal=100000,totalMedal=600000,firstTech=8000000,totalTech=38000000;
const report={batch:'P286',kind:'real existing bone-to-medal action in isolated VM; source science prices compared, not researched',
  source,sourceSha256:sha(raw),before,trades,trade,after,
  sourceResearch:{first:{tech:firstTech,medal:firstMedal},allThree:{tech:totalTech,medal:totalMedal}},
  gapAfterTrading:{firstMedal:Math.max(0,firstMedal-after.medal),allThreeMedal:Math.max(0,totalMedal-after.medal),
    currentTechToFirst:Math.max(0,firstTech-before.tech),currentTechToAllThree:Math.max(0,totalTech-before.tech)},
  capacity:{firstTechFits:before.techCap>=firstTech,largestSingleTechFits:before.techCap>=20000000,
    firstMedalFits:before.medalCap>=firstMedal,largestSingleMedalFits:before.medalCap>=300000}};
const output='p286-soul-rank-gate-affordability.json';
fs.writeFileSync(path.join(data,output),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceSha256:report.sourceSha256,before,trades,trade,after,gapAfterTrading:report.gapAfterTrading,
  capacity:report.capacity,output},null,2));
