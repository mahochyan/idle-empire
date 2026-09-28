'use strict';
// Source audit and bounded counterfactual for the P306 fixed crystal route.
// No player save or game state is changed by this probe.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const data=path.join(root,'docs/codex/reports/data');
const sourcePath=path.join(root,'210(1)_unpacked/_analysis/deob_main.js');
const entityPath=path.join(root,'210(1)_unpacked/_analysis/entities_table.json');
const paidPath=path.join(data,'p306-steam-knowledge22-crystal-paid.json');
const source=fs.readFileSync(sourcePath,'utf8');
const entities=JSON.parse(fs.readFileSync(entityPath,'utf8')).ents;
const paidRaw=fs.readFileSync(paidPath,'utf8');
const paid=JSON.parse(paidRaw);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const trade=entities['460020'],stock=entities['460016'];
const market=entities['380000'],cleanser=entities['380049'];
assert.equal(trade['resourceScience:Name'],'贸易精通');
assert.equal(trade['resourceScience:LvMax'],50);
assert.equal(trade['resourceScience:LimitID'],450809);
assert.deepEqual(trade['resourceScience:Need2'],[[160003,300],[160010,2]]);
assert.equal(stock['resourceScience:Name'],'市场存量');
assert.equal(stock['resourceScience:LvMax'],100);
assert.equal(stock['resourceScience:LimitID'],450809);
assert.equal(market['market:Time'],1200);
assert.equal(market['market:InitCount'],10);
assert.equal(cleanser['market:Rate'],10);
assert.equal(cleanser['market:MarketTime'],40);
assert.deepEqual(cleanser['market:Need'],[180001,3]);
const masteryAt=source.indexOf('_0x3412d1[0x704f4]/_0x3e0d3b[_0x578181][\'MarketTime\']');
assert.ok(masteryAt>0,'source trade-mastery purchase formula');
const masterySnippet=source.slice(masteryAt-90,masteryAt+100);
assert.ok(masterySnippet.includes('Math["floor"]')&&masterySnippet.includes('[0x0]'));
const refreshAt=source.indexOf("'key':'refreshTimer'");
assert.ok(refreshAt>0);
const refreshSnippet=source.slice(refreshAt,refreshAt+430);
assert.ok(refreshSnippet.includes("['Time']")&&refreshSnippet.includes('[0x4]>=_0xe5be25[0x5]'));
const marketCapAt=source.indexOf('"getMarketTime"');
assert.ok(marketCapAt>0);
const marketCapSnippet=source.slice(marketCapAt,marketCapAt+260);
assert.ok(marketCapSnippet.includes('0x704f0')&&marketCapSnippet.includes('+0x5'));
const manualRefreshAt=source.indexOf('"marketRefresh"');
assert.ok(manualRefreshAt>0);
const manualSnippet=source.slice(manualRefreshAt,manualRefreshAt+360);
assert.ok(manualSnippet.includes('[0x4]-=0x1')&&manualSnippet.includes('refreshResource'));
const sourcePurchasable=(slots,lv)=>Math.floor(slots*(1+lv/cleanser['market:MarketTime']));
assert.equal(sourcePurchasable(1,0),1);
assert.equal(sourcePurchasable(1,39),1);
assert.equal(sourcePurchasable(1,40),2);
assert.equal(sourcePurchasable(1,50),2);
assert.equal(sourcePurchasable(2,20),3);
assert.equal(paid.totals.boughtCleansers,19);
assert.equal(paid.totals.marketSeconds,570000);
assert.equal(paid.simulatedSeconds,614716);
assert.equal(paid.cycles.length,20);
assert.ok(paid.cycles.slice(1).every(x=>x.marketSeconds===30000));
const slotProbability=cleanser['market:Rate']/2625;
const expectedRefreshesPerDraw=1/(market['market:InitCount']*slotProbability);
const expectedSecondsWithoutMastery=19*expectedRefreshesPerDraw*market['market:Time'];
const expectedSecondsWithMastery40=Math.ceil(19/sourcePurchasable(1,40))*expectedRefreshesPerDraw*market['market:Time'];
const fixedRouteWithMastery40=Math.ceil(19/sourcePurchasable(1,40))*30000+paid.onlineTickSeconds;
const expectedDrawsIn50h=50*3600/market['market:Time']*market['market:InitCount']*slotProbability;
const report={batch:'P307',kind:'source market mastery and refresh-stock audit; counterfactual only',
  units:'seconds are simulated ratio-1 production seconds, hours divide by 3600; expectation assumes independent weighted slots and ignores duplicates within a refresh',
  sourceSha256:sha(source),entitiesSha256:sha(fs.readFileSync(entityPath)),paidSha256:sha(paidRaw),
  sourceOffsets:{mastery:masteryAt,refreshTimer:refreshAt,marketStockCap:marketCapAt,manualRefresh:manualRefreshAt},
  sourceMechanic:{intervalSec:market['market:Time'],slots:market['market:InitCount'],cleanserWeight:cleanser['market:Rate'],totalWeight:2625,marketTime:cleanser['market:MarketTime'],masteryMax:trade['resourceScience:LvMax'],stockLevelMax:stock['resourceScience:LvMax'],baseStoredRefreshCap:5,
    purchasableOneSlot:{level0:1,level39:1,level40:2,level50:2},purchasableTwoSlotsLevel20:3},
  p306:{cleanserPurchases:19,marketSeconds:paid.totals.marketSeconds,otherSeconds:paid.onlineTickSeconds,totalSeconds:paid.simulatedSeconds,perPurchaseMarketSeconds:30000},
  boundedCounterfactual:{expectedRefreshesPerDraw,expectedMarketHoursLevel0:expectedSecondsWithoutMastery/3600,
    expectedMarketHoursLevel40WithSingleSlot:expectedSecondsWithMastery40/3600,
    p306FixedSeedMarketHoursLevel40:Math.ceil(19/2)*30000/3600,
    p306FixedSeedTotalHoursLevel40KeepingOtherSeconds:fixedRouteWithMastery40/3600,
    expectedCleanserDrawsWithin50h:expectedDrawsIn50h,
    expectedPurchasesWithin50hAtLevel40:expectedDrawsIn50h*2},
  limits:['The 40 mastery levels have not been researched or paid in the current game.',
    'The current game has no stored manual market refresh charge mechanic; none are retroactively granted.',
    'This arithmetic does not simulate battle losses, resource costs or alternative combat paths at mastery level 40.',
    'Expected waiting time is not a guarantee or a player completion-time estimate.']};
const output=path.join(data,'p307-market-mastery-source-audit.json');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceOffsets:report.sourceOffsets,sourceMechanic:report.sourceMechanic,p306:report.p306,
  boundedCounterfactual:report.boundedCounterfactual,output:path.relative(root,output)},null,2));
