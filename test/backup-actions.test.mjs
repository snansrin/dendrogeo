import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/ui/backup-actions.js',import.meta.url),'utf8');

test('backup download, restore picker, and file selection preserve established callbacks',()=>{
 const listeners=new Map(),calls=[],window={fullBackup(){calls.push(['fullBackup',this===window]);},dgRestorePick(event){calls.push(['dgRestorePick',this===window,event.type]);}};
 const file={click(){calls.push(['file-click']);}},document={addEventListener:(name,handler)=>listeners.set(name,handler),getElementById:id=>id==='dgRestoreFile'?file:null};
 vm.runInContext(source,vm.createContext({window,document}));
 for(const action of ['download','pick-file']){const element={dataset:{dgBackupAction:action}};listeners.get('click')({target:{closest:()=>element}});}
 const input={dataset:{dgBackupAction:'restore-file'}};listeners.get('change')({target:{closest:()=>input},type:'change'});
 assert.deepEqual(calls,[['fullBackup',true],['file-click'],['dgRestorePick',true,'change']]);
});

test('backup controls are declarative and their UI module is cached',()=>{
 const shell=readFileSync(new URL('../partials/shell.html',import.meta.url),'utf8');
 const boot=readFileSync(new URL('../partials/boot.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const view=shell.slice(shell.indexOf('id="storeInfo"'),shell.indexOf('<!-- PARK KİMLİKLERİ'));
 assert.doesNotMatch(view,/\bon(?:click|change|input|submit)\s*=/i);
 assert.match(view,/data-dg-backup-action="download"/);
 assert.match(view,/data-dg-backup-action="pick-file"/);
 assert.match(view,/data-dg-backup-action="restore-file"/);
 assert.match(boot,/src\/ui\/backup-actions\.js/);
 assert.match(sw,/\/src\/ui\/backup-actions\.js/);
});
