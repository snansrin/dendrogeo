import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
execFileSync(process.execPath,['scripts/check-core-foundation.mjs'],{cwd:root,stdio:'inherit'});
const current=spawnSync('git',['config','--local','--get','core.hooksPath'],{cwd:root,encoding:'utf8'});
if(current.status!==0&&current.status!==1)throw Error(current.stderr||'Git hook configuration could not be read');
if(current.status===0&&current.stdout.trim()!=='.githooks')throw Error('Existing Git hooks path is preserved: '+current.stdout.trim());
execFileSync('git',['config','--local','core.hooksPath','.githooks'],{cwd:root});
console.log('Çekirdek koruması etkin: normal push öncesinde SHA-256 kilidi doğrulanır.');
