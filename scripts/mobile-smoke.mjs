#!/usr/bin/env node
import {chromium} from 'playwright-core';
import {mkdirSync} from 'node:fs';
mkdirSync('/tmp/dendrogeo-mobile',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [360,390,430]){
  const page=await browser.newPage({viewport:{width,height:840}});
  const errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('body').waitFor({state:'visible'});
  const size=await page.evaluate(()=>{
   const viewport=innerWidth,body=document.body.scrollWidth,documentWidth=document.documentElement.scrollWidth;
   const overflow=[...document.querySelectorAll('body *')].map(el=>{
    const r=el.getBoundingClientRect();if(r.right<=viewport+.1)return null;
    let scroller=el.parentElement;
    while(scroller&&scroller!==document.body){
     const x=getComputedStyle(scroller).overflowX;
     if(['auto','scroll','hidden','clip'].includes(x))return null;
     scroller=scroller.parentElement;
    }
    return{tag:el.tagName.toLowerCase(),id:el.id||'',className:typeof el.className==='string'?el.className:'',left:+r.left.toFixed(2),right:+r.right.toFixed(2),width:+r.width.toFixed(2),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
   }).filter(Boolean).sort((a,b)=>b.right-a.right).slice(0,12);
   return{viewport,body,document:documentWidth,overflow};
  });
  await page.screenshot({path:`/tmp/dendrogeo-mobile/${width}.png`,fullPage:true});
  console.log(JSON.stringify({width,...size,errors}));
  if(size.document>width||size.overflow.length||errors.length)throw Error(`Mobile smoke failed at ${width}px`);
  await page.close();
 }
}finally{await browser.close();}
