// Local static HTTP smoke for every generated art URL; no persistent server.
// node assets/art/source/check-http.mjs
import {createServer} from 'node:http';
import {readFile,readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
const modelManifest=JSON.parse(readFileSync(join(root,'models','manifest.json'),'utf8'));
const actionManifest=JSON.parse(readFileSync(join(root,'units','hires','actions','manifest.json'),'utf8'));
const unitVfxProfiles=JSON.parse(readFileSync(join(root,manifest.unitVfx.profiles),'utf8'));
const artRelative=path=>path.replace(/^\.\/assets\/art\//,'');
const urls=new Set([
  manifest.atlas.png,manifest.terrain.png,manifest.battleBackdrop.png,
  manifest.primaryUiAtlas.png,
  ...Object.values(manifest.sceneTextures).map(x=>x.png),
  ...Object.values(manifest.eraTownScenes||{}).map(x=>x.png),
  ...Object.values(manifest.highResUnitStills).map(x=>x.png),
  ...Object.values(manifest.sprites).flatMap(x=>[x.png,x.idleSheet,x.attackSheet,x.hitSheet,x.deathSheet,x.source]),
  ...Object.values(manifest.buildings).flatMap(x=>[x.png,x.source,x.mapPng].filter(Boolean)),
  ...Object.values(manifest.vfx).flatMap(x=>[x.png,x.source]),
  ...Object.values(actionManifest.units).flatMap(actions=>
    Object.values(actions).flatMap(row=>[row.path,row.compactPath].filter(Boolean).map(artRelative))),
  ...Object.keys(unitVfxProfiles).map(id=>manifest.unitVfx.pngDirectory+'/'+id+'.png'),
  ...Object.values(modelManifest.models).map(x=>'models/'+x.path)
]);
const server=createServer((request,response)=>{
  const rel=decodeURIComponent((request.url||'/').slice(1));
  if(!urls.has(rel)){response.writeHead(404);response.end();return;}
  readFile(join(root,rel),(error,body)=>{
    response.writeHead(error?404:200,{'Content-Type':rel.endsWith('.png')?'image/png':rel.endsWith('.glb')?'model/gltf-binary':'application/octet-stream'});
    response.end(error?undefined:body);
  });
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();
const failures=[];
for(const list of Array.from(urls).reduce((chunks,url,i)=>{if(i%24===0)chunks.push([]);chunks.at(-1).push(url);return chunks;},[])){
  const results=await Promise.all(list.map(async path=>{
    try{const response=await fetch(`http://127.0.0.1:${address.port}/${path}`);await response.arrayBuffer();return [path,response.status];}
    catch(error){return [path,String(error)];}
  }));
  failures.push(...results.filter(([,status])=>status!==200));
}
await new Promise(resolve=>server.close(resolve));
if(failures.length){for(const [path,status] of failures)console.error(`${status} ${path}`);process.exitCode=1;}
else console.log(`HTTP art check passed: ${urls.size} URLs, including ${Object.keys(manifest.sprites).length*4} animation strips, all 200.`);
