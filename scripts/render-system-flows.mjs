#!/usr/bin/env node
/** Build functional Mermaid diagrams and an offline SVG explorer from reviewed flow data. */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function validateFlows(data,root=ROOT){
 const ids=new Set();
 for(const flow of data.flows){
  if(ids.has(flow.id))throw Error('Duplicate workflow '+flow.id);ids.add(flow.id);
  const nodes=new Set(flow.nodes.map(n=>n.id));if(nodes.size!==flow.nodes.length)throw Error('Duplicate node '+flow.id);
  for(const edge of flow.edges)if(!nodes.has(edge.source)||!nodes.has(edge.target))throw Error('Invalid edge '+flow.id);
  for(const path of flow.sources)if(!existsSync(resolve(root,path)))throw Error('Missing evidence '+path);
 }
 const covered=new Set(data.flows.filter(f=>f.id!=='overview').flatMap(f=>f.views));
 for(const match of readFileSync(resolve(root,'partials/shell.html'),'utf8').matchAll(/data-dg-view="([^"]+)"/g))if(!covered.has(match[1]))throw Error('Unmapped application view '+match[1]);
 return true;
}
const q=s=>s.replaceAll('"','&quot;');
export function renderMarkdown(data){
 let out='# DendroGeo işlev akışları\n\nTarih: '+data.date+' · kaynak anlık görüntüsü: `'+data.baseline_commit+'`.\n\n'+data.scope_note+'\n\n';
 out+='Saha çevre/çap, boy, allometri ve karbon hesabı çekirdektedir. Kaldırılan uydu tabanlı ağaç algılama ve taç çapı tahmini bu akışlarda yoktur. Mevcut hakem kaydı şeması gerçek hakem atama sistemi olarak gösterilmemiştir.\n\n';
 out+='## İçindekiler\n\n'+data.flows.map((f,i)=>`${i+1}. [${f.title}](#${f.id})`).join('\n')+'\n\n';
 for(const flow of data.flows){
  out+=`<a id="${flow.id}"></a>\n\n## ${flow.title}\n\n\`\`\`mermaid\nflowchart TD\n`;
  out+=flow.nodes.map(n=>`  ${n.id}["${q(n.label)}"]`).join('\n')+'\n';
  out+=flow.edges.map(e=>`  ${e.source} -->${e.label?'|"'+q(e.label)+'"|':''} ${e.target}`).join('\n')+'\n```\n\n';
  out+='Kaynaklar: '+flow.sources.map(p=>`[${p}](../${p})`).join(' · ')+'\n\n';
 }
 out+='## Fonksiyon düzeyi kapsam\n\n`scripts/academic-audit.mjs`, birinci taraf JavaScript dosyalarındaki fonksiyonları başlangıç/bitiş satırlarıyla ve çağrı noktalarını ayrı CSV dosyalarıyla çıkarır. Dinamik bağımlılık enjeksiyonu ve global facade çağrıları nedeniyle bu indeks otomatik kesin çağrı grafiği değildir. Yukarıdaki diyagramlar uygulama davranışının kaynaklarla eşlenmiş işlevsel görünümüdür.\n';return out;
}
export function normalizeFlowSearch(value){return String(value).toLocaleLowerCase('tr').replaceAll('ı','i');}
export function renderExplorer(data){
 const payload=JSON.stringify(data).replaceAll('<','\\u003c');
 return `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DendroGeo · İşlev akışları</title>
 <style>:root{color-scheme:light;--bg:#f7f6f2;--card:#fff;--ink:#20332c;--mut:#52675d;--line:#ccd8d1;--accent:#176443}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}header{padding:22px 26px;border-bottom:1px solid var(--line)}h1{font:600 27px Georgia,serif;margin:0}header p{margin:5px 0;color:var(--mut)}.layout{display:grid;grid-template-columns:280px 1fr;min-height:85vh}aside{padding:16px;border-right:1px solid var(--line)}input,button{font:inherit;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);padding:9px}input{width:100%;margin-bottom:12px}button{cursor:pointer}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #539c7b;outline-offset:2px}#list button{display:block;width:100%;text-align:left;margin:5px 0}#list button[aria-current=true]{border-color:var(--accent);background:#e4f1e9}main{padding:20px;min-width:0}h2{font:600 22px Georgia,serif}.tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.viewport{overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);min-height:420px;padding:12px}svg{display:block;max-width:none}svg text{font:14px system-ui,sans-serif;fill:var(--ink)}svg rect{fill:var(--card);stroke:var(--accent);stroke-width:1.6}svg path{stroke:var(--mut);stroke-width:1.4;fill:none}#sources{overflow-wrap:anywhere}#sources a{display:block;color:var(--accent);margin:5px 0}.hint{color:var(--mut);font-size:13px}details{margin-top:18px}li{margin-bottom:7px}@media(prefers-color-scheme:dark){:root{color-scheme:dark;--bg:#111416;--card:#1b2023;--ink:#edf2ee;--mut:#b5c4bd;--line:#44564c;--accent:#8bcfa9}#list button[aria-current=true]{background:#20372b}}@media(max-width:720px){.layout{display:block}aside{border-right:0;border-bottom:1px solid var(--line)}#list{max-height:220px;overflow:auto}header,main{padding:16px}}</style>
 <header><h1>DendroGeo · İşlev akışları</h1><p>Kaynakla eşlenmiş ${data.flows.length} akış · ${data.date}</p><p class="hint">İşlevsel diyagramlar; çalışma zamanı çağrı izi değildir. Fonksiyon dizini ve tam denetim raporu ayrı çıktılardır.</p></header><div class="layout"><aside><label for="search">Akış ara</label><input id="search" type="search" placeholder="ölçüm, NDVI, davet…"><nav id="list" aria-label="İşlev akışları"></nav></aside><main><h2 id="title"></h2><div class="tools"><button id="minus" aria-label="Diyagramı küçült">−</button><button id="plus" aria-label="Diyagramı büyüt">＋</button><button id="fit">Görünümü sığdır</button></div><div class="viewport" id="viewport" tabindex="0" aria-label="Kaydırılabilir akış diyagramı"></div><details open><summary>Geçişler ve kararlar</summary><ul id="edges"></ul></details><details><summary>Kaynak dosyaları</summary><div id="sources"></div></details><p class="hint">Saha ölçümü, allometri ve karbon hesabı kapsam içindedir. Uydu tabanlı ağaç algılama ve taç çapı tahmini kapsam dışıdır.</p></main></div>
 <script type="application/json" id="data">${payload}</script><script>
 const normalizeSearch=${normalizeFlowSearch.toString()};
 const data=JSON.parse(document.getElementById('data').textContent),list=document.getElementById('list'),view=document.getElementById('viewport'),ns='http://www.w3.org/2000/svg';let active=data.flows[0],scale=1;
 const element=(tag,attrs={},text)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n};
 function renderList(){list.replaceChildren();const query=normalizeSearch(document.getElementById('search').value);for(const flow of data.flows){if(!normalizeSearch(flow.title).includes(query))continue;const b=document.createElement('button');b.textContent=flow.title;b.setAttribute('aria-current',String(flow.id===active.id));b.onclick=()=>{active=flow;scale=1;draw();renderList()};list.append(b)}}
 function draw(){document.getElementById('title').textContent=active.title;view.replaceChildren();const rank={},positions={},levels={},order=new Map(active.nodes.map((n,i)=>[n.id,i]));for(const n of active.nodes){rank[n.id]=Math.max(0,...active.edges.filter(e=>e.target===n.id&&order.get(e.source)<order.get(n.id)).map(e=>(rank[e.source]||0)+1));const r=rank[n.id];levels[r]=(levels[r]||0)+1;positions[n.id]={x:(levels[r]-1)*280+25,y:r*145+35};}const width=Math.max(...Object.values(levels))*280+20,height=(Math.max(...Object.values(rank))+1)*145+45;const svg=element('svg',{viewBox:'0 0 '+width+' '+height,width:width*scale,height:height*scale,role:'img','aria-label':active.title});const defs=element('defs'),marker=element('marker',{id:'arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:7,markerHeight:7,orient:'auto-start-reverse'});marker.append(element('path',{d:'M 0 0 L 10 5 L 0 10 z',style:'fill:var(--mut);stroke:none'}));defs.append(marker);svg.append(defs);for(const e of active.edges){const a=positions[e.source],b=positions[e.target],x1=a.x+112,y1=a.y+90,x2=b.x+112,y2=b.y;svg.append(element('path',{d:'M '+x1+' '+y1+' C '+x1+' '+(y1+25)+' '+x2+' '+(y2-25)+' '+x2+' '+y2,'marker-end':'url(#arrow)'}));}for(const n of active.nodes){const p=positions[n.id];svg.append(element('rect',{x:p.x,y:p.y,width:225,height:90,rx:10}));const text=element('text',{x:p.x+12,y:p.y+23}),words=n.label.split(' ');let line='',lineNo=0;for(const word of words){if((line+' '+word).trim().length>26&&line){text.append(element('tspan',{x:p.x+12,dy:lineNo?19:0},line));lineNo++;line=word}else line=(line+' '+word).trim()}text.append(element('tspan',{x:p.x+12,dy:lineNo?19:0},line));svg.append(text)}view.append(svg);const edges=document.getElementById('edges');edges.replaceChildren();for(const e of active.edges){const li=document.createElement('li');li.textContent=active.nodes.find(n=>n.id===e.source).label+' → '+active.nodes.find(n=>n.id===e.target).label+(e.label?' ('+e.label+')':'');edges.append(li)}const sources=document.getElementById('sources');sources.replaceChildren();for(const path of active.sources){const a=document.createElement('a');a.textContent=path;a.href='https://github.com/snansrin/dendrogeo/blob/'+data.baseline_commit+'/'+path;a.target='_blank';a.rel='noopener';sources.append(a)}}
 document.getElementById('search').oninput=renderList;document.getElementById('plus').onclick=()=>{scale=Math.min(2,scale+.15);draw()};document.getElementById('minus').onclick=()=>{scale=Math.max(.25,scale-.15);draw()};document.getElementById('fit').onclick=()=>{scale=.5;draw()};renderList();draw();
 </script></html>`;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const source=resolve(ROOT,'docs/academic/2026-10-17/workflows.json'),data=JSON.parse(readFileSync(source,'utf8'));validateFlows(data);
 const md=resolve(ROOT,'docs/SYSTEM-FLOWS-2026-10-17.md'),html=resolve(ROOT,'docs/academic/2026-10-17/flow-explorer.html');
 const outputs=[[md,renderMarkdown(data)],[html,renderExplorer(data)]];
 if(process.argv.includes('--check')){for(const[path,content]of outputs)if(!existsSync(path)||readFileSync(path,'utf8')!==content)throw Error('Stale flow artifact '+path);}
 else for(const[path,content]of outputs){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,content);}
 console.log('Functional flows verified: '+data.flows.length+'; all 11 shell views mapped.');
}
