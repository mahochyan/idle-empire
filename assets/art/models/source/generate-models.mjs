// Editable low-poly landmark source. Rebuild with:
// node assets/art/models/source/generate-models.mjs
// All geometry is original, local Y-up, ground y=0, front toward +Z.
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const out=join(dirname(fileURLToPath(import.meta.url)),'..');
mkdirSync(out,{recursive:true});
const P={
  chalk:'#eee7cb',ivory:'#fff1d5',sand:'#d9c194',sandLight:'#e9d3ab',
  terra:'#c5795a',terraHi:'#e9a276',wood:'#896343',woodHi:'#bd9061',
  slate:'#607587',slateHi:'#9aabb1',blue:'#608ca6',blueHi:'#9bc8cb',
  grass:'#89a874',grassHi:'#b8cb83',leaf:'#5d8d6b',hay:'#d8ba67',
  gold:'#e3bb69',goldHi:'#ffe5a0',ink:'#314854',stone:'#a7aaa0',
  copper:'#ba7652',iron:'#667d84',silver:'#d8e0d5',red:'#bb6554',
  shadow:'#45545a',void:'#283c45',teal:'#6eb7ad',pink:'#eaa48e'
};
const cubes=[];
const cube=(x,y,z,w,h,d,c,rz=0)=>cubes.push({x,y,z,w,h,d,c,rz});
const roof=(x,y,z,w,d,c)=>{
  cube(x-w*.27,y,z,w*.65,.12,d,c,.38);
  cube(x+w*.27,y,z,w*.65,.12,d,c,-.38);
  cube(x,y+.18,z,.10,.10,d,P.woodHi);
};
const foundation=(w,d)=>cube(0,.08,0,w,.16,d,P.stone);
const window=(x,y,z)=>{cube(x,y,z,.24,.31,.04,P.ink);cube(x,y,z+.03,.15,.22,.04,P.goldHi);};
const door=(x,y,z,w=.42)=>{cube(x,y,z,w,.76,.05,P.ink);cube(x,y,z+.04,w-.07,.69,.04,P.wood);cube(x+w*.25,y,z+.09,.05,.06,.04,P.gold);};
const flag=(x,y,z,c)=>{cube(x,y,z,.055,1.3,.055,P.wood);cube(x+.23,y+.43,z,.46,.26,.055,c);cube(x+.43,y+.43,z,.11,.11,.06,P.goldHi);};
const rock=(x,y,z,s,c=P.stone)=>{cube(x,y+s*.23,z,s,s*.5,s*.75,c);cube(x-s*.16,y+s*.52,z-.08*s,s*.62,s*.24,s*.5,P.slateHi);};
const tree=(x,z,s=1)=>{cube(x,.45*s,z,.19*s,.9*s,.20*s,P.wood);cube(x,1.03*s,z,.8*s,.8*s,.7*s,P.leaf);cube(x-.08*s,1.37*s,z,.5*s,.35*s,.5*s,P.grassHi);};

const scenes={
  town_hall(){
    foundation(2.45,1.95);
    cube(0,.78,0,1.9,1.35,1.35,P.chalk);roof(0,1.57,0,2.12,1.57,P.terra);
    cube(0,1.95,-.35,.54,.92,.54,P.chalk);roof(0,2.48,-.35,.70,.75,P.terra);
    cube(0,2.06,-.05,.31,.31,.045,P.wood);cube(0,2.06,-.02,.21,.21,.045,P.goldHi);
    door(0,.52,.705,.46);window(-.64,.9,.705);window(.64,.9,.705);
    for(const x of [-.91,.91])cube(x,.72,.74,.15,1.24,.15,P.ivory);
    cube(0,.18,1.05,.65,.13,.5,P.sandLight);flag(1.08,1.33,-.42,P.red);
  },
  lumber_yard(){
    foundation(2.5,1.9);
    cube(.31,.67,-.19,1.35,1.06,1.18,P.woodHi);roof(.31,1.28,-.19,1.57,1.42,P.leaf);
    door(.28,.49,.43,.42);window(.72,.83,.43);
    for(const [x,z] of [[-.88,-.55],[-.88,-.25],[-.88,.05],[-.88,.35]]){
      cube(x,.28,z,.7,.19,.21,P.wood);cube(x-.27,.29,z+.12,.08,.13,.04,P.hay);
    }
    cube(.93,1.3,-.57,.17,.67,.17,P.slate);cube(.93,1.68,-.57,.36,.1,.32,P.silver);
    cube(-.67,.24,.72,.72,.15,.26,P.wood);
  },
  quarry_yard(){
    foundation(2.55,1.95);
    cube(0,.37,-.18,1.5,.51,.9,P.slate);cube(0,.51,-.15,.78,.46,.32,P.void);
    for(const [x,y,z,s] of [[-.82,.05,.43,.58],[-.43,.05,.67,.36],[.83,.05,.51,.53],[.73,.05,-.57,.4]])rock(x,y,z,s);
    for(const x of [-.77,.77])cube(x,.93,-.25,.13,1.69,.13,P.wood);
    cube(0,1.73,-.25,1.68,.13,.13,P.woodHi);
    cube(0,1.35,-.25,.045,.68,.045,P.ink);cube(0,.92,-.25,.34,.20,.33,P.stone);
    cube(.94,.23,-.75,.58,.24,.44,P.sand);
  },
  farm_yard(){
    foundation(2.8,2.05);
    cube(.52,.60,-.25,1.13,1.01,1.14,P.chalk);roof(.52,1.20,-.25,1.36,1.34,P.terra);
    door(.5,.43,.35,.39);window(.82,.83,.35);
    for(let z=-.64;z<=.68;z+=.39){
      cube(-.74,.20,z,.85,.10,.18,P.sand);
      for(const x of [-1.04,-.77,-.5]){cube(x,.43,z,.08,.37,.08,P.leaf);cube(x,.66,z,.17,.16,.14,P.hay);}
    }
    cube(1.02,.36,.56,.26,.48,.28,P.wood);cube(1.02,.66,.56,.30,.12,.31,P.gold);
  },
  academy(){
    foundation(2.55,1.95);
    cube(0,.83,0,1.85,1.36,1.28,P.ivory);roof(0,1.63,0,2.10,1.5,P.blue);
    cube(0,1.98,-.3,.62,.69,.59,P.ivory);cube(0,2.35,-.3,.75,.15,.75,P.slate);
    cube(0,2.72,-.3,.23,.6,.23,P.gold);cube(0,3.02,-.3,.47,.10,.10,P.gold);
    door(0,.54,.665,.49);window(-.62,1.02,.665);window(.62,1.02,.665);
    cube(-.94,.76,.67,.15,1.23,.14,P.silver);cube(.94,.76,.67,.15,1.23,.14,P.silver);
    cube(0,.21,.91,.79,.13,.38,P.sandLight);
  },
  barracks(){
    foundation(2.65,2.0);
    cube(0,.63,-.25,1.82,.99,1.17,P.sandLight);roof(0,1.18,-.25,2.05,1.37,P.terra);
    door(.05,.42,.365,.45);window(-.54,.78,.365);window(.61,.78,.365);
    for(const [x,z] of [[-.92,.55],[.98,.56]]){cube(x,.34,z,.52,.45,.59,P.chalk);roof(x,.66,z,.62,.69,P.red);}
    flag(-1.1,.99,-.54,P.red);
    for(let x=-1.2;x<=1.2;x+=.4)cube(x,.30,-.93,.10,.54,.10,P.woodHi);
  },
  watch_tower(){
    foundation(1.65,1.65);
    cube(0,1.12,0,1.0,2.08,1.0,P.stone);cube(0,2.22,0,1.27,.18,1.27,P.slate);
    for(const x of [-.53,.53])for(const z of [-.53,.53])cube(x,2.43,z,.23,.45,.23,P.stone);
    door(0,.5,.525,.37);window(0,1.42,.525);
    cube(.51,2.84,-.2,.06,1.12,.06,P.wood);flag(.51,3.06,-.2,P.red);
    cube(-.54,.15,.65,.38,.14,.27,P.sandLight);cube(.54,.15,.65,.38,.14,.27,P.sandLight);
  },
  battle_props(){
    // One desert/savanna battle plate. Characters are separate billboards.
    cube(0,-.15,0,8,.28,5,P.sand);
    cube(0,.005,0,7.5,.025,4.55,P.sandLight);
    for(const [x,z,s] of [[-3.25,-1.6,.56],[2.9,-1.7,.72],[-2.8,1.6,.34],[3.3,1.52,.43]])rock(x,0,z,s);
    for(const [x,z] of [[-3.5,.9],[-2.5,-1.65],[1.9,1.9],[3.58,-.2]]){
      cube(x,.13,z,.07,.26,.08,P.leaf);cube(x-.09,.18,z,.15,.12,.11,P.grassHi);
    }
    flag(-2.85,.78,-1.88,P.red);flag(3.18,.78,-1.83,P.blue);
    cube(3.1,.46,-1.7,.78,.62,.74,P.chalk);roof(3.1,.83,-1.7,.9,.88,P.terra);
    cube(-3.1,.34,-1.55,.55,.53,.48,P.woodHi);
  }
};

const faces=[
  {n:[0,0,1],v:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]},
  {n:[0,0,-1],v:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]},
  {n:[-1,0,0],v:[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]},
  {n:[1,0,0],v:[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]},
  {n:[0,1,0],v:[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]},
  {n:[0,-1,0],v:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]}
];
const positions=[],normals=[],indices=[];
faces.forEach((f,i)=>{
  for(const v of f.v){positions.push(...v);normals.push(...f.n);}
  const a=i*4;indices.push(a,a+1,a+2,a,a+2,a+3);
});
function bytesFloat(data){const b=Buffer.alloc(data.length*4);data.forEach((v,i)=>b.writeFloatLE(v,i*4));return b;}
function bytesU16(data){const b=Buffer.alloc(data.length*2);data.forEach((v,i)=>b.writeUInt16LE(v,i*2));return b;}
const bin=Buffer.concat([bytesFloat(positions),bytesFloat(normals),bytesU16(indices)]);
const views=[
  {buffer:0,byteOffset:0,byteLength:positions.length*4,target:34962},
  {buffer:0,byteOffset:positions.length*4,byteLength:normals.length*4,target:34962},
  {buffer:0,byteOffset:(positions.length+normals.length)*4,byteLength:indices.length*2,target:34963}
];
const accessors=[
  {bufferView:0,componentType:5126,count:24,type:'VEC3',min:[-.5,-.5,-.5],max:[.5,.5,.5]},
  {bufferView:1,componentType:5126,count:24,type:'VEC3'},
  {bufferView:2,componentType:5123,count:36,type:'SCALAR',min:[0],max:[23]}
];
function material(hex){
  // glTF baseColorFactor is linear RGB. Hex palette values are authored in
  // sRGB, so encode the transfer function before serializing the material.
  const toLinear=c=>c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
  const v=[1,3,5].map(i=>toLinear(parseInt(hex.slice(i,i+2),16)/255));
  return {name:hex,pbrMetallicRoughness:{baseColorFactor:[...v,1],metallicFactor:0,roughnessFactor:1},doubleSided:false};
}
function glb(name,parts){
  const palette=[...new Set(parts.map(p=>p.c))];
  const meshes=palette.map((_,i)=>({primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2,material:i,mode:4}]}));
  const nodes=parts.map(p=>{
    const node={mesh:palette.indexOf(p.c),translation:[p.x,p.y,p.z],scale:[p.w,p.h,p.d]};
    if(p.rz)node.rotation=[0,0,Math.sin(p.rz/2),Math.cos(p.rz/2)];
    return node;
  });
  const doc={asset:{version:'2.0',generator:'Idle Empire editable low-poly landmarks'},
    scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,
    materials:palette.map(material),buffers:[{byteLength:bin.length}],
    bufferViews:views,accessors,extras:{landmark:name,up:'Y',front:'+Z',unit:'scene unit'}};
  const json=Buffer.from(JSON.stringify(doc));
  const jsonPad=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const binPad=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);
  const file=Buffer.alloc(12+8+jsonPad.length+8+binPad.length);
  file.write('glTF',0);file.writeUInt32LE(2,4);file.writeUInt32LE(file.length,8);
  file.writeUInt32LE(jsonPad.length,12);file.writeUInt32LE(0x4e4f534a,16);jsonPad.copy(file,20);
  const off=20+jsonPad.length;file.writeUInt32LE(binPad.length,off);file.writeUInt32LE(0x004e4942,off+4);binPad.copy(file,off+8);
  return file;
}
const manifest={version:1,source:'source/generate-models.mjs',coordinateSystem:'Y up, front +Z, ground y=0',models:{}};
for(const [name,draw] of Object.entries(scenes)){
  cubes.length=0;draw();
  writeFileSync(join(out,name+'.glb'),glb(name,cubes));
  manifest.models[name]={path:name+'.glb',parts:cubes.length,footprint:name==='battle_props'?[8,5]:[2.8,2.1]};
}
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Generated ${Object.keys(scenes).length} low-poly GLB landmarks.`);
