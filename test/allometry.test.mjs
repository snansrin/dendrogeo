/* allometry.test.mjs — DendroGeo karbon çekirdeği. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from '../scripts/test-harness.mjs';

const app=loadApp();
const {calc}=app;
const agb=(rhoKg,D,H)=>0.0673*Math.pow((rhoKg/1000)*D*D*H,0.976);

describe('calc() — Chave vd. (2014) çekirdeği',()=>{
 test('Kızılçam D=30 cm H=20 m kilitli 478 kg/m3 kullanır',()=>{
  const r=calc(30,20,'KIZILÇAM','İBRELİ');
  assert.equal(r.valid,true);
  assert.equal(r.density_kg_m3,478);
  assert.equal(r.agb,agb(478,30,20));
  assert.ok(Math.abs(r.agb-465.88921674)/465.88921674<1e-6);
 });
 test('BHB = AGB × 0,26',()=>{
  const r=calc(40,25,'MEŞE','YAPRAKLI');
  assert.ok(Math.abs(r.bhb/r.agb-0.26)<1e-9);
  assert.ok(Math.abs(r.bio-(r.agb+r.bhb))<1e-9);
 });
 test('karbon oranı 0,47 tutarlı',()=>{
  const r=calc(35,22,'KAYIN','YAPRAKLI');
  assert.ok(Math.abs(r.c_agb-r.agb*0.47)<1e-9);
  assert.ok(Math.abs(r.c_bhb-r.bhb*0.47)<1e-9);
  assert.ok(Math.abs(r.total_carbon-r.bio*0.47)<1e-9);
 });
 test('hacim = silindir × 0,5 form faktörü',()=>{
  const r=calc(30,20,'KIZILÇAM','İBRELİ');
  assert.ok(Math.abs(r.vol-Math.PI*Math.pow(30/200,2)*20*0.5)<1e-9);
 });
});

describe('calc() — geçersiz girdiler',()=>{
 for(const [ad,d,h] of [
  ['dbh=0',0,20],['h=0',30,0],['dbh negatif',-5,20],['h negatif',30,-3],
  ['dbh null',null,20],['h undefined',30,undefined],['dbh NaN',NaN,20],['ikisi NaN',NaN,NaN]
 ]){
  test(ad+' → hesap yok',()=>{
   const r=calc(d,h,'MEŞE','YAPRAKLI');
   assert.equal(r.valid,false);assert.equal(r.density_kg_m3,null);
   for(const k of ['agb','bhb','bio','c_agb','c_bhb','total_carbon','vol'])assert.equal(r[k],0,k);
  });
 }
});

describe('ρ tek-kaynak zinciri',()=>{
 test('kilitli tür kendi özel değerini kullanır',()=>{
  const r=calc(30,20,'KIZILÇAM','İBRELİ');
  assert.equal(r.density_kg_m3,478);
  assert.ok(Math.abs(r.agb-agb(478,30,20))<1e-9);
 });
 test('özel rho olmayan katalog türü yalnız kendi grup genelini kullanır',()=>{
  const a=calc(30,20,'JAPON SOFORASI','YAPRAKLI');
  const b=calc(30,20,'MAVİ LADİN','İBRELİ');
  assert.equal(a.density_kg_m3,541);
  assert.equal(b.density_kg_m3,446);
  assert.ok(Math.abs(a.agb-agb(541,30,20))<1e-9);
  assert.ok(Math.abs(b.agb-agb(446,30,20))<1e-9);
 });
 test('bilinmeyen tür grup varsayılanını kullanamaz',()=>{
  const r=calc(30,20,'BOYLE_BIR_TUR_YOK','YAPRAKLI');
  assert.equal(r.valid,false);assert.equal(r.total_carbon,0);
 });
 test('yanlış grup kullanılamaz',()=>{
  assert.equal(calc(30,20,'KARAÇAM','YAPRAKLI').valid,false);
  assert.equal(calc(30,20,'SÜS ERİĞİ','İBRELİ').valid,false);
 });
 test('DİĞER veya tanımsız grup için yoğunluk yoktur',()=>{
  for(const grp of ['DİĞER','TANIMSIZ_GRUP']){
   const r=calc(30,20,'KARAÇAM',grp);
   assert.equal(r.valid,false);assert.equal(r.density_kg_m3,null);assert.equal(r.total_carbon,0);
  }
 });
 test('CANARY: seçim kataloğu 49 tür; 16 özel, 33 grup-geneli',()=>{
  const hepsi=Object.values(app.SPECIES_DATA).flat();
  assert.equal(hepsi.length,49);
  assert.equal(hepsi.filter(x=>x.rho!=null).length,16);
  assert.equal(hepsi.filter(x=>x.rho==null).length,33);
  assert.equal(Object.keys(app.SPECIES_DATA).sort().join('|'),['İBRELİ','YAPRAKLI'].sort().join('|'));
 });
 test('eşanlamlılar mevcut kanonik türe iner',()=>{
  const rs=app.resolveSpeciesName;
  assert.equal(rs('Ağlayan Söğüt'),'SALKIM SÖĞÜT');
  assert.equal(rs('CEVIZ'),'CEVİZ');
  assert.equal(rs('Sığla'),'SIĞLA');
  assert.equal(rs('SIGLA'),'SIĞLA');
  assert.equal(rs('Liquidambar orientalis'),'SIĞLA');
  assert.equal(rs('OLMAYAN TÜR'),null);
 });
});

describe('SIĞLA çap-temelli çekirdek regresyonu',()=>{
 test('çekirdeğe gerçek DBH=57 cm verilirse 418,419108 kg C',()=>{
  for(const sp of ['SIĞLA','Sığla','SIGLA','Liquidambar orientalis']){
   const r=calc(57,7.5,sp,'YAPRAKLI');
   assert.equal(r.valid,true,sp);assert.equal(r.density_kg_m3,541,sp);
   assert.ok(Math.abs(r.total_carbon-418.41910806687343)<1e-9,sp+' C='+r.total_carbon);
  }
 });
});

describe('calc() — monotonluk',()=>{
 test('çap arttıkça biyokütle artar',()=>{
  let once=0;for(const d of [5,10,20,40,80,150]){const v=calc(d,20,'KIZILÇAM','İBRELİ').agb;assert.ok(v>once);once=v;}
 });
 test('boy arttıkça biyokütle artar',()=>{
  let once=0;for(const h of [3,8,15,25,40]){const v=calc(30,h,'KIZILÇAM','İBRELİ').agb;assert.ok(v>once);once=v;}
 });
 test('yoğunluk arttıkça biyokütle rho^0.976 ile ölçeklenir',()=>{
  const hafif=calc(30,20,'GÖKNAR','İBRELİ').agb, agir=calc(30,20,'KIZILÇAM','İBRELİ').agb;
  assert.ok(agir>hafif);
  assert.ok(Math.abs(agir/hafif-Math.pow(478/350,0.976))<1e-6);
 });
});
