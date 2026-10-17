"use strict";
/* Read-only, same-origin presentation of the original hash-protected report. */
(function(root){
 const doc=root.document,id=new URLSearchParams(root.location.search).get('id'),status=doc.getElementById('readerStatus'),frame=doc.getElementById('reportFrame');
 if(!/^DGR-\d{4}-\d{4}$/.test(id||'')){status.textContent='Geçerli bir rapor seçilmedi. Rapor dizininden bir yayın seçin.';return;}
 const source=new URL('../'+id+'/',root.location.href);
 doc.getElementById('readerTitle').textContent=id;
 doc.title=id+' — DendroGeo Rapor Okuyucu';
 doc.getElementById('readerOriginal').href=source.href;
 doc.getElementById('readerPdf').href=new URL('rapor.pdf',source).href;
 doc.getElementById('readerActions').hidden=false;
 const syncTheme=()=>{const html=frame.contentDocument?.documentElement;if(html){html.dataset.theme=doc.documentElement.dataset.theme;html.style.colorScheme=doc.documentElement.dataset.theme;}};
 frame.addEventListener('load',()=>{
  const inner=frame.contentDocument;
  if(!inner?.querySelector('#dgVerify')){frame.hidden=true;doc.getElementById('readerActions').hidden=true;status.textContent='Bu kimlik için yayımlanmış rapor bulunamadı. Rapor dizininden geçerli bir yayın seçin.';return;}
  const resize=()=>{frame.style.height=(Math.ceil(inner.body.getBoundingClientRect().height)+8)+'px';};
  for(const path of ['assets/public-pages/report-reader.css?v=2']){const link=inner.createElement('link');link.rel='stylesheet';link.href=new URL('../../'+path,root.location.href).href;link.addEventListener('load',resize,{once:true});inner.head.append(link);}
  const fonts=doc.querySelector('link[href$="assets/public-pages/style.css"]');
  // Fonts are loaded by the outer public page; use the same families in the report.
  if(fonts){const link=inner.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Manrope:wght@400;600;700;800&display=swap';link.addEventListener('load',()=>inner.fonts?.ready.then(resize),{once:true});inner.head.append(link);}
  syncTheme();frame.hidden=false;status.textContent='';
  for(const table of inner.querySelectorAll('table')){if(table.closest('.tscroll'))continue;const region=inner.createElement('div');region.className='tscroll';table.before(region);region.append(table);}
  new ResizeObserver(resize).observe(inner.body);inner.fonts?.ready.then(resize);resize();
  inner.fonts?.addEventListener('loadingdone',resize);
  doc.getElementById('readerPrint').disabled=false;
 });
 new MutationObserver(syncTheme).observe(doc.documentElement,{attributes:true,attributeFilter:['data-theme']});
 doc.getElementById('readerPrint').addEventListener('click',()=>frame.contentWindow?.print());
 frame.src=source.href;
})(window);
