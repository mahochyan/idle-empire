'use strict';
// Electric Age civic hall geometry study. This is an editable 3D source only;
// the game does not load it. Reference-facing surfaces sample the existing
// panorama while separate solids make the clock dome, coils, and roof volumes.
(() => {
  const W=1024,H=525;
  const stage=document.getElementById('stage');
  const status=document.getElementById('status');
  const query=new URLSearchParams(location.search);
  const yaw=Math.max(-8,Math.min(8,Number(query.get('yaw')||0)));
  const clay=query.get('mode')==='clay';
  const originalUrl='../../../assets/art/scene/town-sci_electric_age.png';
  const cleanUrl='../../../assets/art/scene/candidates/town-sci_electric_age-clean-candidate.png';
  function fit(){stage.style.transform=`translate(-50%,-50%) scale(${Math.max(innerWidth/W,innerHeight/H)})`;}
  addEventListener('resize',fit);fit();
  if(query.get('mode')==='original'){
    const image=new Image();image.src=originalUrl;stage.append(image);
    image.onload=()=>{status.textContent='电气时代原画';document.documentElement.dataset.ready='1';};
    image.onerror=()=>{document.documentElement.dataset.error='original image';};
    return;
  }
  if(!window.THREE){document.documentElement.dataset.error='Three.js';return;}
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.setSize(W,H);renderer.outputEncoding=THREE.LinearEncoding;
  stage.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xc5dcd2);
  const camera=new THREE.OrthographicCamera(-W/2,W/2,H/2,-H/2,1,2000);
  camera.position.set(W/2,H/2,1000);camera.lookAt(W/2,H/2,0);
  const load=url=>new Promise((resolve,reject)=>new THREE.TextureLoader().load(url,resolve,undefined,reject));
  Promise.all([load(originalUrl),load(cleanUrl)]).then(([original,clean])=>{
    for(const texture of [original,clean]){
      texture.encoding=THREE.LinearEncoding;
      texture.minFilter=texture.magFilter=THREE.LinearFilter;
    }
    // The cleared center is already feathered into the original outside the
    // hall. The fade lets the reference view retain uncovered painted details.
    const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.ShaderMaterial({
      uniforms:{original:{value:original},clean:{value:clean},fade:{value:Math.min(1,.04+Math.abs(yaw)/8)}},
      vertexShader:'varying vec2 u;void main(){u=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform sampler2D original,clean;uniform float fade;varying vec2 u;
        float oval(vec2 p,vec2 c,vec2 r){vec2 q=(p-c)/r;return 1.-smoothstep(.72,1.08,dot(q,q));}
        void main(){vec2 p=vec2(u.x*1024.,(1.-u.y)*525.);
          float mainHall=oval(p,vec2(518.,205.),vec2(110.,80.));
          float tower=oval(p,vec2(518.,127.),vec2(43.,75.));
          float leftWing=oval(p,vec2(436.,216.),vec2(42.,58.));
          float rightWing=oval(p,vec2(598.,216.),vec2(45.,58.));
          float steps=oval(p,vec2(518.,265.),vec2(47.,32.));
          float coilLeft=oval(p,vec2(415.,139.),vec2(21.,35.));
          float coilRight=oval(p,vec2(631.,139.),vec2(21.,35.));
          float mask=max(max(max(mainHall,tower),max(leftWing,rightWing)),
            max(steps,max(coilLeft,coilRight)));
          gl_FragColor=mix(texture2D(original,u),texture2D(clean,u),fade*mask);
        }`
    }));
    backdrop.position.set(W/2,H/2,-40);scene.add(backdrop);
    const pivot=new THREE.Group();pivot.position.set(518,H-212,0);scene.add(pivot);
    const building=new THREE.Group();building.position.set(-518,-(H-212),0);pivot.add(building);
    pivot.rotation.y=yaw*Math.PI/180;

    const lightDir=new THREE.Vector3(-.50,.69,.54).normalize();
    const vertexShader='varying vec2 vUv;varying vec3 vNormal;void main(){vUv=uv;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
    const fragmentShader='uniform sampler2D atlas;uniform vec3 lightDir;varying vec2 vUv;varying vec3 vNormal;void main(){vec3 c=texture2D(atlas,vUv).rgb;float k=.93+.07*max(0.,dot(normalize(vNormal),lightDir));gl_FragColor=vec4(c*k,1.);}';
    const projected=new THREE.ShaderMaterial({uniforms:{atlas:{value:original},lightDir:{value:lightDir}},vertexShader,fragmentShader,side:THREE.DoubleSide});
    const sideStone=new THREE.MeshLambertMaterial({color:0xe4d8bc,side:THREE.DoubleSide});
    const darkStone=new THREE.MeshLambertMaterial({color:0x817d71,side:THREE.DoubleSide});
    const roofBlue=new THREE.MeshLambertMaterial({color:0x255585,side:THREE.DoubleSide});
    const ridgeGold=new THREE.MeshLambertMaterial({color:0xc5a85c,side:THREE.DoubleSide});
    const copper=new THREE.MeshLambertMaterial({color:0xb16e3f,side:THREE.DoubleSide});
    const coilBlue=new THREE.MeshLambertMaterial({color:0x80d9fb,emissive:0x0b3450,side:THREE.DoubleSide});
    const clayMaterial=new THREE.MeshNormalMaterial({side:THREE.DoubleSide});
    const sunlight=new THREE.DirectionalLight(0xfff8e8,.9);sunlight.position.set(-250,220,430);scene.add(sunlight);
    scene.add(new THREE.AmbientLight(0xffffff,.65));
    const batches=new Map();
    const metrics={triangles:0,closedShells:0,openFacets:0,depthRange:[Infinity,-Infinity],roofNormals:[],facadeFaces:0};
    const uv=p=>[p[0]/W,1-p[1]/H];
    function surface(name,points,material=projected,uvs){
      const pos=[],tex=[],ids=[];
      points.forEach((p,i)=>{
        pos.push(p[0],H-p[1],p[2]);
        tex.push(...(uvs?.[i]||uv(p)));
        metrics.depthRange[0]=Math.min(metrics.depthRange[0],p[2]);
        metrics.depthRange[1]=Math.max(metrics.depthRange[1],p[2]);
      });
      for(let i=1;i<points.length-1;i++)ids.push(0,i,i+1);
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));
      geometry.setIndex(ids);geometry.computeVertexNormals();
      const selected=clay?clayMaterial:material;
      if(!batches.has(selected))batches.set(selected,{pos:[],uv:[],normals:[]});
      const batch=batches.get(selected),normals=geometry.getAttribute('normal');
      for(const id of ids){
        batch.pos.push(...pos.slice(id*3,id*3+3));
        batch.uv.push(...tex.slice(id*2,id*2+2));
        batch.normals.push(normals.getX(id),normals.getY(id),normals.getZ(id));
      }
      geometry.dispose();metrics.triangles+=points.length-2;
      if(material===projected)metrics.facadeFaces++;
      return name;
    }
    function shell(name,front,back,side=sideStone,face=projected){
      if(front.length!==back.length)throw Error('Mismatched rings '+name);
      surface(name+' face',front,face);
      surface(name+' rear',back,side);
      for(let i=0;i<front.length;i++){
        const j=(i+1)%front.length;
        surface(name+' thickness '+i,[front[i],front[j],back[j],back[i]],side);
      }
      metrics.closedShells++;
    }
    function roof(name,face,backShift=[0,3,-8]){
      const back=face.map(([x,y,z])=>[x+backShift[0],y+backShift[1],z+backShift[2]]);
      shell(name,face,back,roofBlue);
      const a=new THREE.Vector3(...face[0]),b=new THREE.Vector3(...face[1]),c=new THREE.Vector3(...face[2]);
      const normal=b.sub(a).cross(c.sub(a)).normalize();
      metrics.roofNormals.push([normal.x,normal.y,normal.z]);
    }
    function block(name,x0,y0,x1,y1,zFront,zBack,shiftY=29){
      shell(name,
        [[x0,y0,zFront],[x1,y0,zFront],[x1,y1,zFront],[x0,y1,zFront]],
        [[x0+8,y0-shiftY,zBack],[x1-8,y0-shiftY,zBack],[x1-8,y1-shiftY,zBack],[x0+8,y1-shiftY,zBack]],projected);
    }
    function rail(name,x0,y0,x1,y1,z,depth=6,material=ridgeGold){
      shell(name,[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]],
        [[x0,y0+2,z-depth],[x1,y0+2,z-depth],[x1,y1+2,z-depth],[x0,y1+2,z-depth]],material);
    }
    function prism(name,cx,yTop,yBottom,cz,rx,rz,side=sideStone,face=projected,n=8){
      const top=[],bottom=[];
      for(let i=0;i<n;i++){
        const a=2*Math.PI*i/n+Math.PI/8;
        const x=cx+rx*Math.cos(a),z=cz+rz*Math.sin(a);
        top.push([x,yTop,z]);bottom.push([x,yBottom,z]);
      }
      for(let i=0;i<n;i++){
        const j=(i+1)%n;
        surface(name+' wall '+i,[top[i],top[j],bottom[j],bottom[i]],
          zFacing(top[i],top[j],cz)?face:side);
      }
      surface(name+' top',top,side);
      surface(name+' bottom',[...bottom].reverse(),side);
      metrics.closedShells++;
      return top;
    }
    function zFacing(a,b,cz){return a[2]+b[2]>=2*cz;}
    // A symmetrical civic base, two projecting wings and a forward portico.
    // This is deliberately a different silhouette from the iron stone hall:
    // the tall dome, paired roofed wings, colonnade and four electric coils
    // are independent 3D volumes that remain visible when the view turns.
    block('rear civic hall',450,153,584,232,69,18,27);
    block('left pavilion',416,185,476,236,69,17,26);
    block('right pavilion',564,185,623,236,69,17,26);
    block('projecting front portico',472,198,564,247,88,47,14);
    shell('portico triangular pediment',
      [[476,198,91],[518,174,91],[560,198,91]],
      [[479,196,51],[518,172,51],[557,196,51]],sideStone);
    roof('main hall left blue pitch',[[447,166,72],[477,137,24],[518,142,24],[519,169,76]]);
    roof('main hall right blue pitch',[[519,169,76],[518,142,24],[557,137,24],[589,166,72]]);
    roof('main hall rear blue pitch',[[477,137,24],[557,137,24],[581,151,4],[449,151,4]]);
    roof('left pavilion front blue pitch',[[410,186,68],[440,158,23],[477,183,70],[467,196,77]]);
    roof('left pavilion rear blue pitch',[[420,187,12],[447,156,15],[477,183,70],[447,179,45]]);
    roof('right pavilion front blue pitch',[[568,183,70],[597,157,23],[627,186,68],[578,196,77]]);
    roof('right pavilion rear blue pitch',[[568,183,70],[599,157,15],[620,185,12],[597,179,45]]);
    rail('left cornice',443,165,488,171,80,8,ridgeGold);
    rail('right cornice',549,165,593,171,80,8,ridgeGold);
    rail('portico lintel',470,198,566,205,92,8,ridgeGold);

    // Clock tower is a closed eight-sided masonry drum with a segmented,
    // outward-curving cobalt dome. Each dome facet has its own slope normal.
    prism('clock tower masonry drum',518,97,184,48,22,20,sideStone);
    rail('tower gold base cornice',491,179,546,186,78,10,ridgeGold);
    rail('tower blue belt',494,101,543,106,77,7,roofBlue);
    const n=8,domeRings=[
      {y:67,rx:2,rz:2},{y:72,rx:11,rz:10},
      {y:82,rx:20,rz:17},{y:98,rx:24,rz:21}
    ];
    const rings=domeRings.map(r=>Array.from({length:n},(_,i)=>{
      const a=2*Math.PI*i/n+Math.PI/8;
      return [518+r.rx*Math.cos(a),r.y,48+r.rz*Math.sin(a)];
    }));
    for(let k=0;k<rings.length-1;k++)for(let i=0;i<n;i++){
      const j=(i+1)%n;
      roof('cobalt clock dome '+k+' '+i,
        [rings[k][i],rings[k][j],rings[k+1][j],rings[k+1][i]],[0,2,-5]);
    }
    prism('clock face raised housing',518,131,158,76,14,4,sideStone,projected,12);
    rail('clock crown finial',515,62,521,70,49,5,ridgeGold);

    // A regular ivory colonnade creates 3D read even at 320 CSS px. Its
    // columns sit in front of the painted arches rather than replacing them.
    for(const x of [480,498,538,556]){
      rail('portico column '+x,x-3,203,x+3,241,96,8,sideStone);
      rail('column capital '+x,x-6,200,x+6,205,99,8,ridgeGold);
    }
    rail('portico door bronze sill',504,237,533,242,101,5,ridgeGold);
    for(const x of [446,596]){
      block('corner turret '+x,x-12,187,x+12,231,77,40,15);
      roof('corner turret left cap '+x,[[x-15,187,80],[x,170,47],[x,186,89]]);
      roof('corner turret right cap '+x,[[x,186,89],[x,170,47],[x+15,187,80]]);
    }
    for(let i=0;i<6;i++){
      const y=245+i*5.5,w=27+i*1.7,z=94-i*8;
      shell('wide civic staircase '+(i+1),
        [[518-w,y,z],[518+w,y,z],[519+w,y+5,z],[517-w,y+5,z]],
        [[518-w,y+2,z-6],[518+w,y+2,z-6],[519+w,y+7,z-6],[517-w,y+7,z-6]],sideStone);
    }
    for(const x of [458,578]){
      rail('cobalt banner bracket '+x,x-7,207,x+7,210,92,4,ridgeGold);
      surface('cobalt banner cloth '+x,
        [[x-7,209,96],[x+7,209,96],[x+7,244,96],[x,239,96],[x-7,244,96]],projected);
      metrics.openFacets++;
    }
    // Four blue ceramic high-voltage insulators. The original has two tall
    // rear pylons and two short foreground coils; each has a copper spindle
    // and three separate raised rings with closed cylindrical mesh.
    for(const [label,x,y,z,scale] of [
      ['rear left',414,117,34,1],['rear right',632,117,32,1],
      ['front left',462,229,105,.72],['front right',581,229,104,.72]
    ]){
      prism(label+' copper spindle',x,y,y+32*scale,z,4*scale,4*scale,copper,copper);
      for(let ring=0;ring<3;ring++){
        const top=y+5*scale+ring*8*scale;
        prism(label+' blue ceramic ring '+ring,x,top,top+5*scale,z,
          9*scale,7*scale,coilBlue,coilBlue);
      }
      prism(label+' gold cap',x,y-2*scale,y+3*scale,z,
        5*scale,5*scale,ridgeGold,ridgeGold);
    }
    for(const [name,a,b] of [
      ['left copper lead',[431,128,38],[450,139,44]],
      ['right copper lead',[588,139,44],[616,127,38]]
    ]){
      shell(name,[[a[0],a[1],a[2]],[b[0],b[1],b[2]],
        [b[0],b[1]+2,b[2]],[a[0],a[1]+2,a[2]]],
      [[a[0],a[1]+1,a[2]-3],[b[0],b[1]+1,b[2]-3],
        [b[0],b[1]+3,b[2]-3],[a[0],a[1]+3,a[2]-3]],copper,copper);
    }
    for(const [material,batch] of batches){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.pos,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uv,2));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));
      building.add(new THREE.Mesh(geometry,material));
    }
    const referenceCanvas=document.createElement('canvas');referenceCanvas.width=W;referenceCanvas.height=H;
    referenceCanvas.getContext('2d',{willReadFrequently:true}).drawImage(original.image,0,0);
    const reference=referenceCanvas.getContext('2d').getImageData(0,0,W,H).data;
    function renderPixels(){
      renderer.render(scene,camera);
      const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
      const context=canvas.getContext('2d',{willReadFrequently:true});
      context.drawImage(renderer.domElement,0,0);
      return context.getImageData(0,0,W,H).data;
    }
    function difference(a,b,accept){
      let sum=0,count=0;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        if(!accept(x,y))continue;
        const i=4*(y*W+x);
        sum+=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
        count++;
      }
      return sum/count;
    }
    const roi=(x,y)=>x>=350&&x<=690&&y>=42&&y<=355;
    const rendered=renderPixels();metrics.drawCalls=renderer.info.render.calls;
    const pixelDifference={all:difference(reference,rendered,()=>true),
      roi:difference(reference,rendered,roi),outside:difference(reference,rendered,(x,y)=>!roi(x,y))};
    lightDir.set(.50,.69,.54).normalize();sunlight.position.x=250;
    const opposite=renderPixels();
    const lightDifference=difference(rendered,opposite,roi);
    lightDir.set(-.50,.69,.54).normalize();sunlight.position.x=-250;renderer.render(scene,camera);
    const result={...metrics,yaw,pixelDifference,lightDifference,meshBatches:batches.size,
      roofSlopes:metrics.roofNormals.length};
    window.prototypeMetrics=result;
    document.documentElement.dataset.metrics=encodeURIComponent(JSON.stringify(result));
    status.textContent=`电气时代实体 ${yaw}° · ${result.triangles} 面 · 主楼差 ${pixelDifference.roi.toFixed(1)}`;
    document.documentElement.dataset.ready='1';
  }).catch(error=>{console.error(error);status.textContent='模型失败';document.documentElement.dataset.error=String(error);});
})();
