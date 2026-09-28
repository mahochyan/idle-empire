// One-time reproducible patch for the pinned Three.js 0.158.0 UMD build.
// Three.js uses Math.random for UUIDs and utility methods. Keep its RNG private
// so creating or rendering a scene cannot advance the game's combat RNG.
// Run on a fresh official build/three.min.js: node assets/hd2d/patch-three-rng.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const file=join(dirname(fileURLToPath(import.meta.url)),'three.min.js');
let code=readFileSync(file,'utf8');
const marker='function(t){"use strict";';
const rng='const __HD2D_THREE_RANDOM__=(()=>{let s=0xa341316c;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296}})();';
if(!code.includes(marker)||!code.includes('Math.random()')||code.includes('__HD2D_THREE_RANDOM__')){
  throw Error('Expected pristine Three.js 0.158.0 UMD bundle');
}
const count=(code.match(/Math\.random\(\)/g)||[]).length;
if(count!==21)throw Error('Unexpected Three.js RNG call count: '+count);
code=code.replace(marker,marker+rng).replaceAll('Math.random()','__HD2D_THREE_RANDOM__()');
writeFileSync(file,code,'utf8');
console.log('Patched '+count+' Three.js RNG call sites');
