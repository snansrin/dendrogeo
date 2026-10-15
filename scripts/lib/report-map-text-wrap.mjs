/* The PNG bitmap font advances six pixels per character at scale 1. */
export function wrapReportMapText(value,maxCharacters){
 const limit=Math.max(1,Math.floor(maxCharacters)),lines=[];
 let line='';
 for(let word of String(value).split(/\s+/).filter(Boolean)){
  if(line&&line.length+1+word.length>limit){lines.push(line);line='';}
  while(word.length>limit){lines.push(word.slice(0,limit));word=word.slice(limit);}
  if(word)line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);
 return lines;
}
