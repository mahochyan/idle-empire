'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {environment}=require('./harness');

const source=fs.readFileSync(path.join(__dirname,'../../docs/codex/reports/data/p393-tier3-city-star10-prebattle-paid-save.json'),'utf8');
const sha=crypto.createHash('sha256').update(source).digest('hex');
assert.equal(sha,'df515a38dca073d7ff5fde1c235a48574b395041903b083f87d901c350380d51');
const snapshot=JSON.parse(source),now=snapshot.ts;
assert.equal(snapshot.v,33);
const e=environment({rts_save:source});
e.run(`globalThis.__fixedNow=${now};globalThis.Date=class extends Date{static now(){return __fixedNow}}`);
assert.equal(e.run('loadSaveAndApply().status'),'migrated');
assert.equal(e.store.get('rts_save_premigration'),source);
assert.equal(JSON.parse(e.store.get('rts_save')).v,35);
assert.equal(e.run('S.items.sacredBlood'),3);
assert.equal(e.run('S.items.domainCleanser'),0);
assert.equal(e.run('S.killValues.godRevival'),5000);
const future=e.run(`S.ops.filter(o=>o.key.startsWith('domain-cleanser')&&o.t>Date.now()).length`);
assert.equal(future,2,'fixture must carry both future idempotency records');

assert.equal(e.run("idemRepeat('domain-cleanser-exchange','market')"),false,
  'a future timestamp must not suppress a new cleanser exchange');
assert.equal(e.run("idemRepeat('domain-cleanser','godCrystal')"),false,
  'a future timestamp must not suppress a new crystal-domain cleanse');
const exchange=e.run('exchangeDomainCleanser(1)');
assert.equal(exchange.ok,true);
assert.equal(exchange.repeat,undefined);
assert.equal(exchange.spent,3);
assert.equal(exchange.gained,1);
assert.equal(e.run('S.items.sacredBlood'),0);
assert.equal(e.run('S.items.domainCleanser'),1);
assert.equal(e.run('S.ops.some(o=>o.t>Date.now())'),false,
  'the next successful mark must retire future records');

const cleanse=e.run("useDomainCleanser('godCrystal')");
assert.equal(cleanse.ok,true);
assert.equal(cleanse.repeat,undefined);
assert.equal(cleanse.spent,1);
assert.equal(cleanse.alert,4900);
assert.equal(e.run('S.items.domainCleanser'),0);
assert.equal(e.run('S.killValues.godRevival'),4900);
const repeat=e.run("useDomainCleanser('godCrystal')");
assert.equal(repeat.repeat,true,'same-window double click remains idempotent');
assert.equal(e.run('S.killValues.godRevival'),4900);

const saved=e.store.get('rts_save');
const reload=environment({rts_save:saved});
reload.run(`globalThis.__fixedNow=${now};globalThis.Date=class extends Date{static now(){return __fixedNow}}`);
assert.equal(reload.run('loadSaveAndApply().status'),'ok');
assert.equal(reload.run('S.items.sacredBlood'),0);
assert.equal(reload.run('S.items.domainCleanser'),0);
assert.equal(reload.run('S.killValues.godRevival'),4900);
assert.equal(reload.run("useDomainCleanser('godCrystal').repeat"),true);
console.log('future idempotency timestamp: paid exchange, cleanse, repeat, and save reload passed');
