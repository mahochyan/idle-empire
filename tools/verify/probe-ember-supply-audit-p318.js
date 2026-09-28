'use strict';
// Audit the provenance of the 20 attack elixirs used at the 5000 alert cliff.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('../../tests/progression/harness');
const data=path.resolve(__dirname,'../../docs/codex/reports/data');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=name=>fs.readFileSync(path.join(data,name),'utf8');
const earlyName='p304-electric-knowledge17-guardian-paid-save.json';
const lateName='p306-steam-knowledge22-crystal-paid-save.json';
const ledgerName='p306-steam-knowledge22-crystal-paid.json';
const earlyRaw=read(earlyName),lateRaw=read(lateName),ledgerRaw=read(ledgerName);
assert.equal(sha(earlyRaw),'596abcd27b71e8c90f1bac53b9fe5bca1b7a1b30f4c9c085d7b69fe3562eda99');
assert.equal(sha(lateRaw),'5f0d037cde645de2c7e4c7b4e5fa3aa4fd74b3c396012c235346b51dbecb005f');
const early=JSON.parse(earlyRaw),late=JSON.parse(lateRaw),ledger=JSON.parse(ledgerRaw);
assert.equal(ledger.source,earlyName);assert.equal(ledger.saveFile,lateName);
assert.equal(ledger.sourceSha256,sha(earlyRaw));assert.equal(ledger.saveSha256,sha(lateRaw));
assert.equal(ledger.cycles.length,20);
assert.ok(ledger.cycles.every(c=>c.crystal.seed===4&&c.beforeFight.crystalAlert===4600&&c.after.crystalAlert===4700));
assert.equal(early.items.emberElixir,0);assert.equal(late.items.emberElixir,20);
const e=environment({rts_save:earlyRaw});assert.equal(e.run('loadSaveAndApply().status'),'migrated');
const config=e.run("({dropChance:materialDomainEncounter('godCrystal',4600).emberDropChance,market:{refreshSec:CFG.market.special.refreshSec,slots:CFG.market.special.slots,totalWeight:CFG.market.special.totalWeight,emberWeight:CFG.market.special.weights.emberElixir,emberBloodCost:CFG.market.special.goods.emberElixir.cost}})");
assert.equal(config.dropChance,300);assert.equal(config.market.emberBloodCost,20);
const independentDropP=config.dropChance/10000;
const marketOfferP=1-(1-config.market.emberWeight/config.market.totalWeight)**config.market.slots;
const audit={batch:'P318',kind:'provenance and conditional supply arithmetic for 20 already-owned ember elixirs',
  early:{file:earlyName,sha256:sha(earlyRaw),ember:early.items.emberElixir},
  late:{file:lateName,sha256:sha(lateRaw),ember:late.items.emberElixir},
  p306:{ledger:ledgerName,sha256:sha(ledgerRaw),cycles:ledger.cycles.length,uniqueBattleSeeds:[...new Set(ledger.cycles.map(c=>c.crystal.seed))],allPreAlerts:[...new Set(ledger.cycles.map(c=>c.beforeFight.crystalAlert))],allPostAlerts:[...new Set(ledger.cycles.map(c=>c.after.crystalAlert))],marketRatio1Seconds:ledger.marketRatio1Seconds,onlineTickSeconds:ledger.onlineTickSeconds},
  config,conditionalArithmetic:{dropProbabilityPerWinAtThisAlert:independentDropP,
    expectedWinsFor20DropsIfIndependentAtFixedAlert:20/independentDropP,
    marketProbabilityOfAtLeastOneOfferPerRefresh:marketOfferP,
    expectedMarketSecondsPerItemIfIndependentAndAlwaysBought:config.market.refreshSec/marketOfferP,
    expectedMarketSecondsFor20IfIndependentAndAlwaysBought:20*config.market.refreshSec/marketOfferP,
    bloodFor20MarketBuys:20*config.market.emberBloodCost},
  limitations:['P306 resets battle RNG to seed 4 before each of its 20 fights; 20 drops are one repeatedly selected favorable stream, not 20 independent drops.',
    'Theoretical independent-drop wins hold the alert at 4600 and exclude rising difficulty, soldier losses, resource cost, cleanser waits and other sources.',
    'Market waiting assumes independent refreshes, immediate purchase, enough blood and constant access. It is not a player duration forecast.']};
const name='p318-ember-supply-audit.json';
fs.writeFileSync(path.join(data,name),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({p306:audit.p306,conditionalArithmetic:audit.conditionalArithmetic,report:name},null,2));
