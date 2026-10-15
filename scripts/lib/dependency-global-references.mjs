import {isForbiddenLayerDependency,KNOWN_LEGACY_REFERENCES} from './dependency-layer-policy.mjs';
import {walkAst,memberPath} from './javascript-ast.mjs';

export function findForbiddenModuleReferences(modules,providers){
  const violations=new Map(),knownDebt=new Map();
  for(const module of modules){
    if(!['domain','application','adapters'].includes(module.layer))continue;
    const names=new Set();
    walkAst(module.ast,node=>{
      if(node.type!=='MemberExpression')return;
      const path=memberPath(node);if(!path)return;
      const global=/^(?:window|globalThis|root)\.(DG_[A-Z0-9_]+)(?:\.|$)/.exec(path);
      if(global)names.add(global[1]);
      else if(/^DG_[A-Z0-9_]+\./.test(path))names.add(path.split('.')[0]);
    });
    for(const name of names){
      for(const provider of providers.get(name)||[]){
        if(provider.path===module.path||!isForbiddenLayerDependency(module.layer,provider.layer))continue;
        const debtKey=`${module.relativePath}:${name}`;
        if(KNOWN_LEGACY_REFERENCES.has(debtKey)){
          knownDebt.set(debtKey,{relativePath:module.relativePath,name,reason:KNOWN_LEGACY_REFERENCES.get(debtKey)});
          continue;
        }
        const key=`${module.relativePath}:${name}:${provider.relativePath}`;
        violations.set(key,`${module.relativePath}: ${module.layer} references ${name} from ${provider.layer} module ${provider.relativePath}`);
      }
    }
  }
  return{errors:[...violations.values()],knownDebt:[...knownDebt.values()]};
}
