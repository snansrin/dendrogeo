import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {parseJavaScript,walkAst,memberPath} from './javascript-ast.mjs';

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
      const relativePath=relative(root,path).replaceAll('\\','/');
      const ast=parseJavaScript(source,{filename:relativePath});
      const module={path,relativePath,layer,source,ast};
      modules.push(module);
      const exported=new Set();
      walkAst(ast,node=>{
        if(node.type!=='AssignmentExpression')return;
        const match=/^(?:window|globalThis|root)\.(DG_[A-Z0-9_]+)$/.exec(memberPath(node.left)||'');
        if(match)exported.add(match[1]);
      });
      module.exports=[...exported];
      for(const name of exported){if(!providers.has(name))providers.set(name,[]);providers.get(name).push(module);}
    }
  }
  return{modules,providers};
}
