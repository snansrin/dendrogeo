import {collectDependencyModuleIndex} from './dependency-module-index.mjs';
import {findForbiddenModuleReferences} from './dependency-global-references.mjs';
import {findDirectPersistenceAccess} from './dependency-direct-persistence.mjs';

export function checkDependencyRules(root){
  const{modules,providers}=collectDependencyModuleIndex(root);
  const references=findForbiddenModuleReferences(modules,providers);
  return{checked:modules.length,...references,errors:[...references.errors,...findDirectPersistenceAccess(modules)]};
}
