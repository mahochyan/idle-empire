'use strict';
// Local presentation fixtures. Run: node tests/visual/ui-layout-review.cjs
// It serves the real index and scripts, with a development-only fixture script.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png',
  '.svg':'image/svg+xml','.glb':'model/gltf-binary'};
http.createServer((request,response)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);}catch(_){response.writeHead(400).end();return;}
  const review=pathname==='/review.html';
  const file=path.resolve(root,review?'index.html':pathname.replace(/^\/+/, '')||'index.html');
  if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,bytes)=>{
    if(error){response.writeHead(404).end();return;}
    response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    response.end(review?bytes.toString('utf8').replace('</head>',
      '<script src="/tests/visual/ui-layout-bootstrap.js"></script></head>').replace('</body>',
      '<script src="/tests/visual/ui-layout-fixture.js"></script></body>'):bytes);
  });
}).listen(8875,'127.0.0.1',()=>console.log('UI review: http://127.0.0.1:8875/review.html?state=initial'));
