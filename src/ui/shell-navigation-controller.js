"use strict";
/* Activate one view with the original map, presence and scroll behavior. */
window.DG_SHELL_NAVIGATION_CONTROLLER={activate(view,ports){const {document,element,window,schedule}=ports;
 if(['map','nav','world'].includes(view))ports.initMaps();ports.setView(view);ports.saveView(view);
 try{ports.presenceView?.(view)}catch(error){}
 ports.setScrollSwitching(true);schedule(()=>ports.setScrollSwitching(false),500);
 if(view!=='visitors')try{ports.stopVisitorTick?.()}catch(error){}
 try{ports.presencePing?.(view)}catch(error){}
 document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));element('v-'+view).classList.add('on');document.querySelectorAll('#side .item').forEach(x=>x.classList.remove('on'));
 const items=document.querySelectorAll('#side .item'),index={dash:0,measure:1,nav:2,map:3,projects:4,records:5,export:6,world:7,admin:8,users:9,visitors:10};if(items[index[view]])items[index[view]].classList.add('on');
 ports.runEffects(view);schedule(()=>{const main=element('main');if(!main)return;const top=parseInt(ports.readScroll('dg_scroll_'+view),10),pageTop=parseInt(ports.readScroll('dg_scrollw_'+view),10);if(top>0)main.scrollTop=top;if(pageTop>0)window.scrollTo(0,pageTop)},180);
}};
