'use strict';
// Run: node tests/visual/assets.js
// Checks the shipped art catalog against live CFG IDs without regenerating files.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'../..');
const art=path.join(root,'assets','art');
const manifest=JSON.parse(fs.readFileSync(path.join(art,'manifest.json'),'utf8'));
const cfgContext={};
vm.runInNewContext(fs.readFileSync(path.join(root,'config.js'),'utf8'),cfgContext);
vm.runInNewContext(fs.readFileSync(path.join(root,'technology.js'),'utf8'),cfgContext);
const CFG=vm.runInNewContext('CFG',cfgContext);
const sprites=vm.runInNewContext(
  fs.readFileSync(path.join(root,'sprites.js'),'utf8')+';({PIX_SPRITES,PIX_IMAGE_SPRITES,MAP_IMAGE_SPRITES})',
  {document:{createElement:()=>({}),head:{appendChild(){}}}}
);

function artFile(relative){
  assert.equal(typeof relative,'string');
  const absolute=path.resolve(art,relative);
  assert.ok(absolute.startsWith(art+path.sep),`art path escaped root: ${relative}`);
  assert.ok(fs.existsSync(absolute),`missing art file: ${relative}`);
  assert.ok(fs.statSync(absolute).size>0,`empty art file: ${relative}`);
  return absolute;
}
function pngSize(relative){
  const bytes=fs.readFileSync(artFile(relative));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',`bad PNG: ${relative}`);
  return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
}

assert.deepEqual(manifest.logicalSize,[32,32]);
assert.equal(manifest.animationFrames,4);
for(const id of Object.keys(CFG.units)){
  assert.ok(manifest.sprites[id],`unit without art: ${id}`);
}
for(const id of Object.keys(CFG.buildings)){
  assert.ok(manifest.buildings[id],`building without art: ${id}`);
}
for(const [group,entries] of Object.entries({res:CFG.res,essences:CFG.essences,units:CFG.units,buildings:CFG.buildings})){
  for(const [id,entry] of Object.entries(entries)){
    if(!entry.icon)continue;
    assert.ok(sprites.PIX_SPRITES[entry.icon]||sprites.PIX_IMAGE_SPRITES[entry.icon],
      `${group}.${id} icon ${entry.icon} has no runtime sprite`);
  }
}
for(const [id,row] of Object.entries(manifest.sprites)){
  assert.deepEqual(pngSize(row.png),[32,32],`${id} base sprite must be 32×32`);
  assert.deepEqual(pngSize(row.idleSheet),[128,32],`${id} idle sheet must contain four 32×32 frames`);
  for(const action of ['attackSheet','hitSheet','deathSheet'])
    assert.deepEqual(pngSize(row[action]),[128,32],`${id} ${action} must contain four 32×32 frames`);
  assert.match(fs.readFileSync(artFile(row.source),'utf8'),/<svg\b/i,`${id} editable SVG missing`);
}
for(const [id,row] of Object.entries(manifest.buildings)){
  assert.deepEqual(pngSize(row.png),[32,32],`${id} building icon must be 32×32`);
  assert.match(fs.readFileSync(artFile(row.source),'utf8'),/<svg\b/i,`${id} editable SVG missing`);
  if(row.mapPng)assert.deepEqual(pngSize(row.mapPng),[64,64],`${id} map sprite must be 64×64`);
}
for(const relative of Object.values(sprites.PIX_IMAGE_SPRITES)){
  if(relative.startsWith('./assets/art/'))artFile(relative.slice('./assets/art/'.length));
}
for(const relative of Object.values(sprites.MAP_IMAGE_SPRITES)){
  if(relative.startsWith('./assets/art/'))artFile(relative.slice('./assets/art/'.length));
}
const portraitIds=new Set([
  ...Object.values(CFG.unitUpgrades).flatMap(line=>Object.keys(line.tree)),
  ...Object.keys(CFG.units)
]);
for(const id of portraitIds){
  assert.ok(CFG.units[id],`technology node ${id} has no unit definition`);
  const png=`units/hires/${id}.png`;
  const master=`source/generated/units/${id}-master.png`;
  assert.deepEqual(manifest.highResUnitStills?.[id],{
    png,size:[512,512],master,masterSize:[1254,1254]
  },`${id} portrait must have its own exact manifest entry`);
  assert.deepEqual(pngSize(png),[512,512],`${id} portrait must be 512×512`);
  assert.deepEqual(pngSize(master),[1254,1254],`${id} portrait master must be 1254×1254`);
}
const eraTownIds=[
  'base','sci_bronze_age','sci_iron_age','sci_silver_age','sci_gold_age',
  'sci_alloy_age','sci_steam_age','sci_electric_age','sci_nuclear_age'
];
for(const id of eraTownIds){
  const png=`scene/town-${id}.png`;
  const master=`source/generated/town-${id}-master.png`;
  assert.deepEqual(manifest.eraTownScenes?.[id],{
    png,size:[1024,525],master,masterSize:[1672,941]
  },`${id} town scene must have its own exact manifest entry`);
  assert.deepEqual(pngSize(png),[1024,525],`${id} town scene must be 1024×525`);
  assert.deepEqual(pngSize(master),[1672,941],`${id} town master must be 1672×941`);
}
console.log(`PASS visual art catalog: ${Object.keys(manifest.sprites).length} units, `+
  `${portraitIds.size} distinct unit portraits, ${eraTownIds.length} era town scenes, `+
  `${Object.keys(manifest.buildings).length} buildings, CFG icon coverage, runtime image references`);
