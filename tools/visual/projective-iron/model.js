'use strict';
// Iron Age central hall geometry study. This is an editable 3D source only;
// the game does not load it. The daytime panorama and cleared lot are existing
// candidates. Front-facing surfaces keep the exact source image registration.
(() => {
  const W=1024,H=525;
  const stage=document.getElementById('stage');
  const status=document.getElementById('status');
  const query=new URLSearchParams(location.search);
  const yaw=Math.max(-8,Math.min(8,Number(query.get('yaw')||0)));
  const clay=query.get('mode')==='clay';
  const originalUrl='../../../assets/art/scene/town-sci_iron_age.png';
  const cleanUrl='../../../assets/art/scene/candidates/town-sci_iron_age-clean-candidate.png';
  function fit(){stage.style.transform=`translate(-50%,-50%) scale(${Math.max(innerWidth/W,innerHeight/H)})`;}
  addEventListener('resize',fit);fit();
  if(query.get('mode')==='original'){
    const image=new Image();image.src=originalUrl;stage.append(image);
    image.onload=()=>{status.textContent='铁时代原画';document.documentElement.dataset.ready='1';};
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
          float mainHall=oval(p,vec2(512.,211.),vec2(114.,76.));
          float tower=oval(p,vec2(512.,146.),vec2(43.,62.));
          float leftWing=oval(p,vec2(415.,216.),vec2(65.,57.));
          float rightWing=oval(p,vec2(607.,216.),vec2(62.,57.));
          float steps=oval(p,vec2(512.,268.),vec2(43.,28.));
          float mask=max(max(max(mainHall,tower),max(leftWing,rightWing)),steps);
          gl_FragColor=mix(texture2D(original,u),texture2D(clean,u),fade*mask);
        }`
    }));
    backdrop.position.set(W/2,H/2,-40);scene.add(backdrop);
    const pivot=new THREE.Group();pivot.position.set(512,H-215,0);scene.add(pivot);
    const building=new THREE.Group();building.position.set(-512,-(H-215),0);pivot.add(building);
    pivot.rotation.y=yaw*Math.PI/180;

    const lightDir=new THREE.Vector3(-.50,.69,.54).normalize();
    const vertexShader='varying vec2 vUv;varying vec3 vNormal;void main(){vUv=uv;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
    const fragmentShader='uniform sampler2D atlas;uniform vec3 lightDir;varying vec2 vUv;varying vec3 vNormal;void main(){vec3 c=texture2D(atlas,vUv).rgb;float k=.93+.07*max(0.,dot(normalize(vNormal),lightDir));gl_FragColor=vec4(c*k,1.);}';
    const projected=new THREE.ShaderMaterial({uniforms:{atlas:{value:original},lightDir:{value:lightDir}},vertexShader,fragmentShader,side:THREE.DoubleSide});
    const sideStone=new THREE.MeshLambertMaterial({color:0xd6c7a2,side:THREE.DoubleSide});
    const darkStone=new THREE.MeshLambertMaterial({color:0x817861,side:THREE.DoubleSide});
    const roofBlue=new THREE.MeshLambertMaterial({color:0x2a5876,side:THREE.DoubleSide});
    const ridgeGold=new THREE.MeshLambertMaterial({color:0xb9a060,side:THREE.DoubleSide});
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

    // Three real hall volumes: long civic center and asymmetric side wings.
    // Unlike the older timber longhouse, each wing has a hipped blue slate roof.
    block('central masonry nave',426,185,599,252,73,17,29);
    block('left civic wing',382,204,466,250,64,13,27);
    block('right civic wing',566,204,643,248,63,12,28);
    shell('central sandstone pediment',
      [[472,184,81],[512,155,81],[553,184,81]],
      [[477,164,23],[512,136,23],[549,164,23]],sideStone);
    // Each roof facet is thick, separately closed, and has a distinct normal.
    roof('main roof front pitch',[[426,183,75],[470,155,31],[553,155,31],[599,183,74]]);
    roof('main roof rear pitch',[[449,179,5],[575,179,5],[553,155,31],[470,155,31]]);
    roof('left wing north pitch',[[375,200,61],[401,177,20],[436,178,20],[462,202,68]]);
    roof('left wing south pitch',[[375,200,61],[462,202,68],[453,216,76],[389,215,72]]);
    roof('right wing north pitch',[[566,201,69],[591,176,19],[622,177,19],[648,203,61]]);
    roof('right wing south pitch',[[566,201,69],[648,203,61],[638,217,73],[572,215,76]]);
    for(const [name,x0,y0,x1,y1] of [
      ['left main eave',425,181,512,184],['right main eave',512,184,602,181],
      ['left wing eave',374,202,461,204],['right wing eave',565,204,649,203]
    ])rail(name,x0,y0,x1,y1+4,87,8,ridgeGold);

    // Central blue-roofed eight-sided clock tower, not a 2D poster. The
    // eight wall panels, top and bottom caps form a closed octagonal prism.
    const n=8,cx=512,cz=51,rx=23,rz=20;
    const upper=[],lower=[];
    for(let i=0;i<n;i++){
      const a=2*Math.PI*i/n+Math.PI/8;
      const x=cx+rx*Math.cos(a),z=cz+rz*Math.sin(a);
      upper.push([x,137,z]);lower.push([x,198,z]);
    }
    for(let i=0;i<n;i++){
      const j=(i+1)%n;
      surface('tower wall '+i,[upper[i],upper[j],lower[j],lower[i]],projected);
    }
    surface('tower upper cap',upper,sideStone);
    surface('tower lower cap',[...lower].reverse(),darkStone);
    metrics.closedShells++;
    const domeTop=[512,108,51];
    const domeMid=upper.map(([x,,z])=>[512+(x-512)*.77,116,51+(z-51)*.77]);
    for(let i=0;i<n;i++){
      const j=(i+1)%n;
      // Two slope rings approximate the painted blue dome curvature.
      roof('tower dome upper '+i,[domeTop,domeMid[i],domeMid[j]],[0,2,-5]);
      roof('tower dome lower '+i,[domeMid[i],upper[i],upper[j],domeMid[j]],[0,2,-6]);
    }
    rail('tower cornice',486,132,538,139,76,10,ridgeGold);
    rail('tower clock arch',499,157,525,183,78,4,sideStone);
    rail('tower finial',509,101,515,110,57,3,ridgeGold);

    // A pair of low corner towers and the center stair are visible landmarks
    // at 320 CSS px. All piers/steps are closed solids with genuine thickness.
    for(const [side,x] of [['left',399],['right',615]]){
      block(side+' corner pier',x-12,191,x+12,235,73,40,14);
      roof(side+' corner cap left',[[x-16,190,76],[x,175,50],[x,190,83]]);
      roof(side+' corner cap right',[[x,190,83],[x,175,50],[x+16,190,76]]);
    }
    for(const x of [454,476,549,572]){
      rail('facade column '+x,x-3,202,x+3,246,79,7,sideStone);
    }
    for(let i=0;i<5;i++){
      const y=252+i*5.2,w=27+i*2.0,z=84-i*7;
      shell('front stair '+(i+1),
        [[512-w,y,z],[512+w,y,z],[512+w+1,y+5,z],[512-w-1,y+5,z]],
        [[512-w,y+2,z-6],[512+w,y+2,z-6],[512+w+1,y+7,z-6],[512-w-1,y+7,z-6]],sideStone);
    }
    for(const x of [450,574]){
      rail('banner bracket '+x,x-7,209,x+7,211,83,3,ridgeGold);
      surface('blue cloth banner '+x,
        [[x-7,210,87],[x+7,210,87],[x+7,250,87],[x,245,87],[x-7,250,87]],projected);
      metrics.openFacets++;
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
    const roi=(x,y)=>x>=320&&x<=700&&y>=60&&y<=365;
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
    status.textContent=`铁时代实体 ${yaw}° · ${result.triangles} 面 · 主楼差 ${pixelDifference.roi.toFixed(1)}`;
    document.documentElement.dataset.ready='1';
  }).catch(error=>{console.error(error);status.textContent='模型失败';document.documentElement.dataset.error=String(error);});
})();
