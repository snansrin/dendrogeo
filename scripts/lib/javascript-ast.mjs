import {parse} from 'acorn';

export function parseJavaScript(source,{filename='source.js'}={}){
  return parse(source,{ecmaVersion:'latest',sourceType:'script',locations:true,allowHashBang:true});
}

export function walkAst(node,visit){
  if(!node||typeof node!=='object'||typeof node.type!=='string')return;
  visit(node);
  for(const [key,value] of Object.entries(node)){
    if(key==='loc'||key==='start'||key==='end')continue;
    if(Array.isArray(value))for(const child of value)walkAst(child,visit);
    else if(value&&typeof value==='object')walkAst(value,visit);
  }
}

export function memberPath(node){
  if(!node)return null;
  if(node.type==='Identifier')return node.name;
  if(node.type!=='MemberExpression')return null;
  const base=memberPath(node.object);if(!base)return null;
  const property=node.computed?(node.property.type==='Literal'?String(node.property.value):null):node.property.name;
  return property===null?null:`${base}.${property}`;
}

export function calledPath(node){
  if(!node)return null;
  if(node.type==='ChainExpression')return calledPath(node.expression);
  if(node.type==='CallExpression'||node.type==='NewExpression')return memberPath(node.callee);
  return null;
}
