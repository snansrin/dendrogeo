import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const modules=[
  'src/domain/parks/build-manual-backfill-park-update.js',
  'src/application/parks/complete-manual-backfill-park.js',
  'src/ui/park-backfill-manual-feedback.js',
  'src/application/parks/complete-park-backfill-apply.js',
  'src/ui/park-backfill-apply-feedback.js'
];
function app(){
  const context=vm.createContext({window:{}});
  for(const path of modules)vm.runInContext(read(path),context,{filename:path});
  return context.window;
}

test('manual park backfill updates the existing plan row before feedback and refresh',()=>{
  const window=app(),events=[];
  const row={project:{name:'Göksu Parkı - eski'}};
  const park={name:'Göksu Parkı',area_m2:12000};
  const update=window.DG_BUILD_MANUAL_BACKFILL_PARK_UPDATE.build({row,park,projectName:(name,label)=>name+' - '+label,labelFromLegacy:()=> 'saha'});
  assert.deepEqual(JSON.parse(JSON.stringify(update)),{durum:'eşleşti',parkName:'Göksu Parkı',yol:'elle oluşturuldu',newName:'Göksu Parkı - saha',cand:{name:'Göksu Parkı',area:12000}});
  const changed=window.DG_COMPLETE_MANUAL_BACKFILL_PARK.complete({
    result:{status:'created',row,park},
    buildUpdate:()=>update,
    updateRow:(target,patch)=>{Object.assign(target,patch);events.push('update');},
    showSuccess:()=>events.push('feedback'),renderPlan:()=>events.push('render'),refresh:()=>events.push('refresh')
  });
  assert.equal(changed,true);
  assert.equal(row.durum,'eşleşti');
  assert.deepEqual(events,['update','feedback','render','refresh']);
});

test('manual backfill completion leaves non-created results untouched',()=>{
  const window=app(),events=[];
  const changed=window.DG_COMPLETE_MANUAL_BACKFILL_PARK.complete({result:{status:'project-link-failed'},updateRow:()=>events.push('update'),showSuccess:()=>events.push('feedback'),renderPlan:()=>events.push('render'),refresh:()=>events.push('refresh')});
  assert.equal(changed,false);
  assert.deepEqual(events,[]);
});

test('bulk apply feedback keeps result wording and clear-close-refresh order',()=>{
  const window=app(),events=[];
  const result={status:'applied',successes:3,failures:1};
  const completed=window.DG_COMPLETE_PARK_BACKFILL_APPLY.complete({
    result,
    showResult:value=>window.DG_PARK_BACKFILL_APPLY_FEEDBACK_UI.show({result:value,translateFormat:(template,values)=>template.replace(/\{(\w+)\}/g,(_,key)=>values[key]),notify:(...args)=>events.push(['notify',...args])}),
    clearPlan:()=>events.push(['clear']),closePlan:()=>events.push(['close']),refresh:()=>events.push(['refresh'])
  });
  assert.equal(completed,true);
  assert.deepEqual(events,[['notify','✓ 3 proje parkla eşleştirildi · 1 hata','warn','🌳'],['clear'],['close'],['refresh']]);
});

test('bulk completion ignores non-applied results and UI escapes manual park names',()=>{
  const window=app(),events=[];
  assert.equal(window.DG_COMPLETE_PARK_BACKFILL_APPLY.complete({result:{status:'cancelled'},showResult:()=>events.push('show'),clearPlan:()=>events.push('clear'),closePlan:()=>events.push('close'),refresh:()=>events.push('refresh')}),false);
  window.DG_PARK_BACKFILL_MANUAL_FEEDBACK_UI.show({park:{name:'<Park>'},escape:value=>value.replace('<','&lt;').replace('>','&gt;'),notify:(...args)=>events.push(args)});
  assert.deepEqual(events,[['✓ &lt;Park&gt; oluşturuldu ve bağlandı','ok','🌳']]);
});

test('all five completion modules load before park registry and are precached',()=>{
  const head=read('partials/head.html'),worker=read('sw.js'),service=head.indexOf('src/services/park-registry.js');
  for(const path of modules){
    const index=head.indexOf('src/'+path.replace(/^src\//,''));
    assert.ok(index>=0&&index<service,path+' must load before park registry');
    assert.ok(worker.includes("'/"+path+"'"),path+' must be precached');
  }
});
