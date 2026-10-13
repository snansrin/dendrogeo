const DIRECT_CLIENT_ACCESS=/\b(?:sb|client|storage)\s*\.\s*from\s*\(/g;

export function findDirectPersistenceAccess(modules){
 const violations=[];
 for(const module of modules){
  if(module.layer!=="application")continue;
  for(const match of module.source.matchAll(DIRECT_CLIENT_ACCESS)){
   const line=module.source.slice(0,match.index).split("\n").length;
   violations.push(`${module.relativePath}:${line}: application must access Supabase through an adapter port`);
  }
 }
 return violations;
}
