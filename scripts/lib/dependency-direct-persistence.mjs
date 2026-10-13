const DIRECT_CLIENT_ACCESS=/\b(?:sb|client|storage)\s*\.\s*from\s*\(/g;
const DIRECT_AUTH_ACCESS=/\bclient\s*\.\s*auth\s*\./g;
const DIRECT_CHANNEL_ACCESS=/\bclient\s*\.\s*channel\s*\(/g;

export function findDirectPersistenceAccess(modules){
 const violations=[];
 for(const module of modules){
  if(!["application","ui"].includes(module.layer))continue;
  for(const match of module.source.matchAll(DIRECT_CLIENT_ACCESS)){
   const line=module.source.slice(0,match.index).split("\n").length;
   violations.push(`${module.relativePath}:${line}: application must access Supabase through an adapter port`);
  }
  for(const match of module.source.matchAll(DIRECT_AUTH_ACCESS)){
   const line=module.source.slice(0,match.index).split("\n").length;
   violations.push(`${module.relativePath}:${line}: application must access Supabase Auth through an adapter port`);
  }
  for(const match of module.source.matchAll(DIRECT_CHANNEL_ACCESS)){
   const line=module.source.slice(0,match.index).split("\n").length;
   violations.push(`${module.relativePath}:${line}: application must access Supabase Realtime through an adapter port`);
  }
 }
 return violations;
}
