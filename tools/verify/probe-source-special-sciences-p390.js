'use strict';
// Read-only offsets into the original deobfuscated client. Source offsets are UTF-16 JS indices.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const file=path.join(root,'210(1)_unpacked/_analysis/deob_main.js');
const s=fs.readFileSync(file,'utf8');
if(process.argv[2]==='window'){
  const start=Number(process.argv[3]),length=Number(process.argv[4]);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(length)||start<0||length<1||length>20000)process.exit(2);
  console.log(s.slice(start,start+length));
  process.exit(0);
}
if(process.argv[2]==='offsets'){
  for(const id of [450021,450222,450322]){
    const hex='0x'+id.toString(16),offsets=[];
    let index=-1;
    while((index=s.indexOf(hex,index+1))!==-1)offsets.push(index);
    console.log(id+': '+offsets.join(', '));
  }
  process.exit(0);
}
if(process.argv[2]==='find'){
  const needle=process.argv[3];
  if(!needle||needle.length>100)process.exit(2);
  const offsets=[];
  let index=-1;
  while((index=s.indexOf(needle,index+1))!==-1)offsets.push(index);
  console.log(needle+': '+offsets.join(', '));
  process.exit(offsets.length?0:1);
}
const ids=[450021,450222,450322];
const out={source:path.relative(root,file),length:s.length,ids:{}};
for(const id of ids){
  const hex='0x'+id.toString(16),matches=[];
  let index=-1;
  while((index=s.indexOf(hex,index+1))!==-1){
    const begin=Math.max(0,index-210),end=Math.min(s.length,index+230);
    const before=s.slice(Math.max(0,index-1800),index);
    const keys=[...before.matchAll(/['"]key['"]\s*:\s*['"]([^'"]+)['"]/g)];
    matches.push({offset:index,nearestKey:keys.at(-1)?.[1]||null,
      context:s.slice(begin,end).replace(/\s+/g,' ').slice(0,450)});
  }
  out.ids[id]={hex,matches};
}
console.log(JSON.stringify(out,null,2));
