// Verify game configuration references the shipped original-art assets.
// node assets/art/source/check.mjs
import {readFileSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';

const artRoot=join(dirname(fileURLToPath(import.meta.url)),'..');
const gameRoot=join(artRoot,'..','..');
const context={};
runInNewContext(readFileSync(join(gameRoot,'config.js'),'utf8'),context);
runInNewContext(readFileSync(join(gameRoot,'technology.js'),'utf8'),context);
runInNewContext(readFileSync(join(gameRoot,'sprites.js'),'utf8'),context);
const cfg=runInNewContext('CFG',context);
const icons=runInNewContext('PIX_SPRITES',context);
const imageIcons=runInNewContext('PIX_IMAGE_SPRITES',context);
const mapIcons=runInNewContext('MAP_SPRITES',context);
const mapImages=runInNewContext('MAP_IMAGE_SPRITES',context);
const manifest=JSON.parse(readFileSync(join(artRoot,'manifest.json'),'utf8'));
const models=JSON.parse(readFileSync(join(artRoot,'models','manifest.json'),'utf8'));
const errors=[];
const checkIcon=(kind,key,icon)=>{
  if(!icons[icon]&&!imageIcons[icon])errors.push(`${kind} ${key}: missing icon ${icon}`);
};
for(const [key,value] of Object.entries(cfg.res))checkIcon('resource',key,value.icon);
for(const [key,value] of Object.entries(cfg.essences))checkIcon('essence',key,value.icon);
for(const [key,value] of Object.entries(cfg.units))checkIcon('unit',key,value.icon);
for(const key of ['bronze_guard','iron_spearman','silver_heavy','gold_cavalry','alloy_special','armored_trooper','god_crystal_guard']){
  if(cfg.units[key]?.icon!==key)errors.push(`unit ${key}: expected its own original sprite, got ${cfg.units[key]?.icon}`);
}
for(const key of Object.keys(cfg.buildings))checkIcon('building',key,key);
for(const [key,value] of Object.entries(imageIcons)){
  const path=join(gameRoot,value.replace(/^\.\//,''));
  if(!existsSync(path))errors.push(`image icon ${key}: missing file ${value}`);
}
for(const [key,value] of Object.entries(mapImages)){
  if(!mapIcons[key]&&!value)errors.push(`map icon ${key}: no fallback`);
  const path=join(gameRoot,value.replace(/^\.\//,''));
  if(!existsSync(path))errors.push(`map icon ${key}: missing file ${value}`);
}
const pngSize=(file)=>{
  const data=readFileSync(file);
  if(data.toString('ascii',1,4)!=='PNG')throw Error('Not a PNG: '+file);
  return [data.readUInt32BE(16),data.readUInt32BE(20)];
};
const checkAssets=(group,label)=>{
  for(const [key,item] of Object.entries(group)){
    for(const field of ['png','idleSheet','attackSheet','hitSheet','deathSheet','source','mapPng']){
      if(!item[field])continue;
      const path=join(artRoot,item[field]);
      if(!existsSync(path)){errors.push(`${label} ${key}: missing ${field}`);continue;}
      if(field==='png'||field.endsWith('Sheet')||field==='mapPng'){
        const [w,h]=pngSize(path);
        const expected=field.endsWith('Sheet')?[128,32]:field==='mapPng'?[64,64]:[32,32];
        if(w!==expected[0]||h!==expected[1])errors.push(`${label} ${key}: ${field} size ${w}x${h}`);
      }
    }
  }
};
checkAssets(manifest.sprites,'unit');
checkAssets(manifest.buildings,'building');
checkAssets(manifest.vfx,'vfx');
for(const [key,value] of Object.entries(models.models)){
  const path=join(artRoot,'models',value.path);
  if(!existsSync(path)){errors.push(`model ${key}: file missing`);continue;}
  const file=readFileSync(path);
  if(file.toString('ascii',0,4)!=='glTF'||file.readUInt32LE(4)!==2||file.readUInt32LE(8)!==file.length)
    errors.push(`model ${key}: malformed GLB header`);
  const jsonSize=file.readUInt32LE(12);
  const json=JSON.parse(file.toString('utf8',20,20+jsonSize));
  const binOffset=20+jsonSize,binSize=file.readUInt32LE(binOffset);
  if(file.readUInt32LE(binOffset+4)!==0x004e4942||binOffset+8+binSize!==file.length)
    errors.push(`model ${key}: malformed BIN chunk`);
  if(json.buffers?.[0]?.byteLength>binSize)errors.push(`model ${key}: BIN too short`);
}
if(!existsSync(join(artRoot,manifest.atlas.png)))errors.push('atlas PNG missing');
if(!existsSync(join(artRoot,manifest.terrain.png)))errors.push('terrain PNG missing');
const backdrop=join(artRoot,manifest.battleBackdrop?.png||'');
if(!existsSync(backdrop))errors.push('battle backdrop missing');
else if(JSON.stringify(pngSize(backdrop))!==JSON.stringify([256,96]))errors.push('battle backdrop must be 256x96');
const checkPng=(label,path,size)=>{
  const full=join(artRoot,path||'');
  if(!existsSync(full)){errors.push(`${label}: missing ${path}`);return;}
  const actual=pngSize(full);
  if(JSON.stringify(actual)!==JSON.stringify(size))errors.push(`${label}: expected ${size.join('x')}, got ${actual.join('x')}`);
};
checkPng('primary UI atlas',manifest.primaryUiAtlas?.png,manifest.primaryUiAtlas?.size);
if(manifest.primaryUiAtlas?.grid?.join('x')!=='4x2'||manifest.primaryUiAtlas?.order?.length!==8)
  errors.push('primary UI atlas: expected 4x2 and eight ordered icons');
if(!existsSync(join(artRoot,manifest.primaryUiAtlas?.sourceNotes||'')))errors.push('primary UI source notes missing');
for(const [key,item] of Object.entries(manifest.sceneTextures||{})){
  checkPng(`${key} scene texture`,item.png,item.size);
  checkPng(`${key} scene master`,item.master,item.masterSize);
}
const eraTownIds=[
  'base','sci_bronze_age','sci_iron_age','sci_silver_age','sci_gold_age',
  'sci_alloy_age','sci_steam_age','sci_electric_age','sci_nuclear_age'
];
const townArtHashes={runtime:new Map(),master:new Map()};
for(const id of eraTownIds){
  const png=`scene/town-${id}.png`;
  const master=`source/generated/town-${id}-master.png`;
  const entry=manifest.eraTownScenes?.[id];
  if(id!=='base'&&!cfg.sciences?.[id])errors.push(`${id} town scene: no matching science`);
  if(!entry){errors.push(`${id} town scene: missing manifest entry`);continue;}
  if(entry.png!==png||entry.master!==master||JSON.stringify(entry.size)!=='[1024,525]'||JSON.stringify(entry.masterSize)!=='[1672,941]')
    errors.push(`${id} town scene: manifest path or size differs from the era ID`);
  checkPng(`${id} town scene`,png,[1024,525]);
  checkPng(`${id} town master`,master,[1672,941]);
  for(const [kind,path] of [['runtime',png],['master',master]]){
    const full=join(artRoot,path);
    if(!existsSync(full))continue;
    const digest=createHash('sha256').update(readFileSync(full)).digest('hex');
    const previous=townArtHashes[kind].get(digest);
    if(previous)errors.push(`${id} town ${kind}: identical image file to ${previous}`);
    else townArtHashes[kind].set(digest,id);
  }
}
if(JSON.stringify(Object.keys(manifest.eraTownScenes||{}).sort())!==JSON.stringify([...eraTownIds].sort()))
  errors.push('era town scenes: manifest IDs differ from the nine active eras');
if(!existsSync(join(artRoot,manifest.sceneOptimizer||'')))errors.push('scene optimizer missing');
for(const [key,item] of Object.entries(manifest.highResUnitStills||{})){
  checkPng(`${key} high-res still`,item.png,item.size);
  checkPng(`${key} high-res master`,item.master,item.masterSize);
}
// Every configured unit needs its own portrait: technology nodes, recruitable
// era units, and enemy-only characters shown in battle.
const portraitIds=new Set([
  ...Object.values(cfg.unitUpgrades).flatMap(line=>Object.keys(line.tree)),
  ...Object.keys(cfg.units)
]);
for(const id of portraitIds){
  if(!cfg.units[id])errors.push(`technology unit ${id}: no matching CFG.units entry`);
  const png=`units/hires/${id}.png`;
  const master=`source/generated/units/${id}-master.png`;
  const entry=manifest.highResUnitStills?.[id];
  if(!entry)errors.push(`${id} high-res still: missing manifest entry`);
  if(!entry||entry.png!==png||entry.master!==master||JSON.stringify(entry.size)!=='[512,512]'||JSON.stringify(entry.masterSize)!=='[1254,1254]'){
    if(entry)errors.push(`${id} high-res still: manifest path or size differs from the unit ID`);
    checkPng(`${id} high-res still`,png,[512,512]);
    checkPng(`${id} high-res master`,master,[1254,1254]);
  }
}
if(!existsSync(join(artRoot,manifest.highResOptimizer||'')))errors.push('high-res unit optimizer missing');
if(!existsSync(join(artRoot,manifest.highResPromptNotes||'')))errors.push('high-res unit prompt notes missing');
const vfx=manifest.highResVfx;
const requiredVfx=['swordqi','arrow','thrust','cavslash','magebolt','beastbite','impact-spark','impact-magic','dust'];
if(JSON.stringify(vfx?.ids)!==JSON.stringify(requiredVfx))errors.push('high-res VFX ID list differs from the nine original effects');
for(const id of requiredVfx){
  checkPng(`${id} high-res VFX`,`${vfx?.pngDirectory}/${id}.png`,[512,512]);
  checkPng(`${id} high-res VFX master`,`${vfx?.masterDirectory}/${id}-master.png`,[1254,1254]);
}
for(const key of ['optimizer','promptNotes'])if(!existsSync(join(artRoot,vfx?.[key]||'')))errors.push(`high-res VFX ${key} missing`);
const unitVfx=manifest.unitVfx;
for(const key of ['profiles','generator'])if(!existsSync(join(artRoot,unitVfx?.[key]||'')))errors.push(`unit VFX ${key} missing`);
const perIdVfx=unitVfx?.perIdMasters;
if(perIdVfx){
  const promptFile=join(artRoot,perIdVfx.promptNotes||'');
  if(!existsSync(promptFile))errors.push('per-ID VFX prompt notes missing');
  else try{
    const promptIds=Object.keys(JSON.parse(readFileSync(promptFile,'utf8')).subjects||{}).sort();
    if(JSON.stringify(promptIds)!==JSON.stringify([...(perIdVfx.ids||[])].sort()))errors.push('per-ID VFX prompt coverage differs from master IDs');
  }catch(error){errors.push('per-ID VFX prompts malformed: '+error.message);}
  for(const id of perIdVfx.ids||[]){
    if(!cfg.units[id])errors.push(`per-ID VFX ${id}: no CFG.units entry`);
    checkPng(`${id} per-ID VFX master`,`${perIdVfx.directory}/${id}-master.png`,perIdVfx.size);
  }
}
const techLineVfx=unitVfx?.techLineMasters;
if(techLineVfx){
  const ids=techLineVfx.ids||[];
  const promptFile=join(artRoot,techLineVfx.promptNotes||'');
  if(!existsSync(promptFile))errors.push('tech-line VFX prompt notes missing');
  else try{
    const notes=JSON.parse(readFileSync(promptFile,'utf8'));
    if(typeof notes.commonPrompt!=='string'||notes.commonPrompt.length<80||
      JSON.stringify(Object.keys(notes.subjects||{}).sort())!==JSON.stringify([...ids].sort()))
      errors.push('tech-line VFX prompt coverage differs from master IDs');
  }catch(error){errors.push('tech-line VFX prompts malformed: '+error.message);}
  for(const id of ids){
    if(!cfg.units[id]||cfg.units[id].enemyOnly)errors.push(`tech-line VFX ${id}: not a trainable CFG.units entry`);
    checkPng(`${id} tech-line VFX master`,`${techLineVfx.directory}/${id}-master.png`,
      techLineVfx.sizes?.[id]||techLineVfx.size);
    if(techLineVfx.previousRuntimeDirectory)checkPng(`${id} previous runtime VFX`,
      `${techLineVfx.previousRuntimeDirectory}/${id}.png`,[256,256]);
  }
  if(!techLineVfx.validation||!existsSync(join(artRoot,techLineVfx.validation)))
    errors.push('tech-line VFX validation report missing');
}
try{
  const profiles=JSON.parse(readFileSync(join(artRoot,unitVfx.profiles),'utf8'));
  const configured=Object.keys(cfg.units).sort();
  if(JSON.stringify(Object.keys(profiles).sort())!==JSON.stringify(configured))errors.push('unit VFX profiles do not cover every CFG.units ID');
  for(const id of configured){
    if(profiles[id]?.art!==`./assets/art/vfx/units/${id}.png`)errors.push(`${id} unit VFX profile art path differs from runtime ID path`);
    checkPng(`${id} unit VFX`,`${unitVfx.pngDirectory}/${id}.png`,[256,256]);
    if(!existsSync(join(artRoot,unitVfx.sourceDirectory,id+'.svg')))errors.push(`${id} unit VFX editable SVG missing`);
  }
}catch(error){errors.push('unit VFX profiles malformed or missing: '+error.message);}
const enemyPromptsPath=join(artRoot,manifest.highResEnemyPromptNotes||'');
if(!existsSync(enemyPromptsPath))errors.push('enemy portrait prompt notes missing');
else try{
  const prompts=JSON.parse(readFileSync(enemyPromptsPath,'utf8'));
  const expected=Object.entries(cfg.units).filter(([,unit])=>unit.enemyOnly).map(([id])=>id).sort();
  const actual=Object.keys(prompts.subjects||{}).sort();
  if(typeof prompts.commonPrompt!=='string'||prompts.commonPrompt.length<80||
    JSON.stringify(actual)!==JSON.stringify(expected)||
    expected.some(id=>typeof prompts.subjects[id]!=='string'||!prompts.subjects[id].trim()))
    errors.push('enemy portrait prompt notes: ID coverage or content invalid');
}catch(error){errors.push('enemy portrait prompt notes: malformed JSON');}
if(errors.length){for(const e of errors)console.error(e);process.exitCode=1;}
else console.log(`Art check passed: ${Object.keys(manifest.sprites).length} characters, ${portraitIds.size} distinct unit portraits, ${eraTownIds.length} era town scenes, ${Object.keys(manifest.buildings).length} buildings, ${Object.keys(manifest.vfx).length} legacy VFX, ${requiredVfx.length} high-res VFX, ${Object.keys(cfg.units).length} unit VFX, ${Object.keys(models.models).length} GLB models.`);
