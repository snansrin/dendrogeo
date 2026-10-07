#!/usr/bin/env node
import {chromium} from 'playwright-core';
import {mkdirSync} from 'node:fs';
mkdirSync('/tmp/dendrogeo-mobile',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const width of [360,390,430]){
  const page=await browser.newPage({viewport:{width,height:840}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded'});
  await page.locator('body').waitFor({state:'visible'});
  const size=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,document:document.documentElement.scrollWidth}));
  await page.screenshot({path:`/tmp/dendrogeo-mobile/${width}.png`,fullPage:true});
  console.log(JSON.stringify({width,...size,errors}));
  if(size.body>width||size.document>width||errors.length)throw Error(`Mobile smoke failed at ${width}px`);
  await page.close();
 }
}finally{await browser.close();}
