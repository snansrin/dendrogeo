import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareReportDocumentContext} from '../scripts/lib/report-document-context.mjs';

const dependencies={
  fmtT:value=>Number(value).toFixed(2),
  fmtDateTr:value=>`tr:${value}`,
  esc:value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char])),
  epsgLabel:value=>value? `EPSG:${value}`: '—',
  SITE_ORIGIN:'https://example.test',
};

test('document context preserves metadata precedence, disclosures and presentation labels',()=>{
  const context=prepareReportDocumentContext({
    snap:{
      totals:{ci:{mean:1250,lo:1000,hi:1500}},
      park:{name:'Park <A>',city:'Ankara & Çankaya',osm_key:'way/42',area_m2:1000},
      provenance:{doi:'10.1234/example',engine:'engine-a',app_version:'1.2',epsg:4326,qr_uri:'data:qr',git_commit:'abc'},
      lulc:{review:{},source:'reviewed source',year:2024,epsg:3857},
      geometry_qa:{source:'geom_json accepted',geom_json_bbox_ignored:true,self_intersections:0},
      qa:{species:{n:1}},gps:{n:3},generated_at:'2026-10-12',
    },
    id:'DGR-2026-0001',hash:'digest',version:'2',meta:{engine:'engine-b',doi:'10.5678/override'},
    dependencies,
  });
  assert.equal(context.t.ci.mean,1250);
  assert.equal(context.P.name,'Park <A>');
  assert.equal(context.M.engine,'engine-b');
  assert.equal(context.doi,'10.5678/override');
  assert.equal(context.verTxt,'2.0');
  assert.equal(context.L.source,'reviewed source');
  assert.equal(context.GJ,true);
  assert.equal(context.srcTxt,'uygulamada çizilen park poligonundan (parks.geom_json)');
  assert.equal(context.knotN,0);
  assert.equal(context.knotted,false);
  assert.equal(context.ciTxt,'1.25 t [%95 GA: 1.00–1.50]');
  assert.equal(context.engine,'engine-b');
  assert.equal(context.engineVer,null);
  assert.equal(context.appVer,'1.2');
  assert.equal(context.git,'abc');
  assert.equal(context.resolutionLabel,'Uydu 10/20 m + vektör sınır');
  assert.equal(context.dataset,'reviewed source');
  assert.equal(context.dataYear,2024);
  assert.equal(context.epsg,'EPSG:3857');
  assert.equal(context.genTr,'tr:2026-10-12');
  assert.equal(context.REPORT_URL,'https://example.test/rapor/DGR-2026-0001/');
  assert.equal(context.qrUri,'data:qr');
  assert.equal(context.subject,'Park <A> Ağaç Envanteri, Karbon Stoku ve Arazi Örtüsü Analizi');
  assert.equal(context.titleMain,'Park &lt;A&gt; (Ankara &amp; Çankaya): Bireysel Ağaç Envanteri ve Toprak Üstü / Toprak Altı Karbon Stoku');
});

test('document context preserves default source, engine, dataset and version fallbacks',()=>{
  const context=prepareReportDocumentContext({
    snap:{
      totals:{ci:{mean:10,lo:8,hi:12}},
      park:{name:'Park',city:'İzmir',osm_key:'<relation/7>'},
      provenance:{doi:'invalid',epsg:null},
      lulc:{error:'unavailable'},
    },
    id:'DGR-2026-0002',hash:'hash',version:'1.2',meta:null,dependencies,
  });
  assert.equal(context.doi,null);
  assert.equal(context.verTxt,'1.2');
  assert.equal(context.L,null);
  assert.equal(context.GQ,null);
  assert.equal(context.GJ,null);
  assert.equal(context.srcTxt,'OpenStreetMap <code>&lt;relation/7&gt;</code> geometrisinden');
  assert.deepEqual(context.G,{});
  assert.equal(context.knotN,null);
  assert.equal(context.knotted,false);
  assert.equal(context.engine,'DendroGeo LC Engine');
  assert.equal(context.resolutionLabel,'10 m');
  assert.equal(context.dataset,'ESA WorldCover 10 m · 2021 (v200)');
  assert.equal(context.dataYear,2021);
  assert.equal(context.epsg,'—');
  assert.equal(context.REPORT_URL,'https://example.test/rapor/DGR-2026-0002/');
  assert.equal(context.qrUri,null);
});
