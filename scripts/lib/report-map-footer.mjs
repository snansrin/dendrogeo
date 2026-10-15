import {wrapReportMapText} from './report-map-text-wrap.mjs';

/* All metadata stays visible; a longer caption reserves more canvas height. */
export function reportMapFooterLayout({width,padding,dataset,meta=null}){
 const usable=Math.max(6,width-2*padding),rows=[];
 const append=(value,y,preferredScale=2)=>{
  const scale=value.length*6*preferredScale<=usable?preferredScale:1;
  const lines=wrapReportMapText(value,usable/(6*scale));
  lines.forEach((text,i)=>rows.push({text,y:y+i*(scale===2?20:10),scale}));
  return y+lines.length*(scale===2?20:10);
 };
 const idLine=meta?.id?'DENDROGEO - '+meta.id:'DENDROGEO - BILIMSEL ANALIZ HARITASI';
 let next=append(idLine,0);
 next=append('VERI: '+(meta?.source||dataset)+' / COZUNURLUK: '+(meta?.resolution||'10 M')+(meta?.epsg?' / PROJEKSIYON: EPSG:'+meta.epsg:''),Math.max(20,next));
 if(meta&&(meta.dateStr||meta.engine))append((meta.dateStr?'ANALIZ TARIHI: '+meta.dateStr:'')+(meta.dateStr&&meta.engine?' / ':'')+(meta.engine?'DENDROGEO LC ENGINE V'+meta.engine:'')+' / CC BY-NC 4.0',Math.max(40,next));
 return{rows,idLine,height:Math.max(70,...rows.map(row=>12+row.y+7*row.scale+10))};
}

/* Rapora gömülen harita altbilgisinin kimlik ve veri künyesi. */
export function drawReportMapFooter({
  canvas, width, height, padding, footerHeight, frameTone, tones, dataset, meta = null
}) {
  const y = height - footerHeight + 12;
  canvas.line(padding, y - 8, width - padding, y - 8, frameTone);
  const {rows,idLine}=reportMapFooterLayout({width,padding,dataset,meta});
  canvas.text(padding,y,rows[0].text,tones.ink,rows[0].scale);
  const brandMark = 'DENDROGEO 2026';
  if (width - padding - 12 * brandMark.length > padding + 12 * idLine.length + 8)
    canvas.text(width - padding - 12 * brandMark.length, y, brandMark, tones.mut, 2);
  for(const row of rows.slice(1))canvas.text(padding,y+row.y,row.text,tones.mut,row.scale);
}
