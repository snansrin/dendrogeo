import {parseJavaScript,walkAst} from './javascript-ast.mjs';

// CLI validation and report generation consume the browser's canonical chain.
// No hand-maintained copy can silently omit newly extracted adapters.
export function surfaceRuntimeModules(read){
 let paths=null;
 walkAst(parseJavaScript(read('src/utils/lazylibs.js')),node=>{
  if(node.type!=='VariableDeclarator'||node.id?.name!=='DG_LULC_CHAIN')return;
  if(node.init?.type!=='ArrayExpression')throw Error('Surface runtime chain must be a literal array.');
  paths=node.init.elements.map(item=>{
   if(item?.type!=='Literal'||typeof item.value!=='string'||(!/^src\/[a-z0-9_/-]+\.js$/.test(item.value)&&item.value!=='vendor/polygon-clipping-0.15.7.js'))throw Error('Invalid surface runtime module path.');
   return item.value;
  });
 });
 if(!paths?.length||new Set(paths).size!==paths.length)throw Error('Surface runtime chain missing or duplicated.');
 return paths;
}
