import {parseJavaScript,walkAst,calledPath} from './javascript-ast.mjs';
const SDK_CLIENT=new Set(['sb','client','supabase','supabaseClient']);

export function findDirectPersistenceAccess(modules){
 const violations=[];
 for(const module of modules){
  if(!["application","ui"].includes(module.layer))continue;
  const ast=module.ast||parseJavaScript(module.source,{filename:module.relativePath});
  walkAst(ast,node=>{
   if(node.type!=='CallExpression')return;
   const parts=calledPath(node)?.split('.');if(!parts)return;
   const directClient=SDK_CLIENT.has(parts[0])&&['from','channel','rpc'].includes(parts.at(-1));
   const directStorage=SDK_CLIENT.has(parts[0])&&parts[1]==='storage'&&parts.at(-1)==='from';
   const directStorageAlias=parts[0]==='storage'&&parts.at(-1)==='from';
   const directAuth=SDK_CLIENT.has(parts[0])&&parts[1]==='auth'&&parts.length>=3;
   const directChannel=SDK_CLIENT.has(parts[0])&&parts[1]==='channel';
   if(directClient||directStorage||directStorageAlias||directAuth||directChannel){
    violations.push(`${module.relativePath}:${node.loc?.start.line||1}: application must access Supabase through an adapter port`);
   }
  });
 }
 return violations;
}
