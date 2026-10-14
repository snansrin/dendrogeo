import {isForbiddenLayerDependency,KNOWN_LEGACY_REFERENCES} from './dependency-layer-policy.mjs';

export function findForbiddenModuleReferences(modules,providers){
  const violations=new Map(),knownDebt=new Map();
  const expression=/\b(?:window|globalThis|root)\s*\.\s*(DG_[A-Z0-9_]+)\b|\b(DG_[A-Z0-9_]+)\s*\./g;
  for(const module of modules){
    if(!['domain','application','adapters'].includes(module.layer))continue;
    for(const match of module.source.matchAll(expression)){
      const name=match[1]||match[2];
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
