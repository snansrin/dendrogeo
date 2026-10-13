#!/usr/bin/env node
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkDependencyRules} from './lib/dependency-rules.mjs';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=checkDependencyRules(ROOT);
  for(const error of result.errors)console.error(`🔴 ${error}`);
  for(const debt of result.knownDebt)console.warn(`🟡 Bilinen geçiş işi ${debt.relativePath}: ${debt.name} — ${debt.reason}`);
  if(result.errors.length){console.error(`🔴 Katman bağımlılıkları başarısız (${result.errors.length} ihlal, ${result.checked} modül denetlendi).`);process.exitCode=1;}
  else console.log(`✅ Domain/application modül bağımlılıkları korundu (${result.checked} modül denetlendi).`);
}
