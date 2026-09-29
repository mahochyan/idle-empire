'use strict';
// From the same new-game route, pay iron-store levels before steel storage.
// Both stores and every required input are acquired through the game's actions.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const sourceFile=path.join(__dirname,'probe-steam-era.js');
const targetArg=process.argv.find(arg=>arg.startsWith('--iron-target='));
const ironTarget=Number(targetArg?.slice('--iron-target='.length));
assert.ok(Number.isSafeInteger(ironTarget)&&ironTarget>=0&&ironTarget<=200,'--iron-target=0..200 required');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const fileList=['config.js','levels.js','math.js','technology.js','tools/verify/probe-next-era.js','tools/verify/probe-steam-era.js'];
const before=Object.fromEntries(fileList.map(file=>[file,sha(file)]));
let source=fs.readFileSync(sourceFile,'utf8');
const anchor="upgradeTo('steel_store',64);";
assert.equal(source.split(anchor).length,2,'steel-store route anchor changed');
source=source.replace(anchor,
  `upgradeTo('iron_store',${ironTarget});\n`+
  `while(run("resCap('steel')")<10000){\n`+
  `  const next=run("bldSt('steel_store').lv")+1;\n`+
  `  assert.ok(next<=64,'steel-store capacity route exceeded baseline Lv64');\n`+
  `  upgradeTo('steel_store',next);\n`+
  `}`);
const oldArgv=process.argv;
let result;
process.argv=['node',sourceFile,'--steel-mastery-early','--steel-mastery-20'];
try{
  const output={log(value){result=JSON.parse(value)}};
  new Function('require','console','__dirname',source)(require,output,__dirname);
}finally{process.argv=oldArgv}
assert.ok(result,'replay produced no result');
assert.equal(result.wins,0);
assert.equal(result.firstArmoredSoldiers,1);
assert.ok(result.steelCap>=10000);
const after=Object.fromEntries(fileList.map(file=>[file,sha(file)]));
assert.deepEqual(after,before,'shared source changed during replay');
console.log(JSON.stringify({batch:'P395',strategy:'iron-store-before-steel-store',ironTarget,
  sourceSha256:before,...result},null,2));
