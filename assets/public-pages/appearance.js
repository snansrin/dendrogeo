"use strict";
/* Reuse device appearance preference and existing switch semantics on public pages. */
(function(root){
 const doc=root.document,english=doc.documentElement.lang.startsWith('en');
 function mount(){
  const host=doc.querySelector('header .nav,header nav,header,.top .nav')||doc.querySelector('main')||doc.body;
  if(host&&!doc.querySelector('.dg-public-appearance')){
   const controls=doc.createElement('div');controls.className='dg-public-appearance';
   controls.innerHTML=`<label><input type="checkbox" class="dg-switch" data-dg-dark-mode><span>${english?'Dark theme':'Koyu tema'}</span></label><button type="button" class="btn sm ghost" data-dg-theme-system aria-pressed="false">${english?'System':'Sistem'}</button>`;
   if(['MAIN','BODY'].includes(host.tagName)){host.prepend(controls);if(host.tagName==='BODY')controls.classList.add('wrap');}else host.append(controls);root.DG_APPEARANCE.sync();
  }
  for(const table of doc.querySelectorAll('main table')){
   if(table.closest('.dg-table-scroll,.tscroll'))continue;
   const region=doc.createElement('div');region.className='dg-table-scroll';region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label',table.caption?.textContent||(english?'Data table, scroll horizontally':'Veri tablosu, yatay kaydırılabilir'));
   table.before(region);region.append(table);
  }
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
