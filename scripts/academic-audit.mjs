#!/usr/bin/env node
/** Read-only source audit. Static call names are candidates, never a runtime trace. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const digest=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const csv=rows=>rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
const member=node=>!node?'':node.type==='Identifier'?node.name:node.type==='ThisExpression'?'this':node.type==='MemberExpression'?member(node.object)+'.'+(node.computed?(node.property.type==='Literal'?String(node.property.value):'[dynamic]'):member(node.property)):'';
const funTypes=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression']);

export function inspectJavaScript(source,path){
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'module',locations:true,allowHashBang:true});
 const functions=[],calls=[];
 function visit(node,parent=null,scope=null){
  if(!node||typeof node.type!=='string')return;
  if(funTypes.has(node.type)){
   const name=node.id?.name||(parent?.type==='VariableDeclarator'?member(parent.id):parent?.type==='Property'?member(parent.key):parent?.type==='AssignmentExpression'?member(parent.left):'')||'<anonymous>';
   const entry={id:path+':'+node.loc.start.line+':'+node.loc.start.column,path,name,line:node.loc.start.line,endLine:node.loc.end.line,kind:node.type,parent:scope?.id||''};
   functions.push(entry);scope=entry;
  }
  if(node.type==='CallExpression'||node.type==='NewExpression')calls.push({path,line:node.loc.start.line,caller:scope?.id||path+':<top-level>',callee:member(node.callee)||'<expression>',resolution:'unresolved-static-name'});
  for(const [key,value] of Object.entries(node)){
   if(key==='loc'||key==='start'||key==='end')continue;
   if(Array.isArray(value)){for(const child of value)if(child&&typeof child.type==='string')visit(child,node,scope);}
   else if(value&&typeof value.type==='string')visit(value,node,scope);
  }
 }
 visit(ast);return{functions,calls};
}

export function auditSource({root=ROOT,baseline}={}){
 const local=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,maxBuffer:20*1024*1024}).toString('utf8').split('\0').filter(Boolean);
 const expected=new Map((baseline?.tree||[]).filter(e=>e.type==='blob').map(e=>[e.path,e.sha]));
 const paths=[...new Set([...local,...expected.keys()])].filter(path=>!/^(.git|node_modules|work)\//.test(path)&&!path.includes('__pycache__/')).sort();
 const files=[],functions=[],calls=[],parseErrors=[],mismatches=[],missingLocal=[];
 for(const path of paths){
  const absolute=resolve(root,path);
  if(!absolute.startsWith(resolve(root)+sep))throw Error('Audit path is outside repository: '+path);
  if(!existsSync(absolute)){missingLocal.push(path);continue;}
  const bytes=readFileSync(absolute),gitSha=digest(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes]),'sha1');
  const textExt=new Set(['.js','.mjs','.ts','.json','.html','.css','.md','.yml','.yaml','.sql','.csv','.txt','.bib','.toml','.py','.r','.sh']);
  const text=textExt.has(extname(path).toLowerCase())&&!bytes.includes(0),source=text?bytes.toString('utf8'):'';
  const firstParty=!/^(vendor|rapor|assets)\//.test(path);
  let parsed='not-javascript',count=0;
  if(firstParty&&/\.(js|mjs)$/.test(path)){
   try{const result=inspectJavaScript(source,path);functions.push(...result.functions);calls.push(...result.calls);count=result.functions.length;parsed='parsed';}
   catch(error){parsed='parse-error';parseErrors.push({path,message:error.message});}
  }
  const baselineStatus=expected.has(path)?expected.get(path)===gitSha?'matches-main':'differs-from-main':'local-only';
  if(baselineStatus==='differs-from-main')mismatches.push(path);
  files.push({path,bytes:bytes.length,lines:text?(source.length?source.split('\n').length-(source.endsWith('\n')?1:0):0):null,sha256:digest(bytes),gitSha,firstParty,text,parsed,functions:count,baselineStatus});
 }
 const summary={schema:'dendrogeo-static-audit/1',baselineTree:baseline?.sha||null,files:files.length,textFiles:files.filter(f=>f.text).length,textLines:files.reduce((n,f)=>n+(f.lines||0),0),parsedJavaScript:files.filter(f=>f.parsed==='parsed').length,functionNodes:functions.length,staticCallSites:calls.length,parseErrors,baselineComparison:{matches:files.filter(f=>f.baselineStatus==='matches-main').length,mismatches,localOnly:files.filter(f=>f.baselineStatus==='local-only').map(f=>f.path),missingLocal},limits:['Static AST traversal is not manual review of every line.','Call-site names are unresolved; dependency injection and runtime handlers require functional review.','No production writes or private user-row exports are performed.','Generated reports and third-party code are inventoried but not parsed as first-party application code.']};
 return{summary,files,functions,calls};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const outArg=process.argv.indexOf('--output'),baseArg=process.argv.indexOf('--baseline');
 const baseline=baseArg<0?undefined:JSON.parse(readFileSync(process.argv[baseArg+1],'utf8'));
 const result=auditSource({baseline});
 if(outArg>=0){
  const output=resolve(process.argv[outArg+1]);mkdirSync(output,{recursive:true});
  writeFileSync(resolve(output,'source-inventory.csv'),csv([['path','bytes','lines','sha256','git_blob_sha','AST_status','function_nodes','baseline'],...result.files.map(f=>[f.path,f.bytes,f.lines,f.sha256,f.gitSha,f.parsed,f.functions,f.baselineStatus])]));
  writeFileSync(resolve(output,'function-index.csv'),csv([['id','file','name','start_line','end_line','kind','parent_function'],...result.functions.map(f=>[f.id,f.path,f.name,f.line,f.endLine,f.kind,f.parent])]));
  writeFileSync(resolve(output,'static-call-sites.csv'),csv([['file','line','caller','callee','resolution'],...result.calls.map(c=>[c.path,c.line,c.caller,c.callee,c.resolution])]));
  writeFileSync(resolve(output,'summary.json'),JSON.stringify(result.summary,null,2)+'\n');
 }
 console.log(JSON.stringify(result.summary,null,2));
 if(result.summary.parseErrors.length)process.exitCode=1;
}
