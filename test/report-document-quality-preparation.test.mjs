import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareReportDocumentQuality} from '../scripts/lib/report-document-quality-preparation.mjs';

test('document QA preparation preserves snapshot counts, area disclosures and delegated table state',()=>{
  const calls=[];
  const summary={QA_ST:'review',QA_ST_LABEL:'🟡 İNCELEME',QA_ST_CLASS:'st-warn',QA_BLOCKED:false,QA_REVIEW:true,qaStates:['review','info']};
  const result=prepareReportDocumentQuality({
    snap:{rows:[{photo:true},{photo:false}],qa:{species:{sample:1}},totals:{n:7}},
    t:{n:7},P:{area_m2:100000},L:{coverage_m2:110000,classified_m2:90000,review:{}},
    GQ:{source:'osm'},knotted:true,knotN:2,dataset:'WorldCover',dataYear:2021,
    resolutionLabel:'10 m',INV:{sample:1},G:{n:2},hash:'digest',
    createReportQaPresentation:dependencies=>{
      calls.push(['presentation',dependencies]);
      return{row:'qa-row',summary:()=>summary};
    },
    qaStateOf:()=>{},QA_STATE:{},renderInventoryDetails:inventory=>{
      calls.push(['inventory',inventory]);
      return{tN:2,DB:18,HD:12,govdeAralikTxt:'range',hdDetail:'height',devDetail:'carbon'};
    },
    renderQaTable:values=>{calls.push(['table',values]);return'<tr>qa</tr>';},
    explainReportQa:values=>{calls.push(['explanation',values]);return{AGAC_DEGER_TEMIZ:true,QA_WHY:'accuracy not recorded'};},
  });
  assert.equal(result.NR,2);
  assert.equal(result.nPhoto,1);
  assert.equal(result.parkHa,10);
  assert.equal(result.covHa,11);
  assert.equal(result.clsHa,9);
  assert.equal(result.diffHa,1);
  assert.equal(result.deltaPct,10);
  assert.equal(result.qaRows,'<tr>qa</tr>');
  assert.equal(result.QA_ST_LABEL,'🟡 İNCELEME');
  assert.deepEqual(result.qaStates,['review','info']);
  assert.equal(result.QA_WHY,'accuracy not recorded');
  assert.equal(calls.find(([name])=>name==='table')[1].qaRow,'qa-row');
  assert.equal(calls.find(([name])=>name==='table')[1].deltaPct,10);
  assert.equal(calls.find(([name])=>name==='explanation')[1].nPhoto,1);
});

test('snapshot-reported photo counts and explicit zero area delta take precedence',()=>{
  const result=prepareReportDocumentQuality({
    snap:{rows:[],qa:{photos:{n_with:0}},totals:{n:4}},t:{n:4},
    P:{area_m2:20000},L:{coverage_m2:0,classified_m2:0,areaDeltaPct:0,review:{}},
    GQ:null,knotted:false,knotN:null,dataset:'x',dataYear:2021,resolutionLabel:'10 m',
    INV:null,G:{},hash:'h',
    createReportQaPresentation:()=>({row:null,summary:()=>({})}),
    qaStateOf:()=>{},QA_STATE:{},
    renderInventoryDetails:()=>({}),renderQaTable:()=>'',explainReportQa:()=>({}),
  });
  assert.equal(result.NR,4);
  assert.equal(result.nPhoto,0);
  assert.equal(result.parkHa,2);
  assert.equal(result.covHa,null);
  assert.equal(result.clsHa,null);
  assert.equal(result.deltaPct,0);
});
