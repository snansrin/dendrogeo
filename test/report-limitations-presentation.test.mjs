import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReportLimitationsPresentation} from '../scripts/lib/report-limitations-presentation.mjs';
import {QA_LIMITS, YASAL_STATU_KAPSAM} from '../scripts/lib/mc.mjs';

const number=(value,d)=>Number(value).toFixed(d);
const render=createReportLimitationsPresentation({trNum:number,QA_LIMITS,YASAL_STATU_KAPSAM});
const base={L:null,knotted:false,knotN:0,t:{n:2},G:{},INV:null,HD:null,DB:null,govdeAralikTxt:'range',tN:number};

test('base limitations retain sample scope, missing GNSS and legal scope without invented warnings',()=>{
  const html=render(base);
  assert.match(html,/Envanter 2 kayıtla sınırlıdır/);
  assert.match(html,/parkın toplam karbon stoku tahmin edilmemiştir/);
  assert.match(html,/accuracy_m.*kaydedilmemiştir/);
  assert.ok(html.includes(YASAL_STATU_KAPSAM));
  assert.doesNotMatch(html,/İnceleme Göstergesi|kendini kesen segment çifti/);
});

test('reviewed surface, GNSS and model review conditions preserve existing statements',()=>{
  const INV=Object.freeze({hd_review:true,hd_fail:[1],n:2,dbh_fail:[],dev_fail:[],n_unknown:0,group_fail:[]});
  const html=render({...base,L:{review:true,masked_ha:1.2},knotted:true,knotN:3,G:{n_with_acc:2,mean_acc_m:4.2},INV,DB:{}});
  assert.match(html,/OSM nesne sınırları ve kullanıcı çizimleri/);
  assert.match(html,/3 kendini kesen segment çifti/);
  assert.match(html,/GNSS doğruluğu \(±4.2 m\)/);
  assert.match(html,/İNCELEME GÖSTERGESİDİR/);
  assert.match(html,/rapor bu gerekçeyle bloklanmaz/);
  assert.match(html,/allometriye yalnız yuvarlanmamış türetilmiş D/);
  assert.match(html,/1.20 ha’lık bölümü bulut\/gölge/);
});
