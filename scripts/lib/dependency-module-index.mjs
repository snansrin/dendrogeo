import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';

const LAYERS=['domain','application','adapters','ui'];

function* javascriptFiles(directory){
  if(!statSync(directory,{throwIfNoEntry:false})?.isDirectory())return;
  for(const name of readdirSync(directory)){
    if(name.startsWith('.'))continue;
    const path=join(directory,name),info=statSync(path);
    if(info.isDirectory())yield* javascriptFiles(path);
    else if(name.endsWith('.js'))yield path;
  }
}

export function collectDependencyModuleIndex(root){
  const modules=[],providers=new Map();
  for(const layer of LAYERS){
    const directory=join(root,'src',layer);
    for(const path of javascriptFiles(directory)){
      const source=readFileSync(path,'utf8');
      const module={path,relativePath:relative(root,path).replaceAll('\\','/'),layer,source};
      modules.push(module);
      const exported=new Set();
      const expression=/\b(?:window|globalThis|root)\s*\.\s*(DG_[A-Z0-9_]+)\s*=/g;
      for(const match of source.matchAll(expression))exported.add(match[1]);
      module.exports=[...exported];
      for(const name of exported){if(!providers.has(name))providers.set(name,[]);providers.get(name).push(module);}
    }
  }
  return{modules,providers};
}
