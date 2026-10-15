import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {parseJavaScript,walkAst} from './javascript-ast.mjs';

const HANDLER_ATTRIBUTE=/\son[a-z][a-z0-9_-]*\s*=/gi;

function* javascriptFiles(directory){
  if(!statSync(directory,{throwIfNoEntry:false})?.isDirectory())return;
  for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const path=join(directory,entry.name);
    if(entry.isDirectory())yield*javascriptFiles(path);
    else if(entry.name.endsWith('.js'))yield path;
  }
}

export function collectGeneratedMarkupHandlers(root){
  const files={};
  for(const layer of ['ui','services']){
    for(const path of javascriptFiles(join(root,'src',layer))){
      const source=readFileSync(path,'utf8');
      const ast=parseJavaScript(source,{filename:relative(root,path).replaceAll('\\','/')});
      let count=0;
      walkAst(ast,node=>{
        const values=node.type==='TemplateElement'?[node.value.raw]:
          node.type==='Literal'&&typeof node.value==='string'?[node.value]:[];
        for(const value of values)count+=[...value.matchAll(HANDLER_ATTRIBUTE)].length;
      });
      if(count)files[relative(root,path).replaceAll('\\','/')]=count;
    }
  }
  return{files,total:Object.values(files).reduce((sum,count)=>sum+count,0)};
}

export function compareGeneratedMarkupHandlers(current,baseline){
  const errors=[];
  if(baseline?.schema!=='dendrogeo/generated-markup-handler-baseline/v1'||!baseline.files||typeof baseline.files!=='object'){
    return{errors:['Dinamik HTML handler baseline şeması tanınmıyor.']};
  }
  for(const [path,count] of Object.entries(current.files||{})){
    const allowed=baseline?.files?.[path]||0;
    if(count>allowed)errors.push(`${path}: inline handler sayısı ${allowed} → ${count} arttı`);
  }
  return{errors};
}
