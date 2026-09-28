'use strict';
// Isolated Gold Age study: solid geometry with projective paint from the
// existing panorama. The game does not import this candidate.
(() => {
  const W = 1024, H = 525;
  const stage = document.getElementById('stage');
  const status = document.getElementById('status');
  const query = new URLSearchParams(location.search);
  const yaw = Math.max(-8, Math.min(8, Number(query.get('yaw') || 0)));
  const refine = true;
  const edgeMask = false;
  const clayMode = query.get('mode') === 'clay';
  const lightSide = query.get('light') === 'right' ? 1 : -1;
  const originalUrl = '../../../assets/art/scene/town-sci_gold_age.png';
  const cleanUrl = '../../../assets/art/scene/candidates/town-sci_gold_age-clean-candidate.png';
  const roofUrl = '../../../assets/art/source/models/projective_gold/gold-material-atlas-master.png';
  function fit() {
    const scale = Math.max(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }
  addEventListener('resize', fit);
  fit();
  if (query.get('mode') === 'original') {
    const image = new Image(); image.src = originalUrl; stage.append(image);
    image.onload = () => { status.textContent = '当前原画'; document.documentElement.dataset.ready = '1'; };
    image.onerror = () => { document.documentElement.dataset.error = 'original'; };
    return;
  }
  if (!window.THREE) { document.documentElement.dataset.error = 'three'; return; }

  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.outputEncoding = THREE.LinearEncoding;
  stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b4d8cf');
  const camera = new THREE.OrthographicCamera(-W/2, W/2, H/2, -H/2, 1, 2000);
  camera.position.set(W/2, H/2, 1000);
  camera.lookAt(W/2, H/2, 0);
  const loader = new THREE.TextureLoader();
  const getTexture = url => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
  Promise.all([getTexture(originalUrl), getTexture(cleanUrl),
    getTexture(roofUrl)]).then(([original, clean, atlas]) => {
    for (const t of [original, clean, atlas]) {
      t.encoding = THREE.LinearEncoding;
      t.minFilter = t.magFilter = THREE.LinearFilter;
    }

    // Only the hall footprint uses the alternate cleared art. Outside the
    // feathered ellipse the actual shipped panorama is copied without drift.
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({
      uniforms: {original: {value: original}, clean: {value: clean},
        clearStrength: {value: refine ? .04 + .66*Math.abs(yaw)/8 : 1},
        edgeMask: {value: edgeMask ? 1 : 0},
        yawTurn: {value: Math.abs(yaw)/8}},
      vertexShader: `varying vec2 uv0; void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform sampler2D original,clean;
        uniform float clearStrength,edgeMask,yawTurn;varying vec2 uv0;
        void main(){vec2 p=vec2(uv0.x*1024.,(1.-uv0.y)*525.);
          float roof=length(vec2((p.x-525.)/96.,(p.y-107.)/89.));
          float yard=length(vec2((p.x-525.)/139.,(p.y-158.)/83.));
          float entry=length(vec2((p.x-526.)/56.,(p.y-207.)/42.));
          float w=max(max(1.-smoothstep(.83,1.,roof),
            1.-smoothstep(.87,1.,yard)),1.-smoothstep(.77,1.,entry));
          float core=max(1.-smoothstep(.60,.84,roof),
            .75*(1.-smoothstep(.63,.86,yard)));
          float selectiveStrength=.04+yawTurn*(.34+.54*core);
          float strength=mix(clearStrength,selectiveStrength,edgeMask);
          gl_FragColor=mix(texture2D(original,uv0),texture2D(clean,uv0),w*strength);
        }`
    }));
    backdrop.position.set(W/2, H/2, -20);
    scene.add(backdrop);

    const pivot = new THREE.Group();
    pivot.position.set(512, H-216, 0);
    scene.add(pivot);
    const hall = new THREE.Group();
    hall.position.set(-512, -(H-216), 0);
    pivot.add(hall);
    pivot.rotation.y = yaw * Math.PI / 180;

    const uniforms = {
      original: {value: original},
      lightDir: {value: new THREE.Vector3(lightSide*.46, .63, .62).normalize()},
      lightStrength: {value: .13}
    };
    const surfaceVertex = `varying vec2 uv0;varying vec3 n0;
        void main(){uv0=uv;n0=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      surfaceFragment = `uniform sampler2D original;uniform vec3 lightDir;uniform float lightStrength;
        varying vec2 uv0;varying vec3 n0;
        void main(){vec3 c=texture2D(original,uv0).rgb;
          float lam=max(0.,dot(normalize(n0),lightDir));
          float shade=1.-lightStrength*.55+lightStrength*lam;
          gl_FragColor=vec4(c*shade,1.);
        }`;
    const surfaceMaterial = texture => new THREE.ShaderMaterial({
      uniforms:{original:{value:texture},lightDir:uniforms.lightDir,
        lightStrength:uniforms.lightStrength},
      side:THREE.DoubleSide,vertexShader:surfaceVertex,fragmentShader:surfaceFragment
    });
    const paint=surfaceMaterial(original);
    const roofPaint=surfaceMaterial(atlas);
    const wallPaint=surfaceMaterial(atlas);
    const warmWood = new THREE.MeshLambertMaterial({color: 0x9e652e, side: THREE.DoubleSide});
    const darkWood = new THREE.MeshLambertMaterial({color: 0x684421, side: THREE.DoubleSide});
    const roofEdge = new THREE.MeshLambertMaterial({color: 0xae8748, side: THREE.DoubleSide});
    const stone = new THREE.MeshLambertMaterial({color: 0xb6b09a, side: THREE.DoubleSide});
    const clay = new THREE.MeshNormalMaterial({side: THREE.DoubleSide});
    const sun = new THREE.DirectionalLight(0xffffff, .8);
    sun.position.set(lightSide*250, 190, 400); scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, .55));
    const metrics = {triangles: 0, shells: [], texturedFaces: 0, generatedFaces: 0,
      roofNormals: [], depthRange: [Infinity, -Infinity]};
    const batches = new Map();
    function vector(p) {return new THREE.Vector3(p[0], H-p[1], p[2]);}
    function projectedUV(p) {return [p[0]/W, 1-p[1]/H];}
    function surfaceUV(points,material) {
      // Stable local unwrap: vertical wood planks stay upright on side walls;
      // roof shingles follow the local slope. A small central portion of each
      // generated master keeps pattern scale legible in the 360px map.
      const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]), zs=points.map(p=>p[2]);
      const minX=Math.min(...xs), maxX=Math.max(...xs);
      const minY=Math.min(...ys), maxY=Math.max(...ys);
      const minZ=Math.min(...zs), maxZ=Math.max(...zs);
      const useX=maxX-minX>=maxZ-minZ;
      return points.map(p=>{
        const u=useX?(p[0]-minX)/Math.max(1,maxX-minX):
          (p[2]-minZ)/Math.max(1,maxZ-minZ);
        const v=(p[1]-minY)/Math.max(1,maxY-minY);
        return material===roofPaint?[.54+u*.42,.54+v*.42]:
          [.04+u*.42,.54+v*.42];
      });
    }
    function polygon(name, points, material=paint, uvs) {
      const positions=[], uv=[], indices=[];
      const localUVs=uvs||((material===roofPaint||material===wallPaint)?
        surfaceUV(points,material):null);
      points.forEach((p,i)=>{
        positions.push(p[0],H-p[1],p[2]);
        const coord=localUVs?localUVs[i]:projectedUV(p);
        uv.push(coord[0],coord[1]);
        metrics.depthRange[0]=Math.min(metrics.depthRange[0],p[2]);
        metrics.depthRange[1]=Math.max(metrics.depthRange[1],p[2]);
      });
      for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      geo.setIndex(indices);geo.computeVertexNormals();
      const key=clayMode?clay:material;
      if(!batches.has(key))batches.set(key,{positions:[],uvs:[],normals:[]});
      const batch=batches.get(key),normal=geo.getAttribute('normal');
      for(const index of indices){
        batch.positions.push(...positions.slice(index*3,index*3+3));
        batch.uvs.push(...uv.slice(index*2,index*2+2));
        batch.normals.push(normal.getX(index),normal.getY(index),normal.getZ(index));
      }
      geo.dispose();
      metrics.triangles+=points.length-2;
      if(material===paint)metrics.texturedFaces++;
      if(material===roofPaint||material===wallPaint)metrics.generatedFaces++;
      return name;
    }
    // Closed extruded polygon shell. Image coordinates describe the true
    // reference-view outline. Side and reverse faces are separate solid faces.
    function shell(name, front, back, sideMaterial, faceMaterial=paint) {
      if(front.length!==back.length)throw Error(name+' has mismatched shell rings');
      polygon(name+' visible paint',front,faceMaterial);
      polygon(name+' reverse',back,sideMaterial);
      for(let i=0;i<front.length;i++){
        const j=(i+1)%front.length;
        polygon(name+' thickness '+i,[front[i],front[j],back[j],back[i]],sideMaterial);
      }
      metrics.shells.push({name,vertices:front.length,closed:true,
        depthFront:front.map(p=>p[2]),depthBack:back.map(p=>p[2])});
    }
    function roof(name,front,thickness=7){
      const back=front.map(p=>[p[0],p[1]+3,p[2]-thickness]);
      shell(name,front,back,roofPaint);
      const normal=vector(front[1]).sub(vector(front[0])).cross(
        vector(front[2]).sub(vector(front[0]))).normalize();
      metrics.roofNormals.push([normal.x,normal.y,normal.z]);
    }

    // Open limestone forecourt; the fountain and garden remain in the 2D
    // background while the temple itself becomes volumetric.
    const rim=[[412,181,14],[447,148,14],[485,127,14],[568,127,14],
      [611,151,14],[639,185,14],[623,218,14],[569,236,14],
      [482,236,14],[426,218,14]];
    const inner=rim.map(p=>[525+(p[0]-525)*.73,180+(p[1]-180)*.72,14]);
    for(let i=0;i<rim.length;i++){
      const j=(i+1)%rim.length;
      const wedge=[rim[i],rim[j],inner[j],inner[i]];
      shell('stone courtyard segment '+i,wedge,
        wedge.map(p=>[p[0],p[1]+2,7]),stone);
    }

    // Gold-era civic hall: stone side wings, deep colonnade and a central
    // faceted blue dome. Front geometry samples the original panorama at the
    // reference camera; unseen side faces receive a distinct Gold atlas.
    shell('gold front wall',[[440,135,72],[614,135,72],[619,196,69],[436,196,69]],
      [[452,125,22],[603,125,22],[607,186,22],[448,186,22]],wallPaint);
    shell('gold left side wing',[[440,132,69],[462,107,32],[464,173,32],[436,194,69]],
      [[448,129,61],[469,106,25],[471,169,25],[444,191,61]],wallPaint);
    shell('gold right side wing',[[614,132,69],[590,106,32],[588,171,32],[619,194,69]],
      [[606,129,61],[583,105,25],[581,168,25],[611,191,61]],wallPaint);
    shell('central portico',[[474,132,82],[575,132,82],[578,190,82],[472,190,82]],
      [[478,128,66],[571,128,66],[573,184,66],[477,184,66]],wallPaint);
    roof('blue left wing',[[444,132,76],[468,100,28],[514,111,28],[477,149,99]],7);
    roof('blue right wing',[[573,149,99],[538,110,28],[588,101,28],[614,132,76]],7);
    // The dome is made from eight closed, separately angled facets. The
    // centre bows forward, so light from either side changes the visible
    // surface instead of merely tinting a flat painted disc.
    const domeRings=[
      {y:38,half:0,z:102},{y:54,half:20,z:95},
      {y:72,half:30,z:90},{y:91,half:36,z:82},
      {y:103,half:37,z:78}
    ];
    for(let i=0;i<domeRings.length-1;i++){
      const top=domeRings[i],bottom=domeRings[i+1];
      for(const side of [-1,1]){
        const face=[
          [526,top.y,top.z+6],
          [526+side*top.half,top.y,top.z-4],
          [526+side*bottom.half,bottom.y,bottom.z-4],
          [526,bottom.y,bottom.z+6]
        ];
        // A zero-width top edge is a triangle, avoiding duplicate vertices.
        if(!top.half)face.splice(1,1);
        shell('blue dome facet '+i+' '+side,face,
          face.map(p=>[p[0],p[1]+3,p[2]-36]),roofPaint);
      }
    }
    shell('dome drum',[[488,97,75],[565,97,75],[567,121,72],[486,121,72]],
      [[492,94,33],[561,94,33],[562,117,33],[490,117,33]],wallPaint);
    // Two smaller turrets use distinct closed roofs to preserve the source
    // silhouette's left and right blue accents.
    for(const [x,topY] of [[466,96],[589,99]]){
      shell('small blue turret '+x,
        [[x,topY,69],[x+14,topY+15,67],[x+13,topY+29,65],
          [x-13,topY+29,65],[x-14,topY+15,67]],
        [[x,topY+4,29],[x+12,topY+17,29],[x+12,topY+31,29],
          [x-12,topY+31,29],[x-12,topY+17,29]],roofPaint);
    }
    shell('limestone plinth',[[431,182,72],[626,182,72],[630,211,66],[427,211,66]],
      [[442,176,18],[615,176,18],[619,205,18],[438,205,18]],stone);

    // Shallow ceremonial steps descend toward the gold fountain.
    for(let i=0;i<6;i++){
      const y=188+i*4.6, half=23+i*1.2, z=78-i*5;
      shell('stone stair '+(i+1),
        [[526-half,y,z],[526+half,y,z],[526+half+1,y+4,z],[526-half-1,y+4,z]],
        [[526-half,y+1,z-5],[526+half,y+1,z-5],[526+half+1,y+5,z-5],[526-half-1,y+5,z-5]],stone);
    }
    for(const side of [-1,1]){
      const x=526+side*31;
      shell((side<0?'left':'right')+' stair cheek',
        [[x-3,188,77],[x+3,188,77],[x+4,220,46],[x-4,220,46]],
        [[x-3,190,70],[x+3,190,70],[x+4,222,39],[x-4,222,39]],stone);
    }
    // Arcaded front and slender portico columns; each has a closed back.
    for(const x of [476,492,510,542,560,576]){
      shell('gold portico column '+x,
        [[x-2.5,139,87],[x+2.5,139,87],[x+2.5,188,87],[x-2.5,188,87]],
        [[x-2.5,139,74],[x+2.5,139,74],[x+2.5,188,74],[x-2.5,188,74]],stone);
    }
    const goldRosette=[];
    for(let i=0;i<12;i++){
      const a=i*Math.PI*2/12;
      goldRosette.push([526+10*Math.cos(a),144+10*Math.sin(a),89]);
    }
    shell('gold rosette',goldRosette,goldRosette.map(p=>[p[0],p[1],p[2]-7]),roofEdge);
    // Banners are thin cloth decoration on the solid walls.
    for(const [x,y,w,h,z] of [[444,137,8,29,83],[608,140,8,29,83],
      [405,144,7,28,39],[650,151,7,26,39]]){
      polygon('cloth flag',[[x-w/2,y,z],[x+w/2,y,z],[x+w/2,y+h,z],[x-w/2,y+h,z]],paint);
    }
    for(const [material,batch] of batches){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));
      hall.add(new THREE.Mesh(geometry,material));
    }
    metrics.meshBatches=batches.size;

    const sample = () => {
      const source=document.createElement('canvas');source.width=W;source.height=H;
      const context=source.getContext('2d',{willReadFrequently:true});
      context.drawImage(renderer.domElement,0,0);
      return context.getImageData(0,0,W,H).data;
    };
    const meanDiff = (a,b,accept) => {
      let sum=0,count=0;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        if(!accept(x,y))continue;
        const i=4*(y*W+x);
        sum+=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
        count++;
      }
      return sum/count;
    };
    const roi=(x,y)=>x>=350&&x<=675&&y>=90&&y<=360;
    const source=document.createElement('canvas');source.width=W;source.height=H;
    const sourceContext=source.getContext('2d',{willReadFrequently:true});
    sourceContext.drawImage(original.image,0,0);
    const reference=sourceContext.getImageData(0,0,W,H).data;
    renderer.render(scene,camera);
    const rendered=sample();
    metrics.drawCalls=renderer.info.render.calls;
    const pixelDifference={
      all:meanDiff(reference,rendered,()=>true),
      roi:meanDiff(reference,rendered,roi),
      outside:meanDiff(reference,rendered,(x,y)=>!roi(x,y))
    };
    uniforms.lightDir.value.set(-lightSide*.46,.63,.62).normalize();
    sun.position.x=-sun.position.x;
    renderer.render(scene,camera);
    const oppositeLight=sample();
    const lightDifference=meanDiff(rendered,oppositeLight,roi);
    const domeRoi=(x,y)=>x>=482&&x<=572&&y>=32&&y<=110;
    const domeLightDifference=meanDiff(rendered,oppositeLight,domeRoi);
    uniforms.lightDir.value.set(lightSide*.46,.63,.62).normalize();
    sun.position.x=-sun.position.x;
    renderer.render(scene,camera);
    const setLight=x=>{
      const side=Math.max(-1,Math.min(1,x));
      uniforms.lightDir.value.set(side*.46,.63,.62).normalize();
      sun.position.x=side*250;
      renderer.render(scene,camera);
    };
    stage.addEventListener('pointermove',event=>{
      const bounds=stage.getBoundingClientRect();
      setLight(2*(event.clientX-bounds.left)/bounds.width-1);
    });
    window.setPrototypeLight=setLight;
    const result={...metrics,yaw,lightSide,refine,pixelDifference,lightDifference,
      domeLightDifference,
      closedShells:metrics.shells.length,realRoofSlopes:2,
      geometry:'closed 3D shells + roof planes, wall depth, posts and stairs'};
    window.prototypeMetrics=result;
    document.documentElement.dataset.metrics=encodeURIComponent(JSON.stringify({
      triangles:result.triangles,closedShells:result.closedShells,
      texturedFaces:result.texturedFaces,generatedFaces:result.generatedFaces,
      roofNormals:result.roofNormals,
      depthRange:result.depthRange,meshBatches:result.meshBatches,
      drawCalls:result.drawCalls,pixelDifference,lightDifference,
      domeLightDifference,yaw,lightSide
    }));
    status.textContent=`主楼实体 ${yaw}° · ${result.triangles} 面 · 差 ${pixelDifference.all.toFixed(1)}/${pixelDifference.roi.toFixed(1)}`;
    document.documentElement.dataset.ready='1';
  }).catch(error=>{console.error(error);status.textContent='样板失败';document.documentElement.dataset.error=String(error);});
})();
