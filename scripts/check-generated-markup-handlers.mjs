#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectGeneratedMarkupHandlers,compareGeneratedMarkupHandlers} from './lib/generated-markup-handlers.mjs';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const BASELINE=join(ROOT,'docs/generated-markup-handler-baseline.json');

export function checkGeneratedMarkupHandlers(root=ROOT){
  const current=collectGeneratedMarkupHandlers(root);
  const baseline=JSON.parse(readFileSync(join(root,'docs/generated-markup-handler-baseline.json'),'utf8'));
  return{...current,...compareGeneratedMarkupHandlers(current,baseline)};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.includes('--write-baseline')){
    const inventory=collectGeneratedMarkupHandlers(ROOT);
    writeFileSync(BASELINE,JSON.stringify({schema:'dendrogeo/generated-markup-handler-baseline/v1',...inventory},null,2)+'\n');
    console.log(`✅ Dinamik handler baseline yazıldı (${inventory.total} nitelik, ${Object.keys(inventory.files).length} dosya).`);
    process.exit(0);
  }
  const result=checkGeneratedMarkupHandlers();
  for(const error of result.errors)console.error('🔴 '+error);
  if(result.errors.length)process.exitCode=1;
  else console.log(`✅ Dinamik HTML handler borcu artmadı (${result.total} nitelik, ${Object.keys(result.files).length} dosya; aşamalı azaltım kapalı).`);
}
