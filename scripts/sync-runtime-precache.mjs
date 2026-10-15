#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseJavaScript,walkAst} from './lib/javascript-ast.mjs';
import {collectRuntimeModules} from './lib/runtime-module-inventory.mjs';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const SW_PATH=join(ROOT,'sw.js');

function coreAssets(source){
  const ast=parseJavaScript(source,{filename:'sw.js'});
  let found=null;
  walkAst(ast,node=>{
    if(node.type!=='VariableDeclarator'||node.id?.name!=='CORE_ASSETS'||node.init?.type!=='ArrayExpression')return;
    found=node.init.elements.map(element=>{
      if(element?.type!=='Literal'||typeof element.value!=='string')throw new Error('CORE_ASSETS yalnızca düz string girdileri içerebilir.');
      return element.value;
    });
  });
  if(!found)throw new Error('sw.js içinde CORE_ASSETS dizisi bulunamadı.');
  return found;
}

function expectedAssets(root=ROOT){
  const sw=readFileSync(join(root,'sw.js'),'utf8');
  const current=coreAssets(sw);
  const runtime=collectRuntimeModules(root);
  const generated=new Set([...runtime.loaded].map(path=>'/'+path));
  const firstModule=current.findIndex(path=>/^\/src\/.+\.js$/.test(path));
  if(firstModule<0)throw new Error('CORE_ASSETS içinde değiştirilecek runtime modül listesi bulunamadı.');
  const staticBefore=current.slice(0,firstModule).filter(path=>!/^\/src\/.+\.js$/.test(path));
  const staticAfter=current.slice(firstModule).filter(path=>!/^\/src\/.+\.js$/.test(path));
  const runtimePaths=[...generated];
  const unique=new Set([...staticBefore,...runtimePaths,...staticAfter]);
  if(generated.size!==runtimePaths.length)throw new Error('Runtime manifest içinde yinelenen modül yolu bulundu.');
  for(const path of generated){
    if(!runtime.exists(path.slice(1)))throw new Error(`Runtime manifest dosyası bulunamadı: ${path}`);
  }
  return [...unique];
}

export function renderRuntimePrecache(source,root=ROOT){
  const assets=expectedAssets(root);
  const block=`const CORE_ASSETS = [\n    // Runtime modules are generated from the page and lazy-loader source lists.\n${assets.map(path=>`    '${path.replaceAll("'","\\'")}',`).join('\n')}\n];`;
  const pattern=/const CORE_ASSETS\s*=\s*\[[\s\S]*?\n\];/;
  if(!pattern.test(source))throw new Error('sw.js içinde değiştirilebilir CORE_ASSETS bloğu bulunamadı.');
  return source.replace(pattern,block);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const source=readFileSync(SW_PATH,'utf8'),next=renderRuntimePrecache(source);
  if(next===source){console.log('✅ Service Worker runtime modül manifesti kaynak listelerle eşleşiyor.');}
  else if(process.argv.includes('--write')){writeFileSync(SW_PATH,next);console.log('✅ Service Worker runtime modül manifesti tek kaynaktan güncellendi.');}
  else{console.error('🔴 Service Worker runtime modül listesi güncel değil; npm run build ile üretin.');process.exitCode=1;}
}
