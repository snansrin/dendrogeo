// Migration lint for the project's canonical, schema-qualified SQL convention.
// Runtime RLS/ACL tests remain necessary; this is not a general SQL parser.
export function auditDataApiMigration(sql){
 const clean=sql.replace(/\$([a-z_][a-z_0-9]*|)\$[\s\S]*?\$\1\$/gi,' ')
  .replace(/'(?:''|[^'])*'/g,' ')
  .replace(/\/\*[\s\S]*?\*\//g,' ').replace(/--[^\r\n]*/g,' ');
 const errors=[];
 if(/\bgrant\b[^;]*\bon\s+all\s+tables\s+in\s+schema\s+public\b/i.test(clean))
  errors.push('Grant each intended table explicitly; do not expose all public tables.');
 const declarations=[...clean.matchAll(/\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)/gi)];
 for(const declaration of declarations){
  const name=declaration[1];
  if(!/^[a-z_][a-z_0-9]*\.[a-z_][a-z_0-9]*$/.test(name)){
   errors.push('New tables must use a canonical schema.table name for access review.');continue;
  }
  if(!name.startsWith('public.'))continue;
  const escaped=name.replaceAll('.','\\.');
  if(!new RegExp('\\balter\\s+table\\s+(?:only\\s+)?'+escaped+'\\s+enable\\s+row\\s+level\\s+security\\b','i').test(clean))
   errors.push(name+': enable RLS in the creating migration.');
  const revokes=[...clean.matchAll(/\brevoke\s+all(?:\s+privileges)?\s+on\s+(?:table\s+)?([^;]+?)\s+from\s+([^;]+);/gi)];
  const denied=revokes.some(([,tables,roles])=>tables.split(',').map(s=>s.trim()).includes(name)
   &&['public','anon','authenticated'].every(role=>roles.toLowerCase().split(',').map(s=>s.trim()).includes(role)));
  if(!denied)errors.push(name+': explicitly revoke legacy PUBLIC/anon/authenticated access before opting roles in.');
  const grants=[...clean.matchAll(/\bgrant\s+([^;]+?)\s+on\s+(?:table\s+)?([^;]+?)\s+to\s+([^;]+);/gi)];
  const optedIn=grants.some(([,privileges,tables,roles])=>tables.split(',').map(s=>s.trim()).includes(name)
   &&/\b(select|insert|update|delete)\b/i.test(privileges)&&/\b(anon|authenticated|service_role)\b/i.test(roles));
  const internal=new RegExp('^\\s*--\\s*data-api:\\s*internal\\s+'+escaped+'\\s*$','im').test(sql);
  if(!optedIn&&!internal)errors.push(name+': grant required API operations here, or mark data-api: internal '+name+'.');
 }
 return errors;
}
