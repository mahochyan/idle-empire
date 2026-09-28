'use strict';
// Structural, visual and dynamic-light measurements of the isolated sample.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(fs.existsSync);
if(!edge)throw Error('Microsoft Edge required for this verification');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.png':'image/png'};
const server=http.createServer((req,res)=>{
  let relative;
  try{relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '');}
  catch(_){res.writeHead(400).end();return;}
  const file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);
  });
});
function dump(url,profile){
  return new Promise((resolve,reject)=>{
    const args=[`--user-data-dir=${profile}`,'--headless=new','--no-first-run',
      '--disable-extensions','--use-angle=swiftshader','--enable-unsafe-swiftshader',
      '--virtual-time-budget=8500','--window-size=1050,550','--dump-dom',url];
    const child=spawn(edge,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
    let output='',error='';
    child.stdout.on('data',data=>output+=data.toString());
    child.stderr.on('data',data=>error+=data.toString());
    const timer=setTimeout(()=>child.kill(),30000);
    child.on('error',reject);
    child.on('close',code=>{
      clearTimeout(timer);
      const match=output.match(/data-metrics="([^"]+)"/);
      if(code!==0||!match){
        reject(Error(`Edge dump failed: exit ${code} ${error.slice(-500)} ${output.slice(-500)}`));return;
      }
      resolve(JSON.parse(decodeURIComponent(match[1])));
    });
  });
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/tools/visual/projective-silver/index.html`;
  const results=[];
  for(const yaw of [-8,0,8]){
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),'projective-silver-test-'));
    results.push(await dump(`${base}?yaw=${yaw}`,profile));
  }
  const center=results[1],normals=center.roofNormals;
  const distinctiveRoofNormals=normals.some((a,i)=>normals.some((b,j)=>
    j>i&&Math.abs(a.reduce((sum,v,k)=>sum+v*b[k],0))<.95));
  const checks={
    allAnglesLoaded:results.every(r=>r.era==='silver'&&r.closedShells>=35),
    threeDimensionalDepth:center.depthRange[1]-center.depthRange[0]>110,
    distinctiveRoofNormals,
    closedArchitecture:results.every(r=>r.closedShells>30&&r.solidSideFaces>100),
    mobileBatchBudget:center.meshBatches<=7&&center.drawCalls<=9,
    unchangedOutsideHall:results.every(r=>r.pixelDifference.outside<1.5),
    defaultReferenceMatched:center.pixelDifference.roi<3,
    movingLightChangesPixels:center.lightDifference>.10,
    comparisonMeasured:Number.isFinite(center.pixelDifference.roi)
  };
  console.log(JSON.stringify({checks,results:results.map(r=>({
    era:r.era,yaw:r.yaw,triangles:r.triangles,closedShells:r.closedShells,
    roofSlopeCount:r.roofSlopeCount,meshBatches:r.meshBatches,drawCalls:r.drawCalls,
    depthRange:r.depthRange,paintedFaces:r.paintedFaces,
    solidSideFaces:r.solidSideFaces,pixelDifference:r.pixelDifference,
    lightDifference:r.lightDifference
  }))},null,2));
  process.exitCode=Object.values(checks).every(Boolean)?0:2;
})().catch(error=>{console.error(error);process.exitCode=2;})
  .finally(()=>server.close());
