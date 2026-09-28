// Check authored GLBs against the static glTF subset parsed by hd2d.js.
// This is a preflight for candidate art; it does not change the game.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';

const defaultDirs=['assets/art/models','assets/art/models/candidates'];
const inputs=process.argv.slice(2);
const paths=(inputs.length?inputs:defaultDirs).flatMap(input=>{
  const path=resolve(input);
  return statSync(path).isDirectory()?
    readdirSync(path).filter(name=>name.endsWith('.glb')).map(name=>join(path,name)):[path];
});

function inspect(path){
  const file=readFileSync(path),header=new DataView(file.buffer,file.byteOffset,file.byteLength);
  const problems=[],warnings=[];
  if(file.length<20||header.getUint32(0,true)!==0x46546c67||header.getUint32(4,true)!==2){
    return {path,bytes:file.length,ok:false,problems:['invalid GLB header']};
  }
  if(header.getUint32(8,true)!==file.length)problems.push('header length differs from file length');
  let json,binLength=0,at=12;
  while(at+8<=file.length){
    const length=header.getUint32(at,true),type=header.getUint32(at+4,true);
    if(at+8+length>file.length){problems.push('truncated chunk');break;}
    if(type===0x4e4f534a){
      try{json=JSON.parse(file.subarray(at+8,at+8+length).toString('utf8').trim());}
      catch(error){problems.push('invalid JSON chunk: '+error.message);}
    }
    if(type===0x004e4942)binLength=length;
    at+=8+length;
  }
  if(!json||!binLength)return {path,bytes:file.length,ok:false,problems:[...problems,'missing JSON or BIN chunk']};
  if(json.asset?.version!=='2.0')problems.push('glTF asset version is not 2.0');
  if((json.buffers||[]).length!==1)problems.push('runtime supports one binary buffer');
  if((json.buffers?.[0]?.byteLength||0)>binLength)problems.push('declared buffer exceeds BIN chunk');
  const views=json.bufferViews||[],accessors=json.accessors||[];
  let triangles=0,primitives=0,materialTextures=0,textureBytes=0;
  const bytesPerComponent={5121:1,5123:2,5125:4,5126:4};
  const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  const testAccessor=(index,label)=>{
    const accessor=accessors[index];
    if(!accessor||accessor.bufferView==null){problems.push(label+' missing bufferView');return null;}
    const view=views[accessor.bufferView],width=bytesPerComponent[accessor.componentType],
      count=components[accessor.type];
    if(!view||view.buffer!==0||accessor.sparse||!width||!count){
      problems.push(label+' uses unsupported accessor');return null;
    }
    const stride=view.byteStride||width*count,offset=(accessor.byteOffset||0);
    if(!Number.isSafeInteger(accessor.count)||accessor.count<0||stride<width*count||
      offset+(Math.max(0,accessor.count-1)*stride)+width*count>view.byteLength||
      (view.byteOffset||0)+view.byteLength>binLength){
      problems.push(label+' exceeds buffer view');return null;
    }
    return accessor;
  };
  for(const [meshIndex,mesh] of (json.meshes||[]).entries()){
    for(const [primitiveIndex,primitive] of (mesh.primitives||[]).entries()){
      const label=`mesh ${meshIndex} primitive ${primitiveIndex}`;
      primitives++;
      if(primitive.mode!=null&&primitive.mode!==4)problems.push(label+' is not triangles');
      const pos=testAccessor(primitive.attributes?.POSITION,label+' POSITION');
      if(pos&&pos.type!=='VEC3')problems.push(label+' POSITION is not VEC3');
      if(primitive.attributes?.NORMAL!=null){
        const normal=testAccessor(primitive.attributes.NORMAL,label+' NORMAL');
        if(normal&&normal.type!=='VEC3')problems.push(label+' NORMAL is not VEC3');
      }
      if(primitive.attributes?.TEXCOORD_0!=null){
        const uv=testAccessor(primitive.attributes.TEXCOORD_0,label+' TEXCOORD_0');
        if(uv&&uv.type!=='VEC2')problems.push(label+' TEXCOORD_0 is not VEC2');
      }
      const indices=primitive.indices==null?null:testAccessor(primitive.indices,label+' indices');
      if(indices&&indices.type!=='SCALAR')problems.push(label+' indices are not SCALAR');
      const count=indices?.count||pos?.count||0;
      if(count%3)problems.push(label+' triangle index count is not divisible by 3');
      triangles+=Math.floor(count/3);
      const material=json.materials?.[primitive.material];
      const baseColorTexture=material?.pbrMetallicRoughness?.baseColorTexture;
      if(baseColorTexture){
        materialTextures++;
        if(primitive.attributes?.TEXCOORD_0==null)problems.push(label+' has a texture but no UV');
        if((baseColorTexture.texCoord||0)!==0)
          problems.push(label+' base color texture requires UV set '+baseColorTexture.texCoord);
      }
      for(const key of Object.keys(primitive.attributes||{})){
        if(!['POSITION','NORMAL','TEXCOORD_0'].includes(key))
          warnings.push(label+' attribute '+key+' is ignored by runtime');
      }
      if(primitive.targets?.length)problems.push(label+' morph targets are ignored by runtime');
    }
  }
  for(const [index,image] of (json.images||[]).entries()){
    const view=views[image.bufferView];
    if(!view||view.buffer!==0||!/^image\/(png|jpeg|webp)$/.test(image.mimeType||'')||
      !Number.isSafeInteger(view.byteLength)||view.byteLength<=0||view.byteLength>4194304||
      (view.byteOffset||0)+view.byteLength>binLength){
      problems.push('image '+index+' is not a supported embedded texture');
    }else textureBytes+=view.byteLength;
  }
  for(const [index,texture] of (json.textures||[]).entries()){
    if(!json.images?.[texture.source])problems.push('texture '+index+' lacks an image');
  }
  if((json.animations||[]).length)problems.push('animations are ignored by runtime');
  if((json.skins||[]).length)problems.push('skins are ignored by runtime');
  if((json.extensionsRequired||[]).length)problems.push('required glTF extensions are unsupported');
  if(triangles>30000)warnings.push('exceeds provisional 30,000-triangle full-scene mobile budget');
  if(file.length>4194304)warnings.push('exceeds provisional 4 MiB full-scene GLB budget');
  const nodes=json.nodes||[];
  const visit=(index,ancestors)=>{
    if(!nodes[index]){problems.push('scene references missing node '+index);return;}
    if(ancestors.has(index)){problems.push('node cycle at '+index);return;}
    const next=new Set(ancestors);next.add(index);
    if(nodes[index].mesh!=null&&!json.meshes?.[nodes[index].mesh])
      problems.push('node '+index+' references missing mesh');
    for(const child of nodes[index].children||[])visit(child,next);
  };
  const roots=json.scenes?.[json.scene||0]?.nodes;
  if(!roots?.length)problems.push('active scene has no root nodes');
  for(const root of roots||[])visit(root,new Set());
  return {path,bytes:file.length,triangles,primitives,images:json.images?.length||0,
    textureBytes,materialTextures,ok:problems.length===0,problems,warnings};
}

const results=paths.map(inspect);
for(const result of results){
  const label=result.path.replace(process.cwd()+'\\','').replace(process.cwd()+'/','');
  const summary=`${result.ok?'PASS':'FAIL'} ${label} | ${result.triangles??0} triangles | `+
    `${result.primitives??0} primitives | ${result.images??0} images | ${result.bytes} bytes`;
  console.log(summary);
  for(const issue of result.problems)console.log('  - '+issue);
  for(const warning of result.warnings||[])console.log('  ! '+warning);
}
console.log(`${results.filter(result=>result.ok).length}/${results.length} compatible with the current static GLB subset`);
if(results.some(result=>!result.ok))process.exitCode=1;
