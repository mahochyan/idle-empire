'use strict';
// Browser-side structural and pixel checks; no game state or art files change.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const edgeProfileRoot=path.join(root,'hd2d-previews');
const edge=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(fs.existsSync);
if(!edge)throw Error('Microsoft Edge is required');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '');
  const file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end();return;}
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
    const timeout=setTimeout(()=>child.kill(),30000);
    child.on('error',reject);
    child.on('close',code=>{
      clearTimeout(timeout);
      const match=output.match(/data-metrics="([^"]+)"/);
      if(code!==0||!match)return reject(Error(`Edge dump failed: exit ${code} ${error.slice(-500)} ${output.slice(-500)}`));
      resolve(JSON.parse(decodeURIComponent(match[1])));
    });
  });
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/tools/visual/projective-steam/index.html`;
  const results=[];
  for(const yaw of [-8,0,8]){
    const profile=fs.mkdtempSync(path.join(edgeProfileRoot,'projective-steam-verify-'));
    results.push(await dump(`${base}?yaw=${yaw}`,profile));
  }
  const center=results[1];
  let minRoofDot=1;
  for(let i=0;i<center.roofNormals.length;i++)for(let j=i+1;j<center.roofNormals.length;j++){
    const a=center.roofNormals[i],b=center.roofNormals[j];
    minRoofDot=Math.min(minRoofDot,Math.abs(a.reduce((sum,v,k)=>sum+v*b[k],0)));
  }
  const checks={
    allAnglesLoaded:results.every(item=>item.closedShells>=60&&item.triangles>700),
    actualDepth:center.depthRange[1]-center.depthRange[0]>100,
    differentRoofNormals:minRoofDot<.90,
    batchedForMobile:center.meshBatches<=7&&center.drawCalls<=8,
    brickAndSlateSideUVs:results.every(item=>item.sideFaces>=80),
    clockChimneyAndPipes:center.parts.some(part=>part.includes('clock'))&&
      center.parts.some(part=>part.includes('chimney'))&&
      center.parts.some(part=>part.includes('pipe')),
    originalOutsidePreserved:results.every(item=>item.pixelDifference.outside<.1),
    movingLightChangesPixels:center.lightDifference>.01&&
      results[0].lightDifference>.05&&results[2].lightDifference>.05,
    referenceViewMeasured:center.pixelDifference.roi<3
  };
  const report={variant:'steam-projective',checks,minRoofDot,results:results.map(item=>({
    yaw:item.yaw,triangles:item.triangles,closedShells:item.closedShells,
    paintedFaces:item.paintedFaces,sideFaces:item.sideFaces,
    meshBatches:item.meshBatches,drawCalls:item.drawCalls,
    depthRange:item.depthRange,pixelDifference:item.pixelDifference,
    lightDifference:item.lightDifference,clockLightDifference:item.clockLightDifference
  }))};
  fs.writeFileSync(path.join(__dirname,'metrics.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  process.exitCode=Object.values(checks).every(Boolean)?0:2;
})().catch(error=>{console.error(error);process.exitCode=2;})
  .finally(()=>server.close());

