import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportCoverPresentation} from '../scripts/lib/report-cover-presentation.mjs';
import {QA_STATE} from '../scripts/lib/mc.mjs';

const render=createReportCoverPresentation({esc:v=>String(v).replaceAll('<','&lt;'),trNum:(v,d)=>Number(v).toFixed(d),QA_STATE,DGR_TITLE_DEF:'Report definition',FOUNDERS_LINE:'Founders'});
const base={id:'DGR-2026-0042',verTxt:'2.0',snap:{period:{from:'2026-10-01',to:'2026-10-11'},species:[1,2]},titleMain:'Park report',L:null,QA_ST_CLASS:'st',QA_ST_LABEL:'Valid',QA_ST:QA_STATE.VALID,subject:'Inventory',P:{city:'Ankara',country:'Türkiye',id:1},genTr:'11.10.2026',engine:'Engine',engineVer:null,appVer:null,dataYear:2021,resolutionLabel:'10 m',t:{n:3},parkHa:1,AU:{},qrUri:null,REPORT_URL:'https://reports.example/report/',hash:'1234567890abcdef1234567890'};

test('cover preserves institutional author, title fallback and plain permanent link',()=>{
  const html=render(base);
  assert.match(html,/<h1>Park report<\/h1>/);
  assert.match(html,/DendroGeo \(kurumsal\)/);
  assert.match(html,/istek sahibi adı çözülemedi/);
  assert.match(html,/tüm kritik kontroller geçti/);
  assert.match(html,/3 onaylı ölçüm · 2 tür/);
  assert.doesNotMatch(html,/<img|Engine v/);
  assert.match(html,/https:\/\/reports.example\/report\//);
});

test('academic title, author, QR, versions and blocked status retain their branches',()=>{
  const html=render({...base,snap:{...base.snap,study:{title:'<Study'}},AU:{name:'<Author'},qrUri:'data:image/svg+xml;base64,abc',engineVer:'4.2',appVer:'3.0',QA_ST:QA_STATE.BLOCKED,L:{review:{}}});
  assert.match(html,/<h1>&lt;Study<\/h1>/);
  assert.match(html,/&lt;Author/);
  assert.match(html,/kritik veri hatası/);
  assert.match(html,/kayıtlı yüzey sonucu/);
  assert.match(html,/Engine v4.2 · DendroGeo v3.0/);
  assert.match(html,/width="104" height="104"/);
  assert.doesNotMatch(html,/istek sahibi adı çözülemedi/);
  assert.match(render({...base,QA_ST:QA_STATE.REVIEW}),/istatistiksel kontroller inceleme uyarısı/);
});
