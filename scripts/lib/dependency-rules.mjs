import {collectDependencyModuleIndex} from './dependency-module-index.mjs';
import {findForbiddenModuleReferences} from './dependency-global-references.mjs';

export function checkDependencyRules(root){
  const{modules,providers}=collectDependencyModuleIndex(root);
  return{checked:modules.length,...findForbiddenModuleReferences(modules,providers)};
}
