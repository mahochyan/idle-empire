'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function environment(initial = {}, options = {}) {
  const store = new Map(Object.entries(initial));
  const element = () => ({style:{},classList:{add(){},remove(){},contains(){return false}},value:'',innerHTML:'',textContent:'',addEventListener(){},appendChild(){},remove(){}});
  // Each VM may replace Math.random for a deterministic battle; do not leak that replacement into sibling saves.
  const isolatedMath=Object.create(Math);
  const ctx = vm.createContext({console, Date, Math:isolatedMath, JSON,
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    document:{getElementById:element,querySelectorAll:()=>[],createElement:element,body:element()},window:{},
    setTimeout:()=>0,setInterval:()=>0,clearTimeout(){},clearInterval(){},toast(){},addLog(){},updateUI(){},pix:()=>''});
  for(const file of ['config.js','levels.js','math.js','garrison.js','technology.js'])
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../..',file),'utf8'),ctx,{filename:file});
  if(!options.garrison)vm.runInContext('garrisonTick=()=>{}',ctx);
  return {store,run:code=>vm.runInContext(code,ctx)};
}

module.exports = {environment};
