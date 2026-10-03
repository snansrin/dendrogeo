"use strict";
/* DendroGeo · ui/lc-sens.js — 🛰 UYDU HASSASİYET PANELİ (0054 · 2026-10-03)
 *
 * KULLANICI İSTEĞİ (birebir): "yüzey analizi butonuna basınca barlar çıkıyor
 * ya — bunlar gibi yatay bar koy; kaydırdığımda mesela sert zemin
 * hassasiyeti artsın, uydu haritası üzerinde sert zeminleri işaretlesin,
 * gözümle görüp takip edeyim; doğru noktaları kabul ettiğimde kaydedip
 * öylece kalsın. Daha gelişmiş algılama, daha hassas ve GÜNCEL uydu
 * verisi. [Önceki 3 adımlı çalışma sahası] çok karışık olmuş — daha basit,
 * daha işlevsel olsun."
 *
 * AKIŞ (tek panel, sekme yok, karne yok):
 *   1) Yüzey Örtüsü Analizi biter → rapor barlarının ALTINDA bu panel belirir.
 *   2) 🔍 Tara → GÜNCEL sezon Sentinel-2 L2A bulutsuz medyan kompozit
 *      (aynı yılın ilkbahar/sonbahar kalıcılık kanıtıyla) → hücre başına
 *      NDVI/MNDWI/NDBI. Sonuç cihaza kaydedilir (IndexedDB) → bir dahaki
 *      ziyarette taramasız açılır, sahada çevrimdışı bile çalışır.
 *   3) Sınıf başına YATAY KAYDIRICI (0-100, varsayılan 50 = literatür
 *      kalibrasyonu): hassasiyet arttıkça eşik gevşer, o sınıfın ADAY
 *      hücreleri (spektral kanıt ≠ raster sınıfı) haritada sınıf rengiyle
 *      kesikli konturlanır. Kaydırıcı yalnız PROFİL ÜZERİNDEN yeniden
 *      hesaplar — ağ isteği yok, anlık.
 *   4) Kullanıcı uydu altlığında gözüyle doğrular: hücreye dokun →
 *      ✅ Kabul (spektral sınıfa düzelt) · ❌ Harita doğru · ↩ Geri al.
 *      Sınıf başına "✓ N adayı kabul et" toplu düğmesi de var.
 *   5) Kararlar park başına KALICI (IndexedDB) + "Onaylarınla" satırı
 *      düzeltilmiş hektarları anında gösterir + GeoJSON/CSV dışa aktarım
 *      (denetim izli: ne zaman, hangi hücre, hangi sınıftan hangi sınıfa).
 *
 * KIRMIZI ÇİZGİ: dgLcAnalyze çıktısı (DG_LC_LAST) salt okunur. Raster
 * alanları/rapor barları/yayın hattı DEĞİŞMEZ; onaylar AYRI bir
 * "doğrulanmış düzeltme" katmanıdır (Olofsson'un harita+saha-düzeltmesi
 * ayrılığı). applyCorrections saf fonksiyondur, yeni nesne döner.
 *
 * BAĞIMLILIKLAR (çağrı anında global): $, esc, toast, dgCf/dgTfs, map, L,
 * switchBaseLayer, DG_LC_LAST, DG_LC_CLASSES, downloadBlob, PARK_POLY,
 * window.DG_LC_VALIDATE, window.DG_LC_S2.
 * YÜKLEME SIRASI: lc-validate + lc-s2 + ui/lc-report'tan SONRA, facade'tan
 * ÖNCE (lazylibs DG_LULC_CHAIN). */

/* i18n güvenli yardımcılar (0037 deseni) */
const _tvs=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tvst=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));

const DG_SENS={
  record:null,     /* {id,parkId,parkName,sens,corrections,profile,scannedAt,period} */
  layer:null,      /* aday/onaylı hücre katmanı */
  busy:false,
  showCand:true,
  base:"sat",
  guard:true,      /* 0056: panel etkinken park algılama tıklamaları kapalı */
  debounce:null
};

/* 0056 MOD AYRIMI: panel monte olduğu anda guard AÇILIR — bindParkClick
 * (park-panel.js) window._dgSensGuard'a bakıp park algılamayı atlar.
 * Böylece aday-olmayan LULC gridlerine (interactive:false) veya boş
 * haritaya tıklama analiz akışını BOZAMAZ. Park seçmek için 🌳 düğmesi
 * guard'ı kapatır + Park Analizi Modu'nu açar. */
function dgSensGuard(on){
  DG_SENS.guard=!!on;
  try{window._dgSensGuard=!!on;}catch(e){}
}

function dgSensModeAnalysis(){
  dgSensGuard(true);
  dgSensRender();
  toast(_tvs("🛰 Analiz modu: park algılama duraklatıldı — hücrelere güvenle dokunabilirsin."),"info","🛰️");
}

function dgSensModePark(){
  dgSensGuard(false);
  if(typeof PARK_MODE!=="undefined"&&!PARK_MODE&&typeof toggleParkMode==="function"){
    try{toggleParkMode();}catch(e){}
  }
  dgSensRender();
  toast(_tvs("🌳 Park seçim modu: haritadan bir parka tıklayabilirsin. Analize dönmek için 🛰 düğmesine bas."),"info","🌳");
}

const DG_SENS_COLORS={green:"#22c55e",water:"#3b82f6",hard:"#64748b",bare:"#8b5a2b"};
const DG_SENS_CLASSES=["green","water","hard","bare"];

function dgSensParkId(){
  try{
    if(typeof DG_PARK_SESSION!=="undefined"&&DG_PARK_SESSION&&DG_PARK_SESSION.id)return{id:DG_PARK_SESSION.id,name:DG_PARK_SESSION.name||""};
  }catch(e){}
  return{id:null,name:""};
}

function dgSensCells(){
  const last=(typeof DG_LC_LAST!=="undefined")?DG_LC_LAST:null;
  return last&&last.result&&Array.isArray(last.result.cells)?last.result.cells:null;
}

function dgSensGroupAreas(){
  const last=(typeof DG_LC_LAST!=="undefined")?DG_LC_LAST:null;
  return last&&last.result&&last.result.groupAreas?last.result.groupAreas:{};
}

function dgSensMeta(k){
  const V=window.DG_LC_VALIDATE;
  return(V&&V.labels&&V.labels[k])||{tr:k,emoji:""};
}

function dgSensHa(m2){return(Number(m2||0)/10000).toFixed(2);}

/* ── kayıt (park başına tek, kalıcı) ── */
function dgSensNewRecord(){
  const pk=dgSensParkId();
  return{
    id:"sens-"+(pk.id||"x"),
    parkId:pk.id,parkName:pk.name,
    sens:{green:50,water:50,hard:50,bare:50},
    corrections:{},
    profile:null,
    scannedAt:null,
    period:"latest",
    createdAt:new Date().toISOString()
  };
}

async function dgSensLoadRecord(){
  const pk=dgSensParkId();
  const rec=dgSensNewRecord();
  if(!pk.id)return rec;
  try{
    const saved=await window.DG_LC_VALIDATE.loadCampaigns(pk.id);
    const hit=(saved||[]).find(r=>r&&r.id===rec.id);
    if(hit){
      hit.sens=Object.assign({green:50,water:50,hard:50,bare:50},hit.sens||{});
      if(!hit.corrections)hit.corrections={};
      return hit;
    }
  }catch(e){/* IndexedDB yok → bellek kaydına düş */}
  return rec;
}

function dgSensSave(){
  if(!DG_SENS.record)return Promise.resolve();
  return window.DG_LC_VALIDATE.saveCampaign(JSON.parse(JSON.stringify(DG_SENS.record))).catch(()=>{});
}

/* ── tahmin yardımcıları ── */
function dgSensPredict(sp){
  return window.DG_LC_VALIDATE.spectralPredict(sp,DG_SENS.record?DG_SENS.record.sens:null);
}

function dgSensCellKey(c){return c.row+":"+c.col;}

/* Aday: spektral tahmin (mevcut hassasiyetle) raster sınıfından FARKLI ve
 * hücre hakkında henüz karar yok. Kenar hücreleri (alan < %60) hariç —
 * karışık sınır pikseli gürültü üretir. */
function dgSensCandidates(cls){
  const rec=DG_SENS.record;
  const cells=dgSensCells();
  if(!rec||!rec.profile||!rec.profile.cells||!cells)return[];
  const out=[];
  const edge=window.DG_LC_VALIDATE.defaults.edgeAreaM2;
  for(const c of cells){
    if(Number(c.areaM2||0)<edge)continue;
    const key=dgSensCellKey(c);
    if(rec.corrections[key])continue;
    const sp=rec.profile.cells[key];
    if(!sp)continue;
    const pred=dgSensPredict(sp);
    if(pred!==cls||pred===c.classKey)continue;
    out.push({cell:c,pred,sp});
  }
  return out;
}

/* ── PANEL ── */
async function dgSensMount(hostId){
  const host=document.getElementById(hostId||"lcSens");
  if(!host)return;
  if(!dgSensCells()){host.style.display="none";return;}
  DG_SENS.record=await dgSensLoadRecord();
  host.style.display="block";
  dgSensGuard(true); /* 0056: analiz başladı — park algılama duraklatıldı */
  dgSensRender();
  dgSensRefreshLayer();
}

function dgSensRender(){
  const host=document.getElementById("lcSens");
  const rec=DG_SENS.record;
  if(!host||!rec)return;
  const V=window.DG_LC_VALIDATE;
  const scanned=!!(rec.profile&&rec.profile.cells);
  let h=
    `<div class="dg-sens-head">`+
      `<div>`+
        `<div class="dg-png-kicker">🛰 ${esc(_tvs("UYDU HASSASİYET"))} · SENTINEL-2</div>`+
        `<div class="dg-png-sub" style="font-size:.7rem">`+
          (scanned
            ? esc(_tvst("{p} · {n} sahne · {c} hücre profili",{p:rec.profile.range?rec.profile.range.label:"—",n:(rec.profile.scenes||[]).length+(rec.profile.waterScenes||[]).length,c:rec.profile.stats?rec.profile.stats.nProfiled:0}))
            : esc(_tvs("Güncel sezon Sentinel-2 görüntüsünden aday hücreleri bulur; kaydırıcıyla hassasiyeti ayarla, uydu altında gözünle doğrula, tek dokunuşla kabul et.")))+
        `</div>`+
      `</div>`+
      `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">`+
        `<span class="dg-sens-chip ${DG_SENS.guard?"on":""}" id="dgSensModeChip">${DG_SENS.guard?"🛡 "+esc(_tvs("Analiz modu · park algılama duraklatıldı")):"🌳 "+esc(_tvs("Park seçim modu açık"))}</span>`+
        `<button type="button" class="dg-png-btn ghost sm" onclick="dgSensModeAnalysis()" ${DG_SENS.guard?"disabled":""} title="${esc(_tvs("Analiz moduna dön"))}">🛰 ${esc(_tvs("Analiz"))}</button>`+
        `<button type="button" class="dg-png-btn ghost sm" onclick="dgSensModePark()" ${DG_SENS.guard?"":"disabled"} title="${esc(_tvs("Park seçmek için algılamayı aç"))}">🌳 ${esc(_tvs("Park seç"))}</button>`+
        `<button type="button" id="dgSensScanBtn" class="dg-png-btn ${scanned?"ghost":"primary"}" onclick="dgSensScan()">${scanned?"🔁 "+esc(_tvs("Yeniden Tara")):"🔍 "+esc(_tvs("Tara"))}</button>`+
        `<button type="button" class="dg-png-btn ghost" onclick="dgSensBase()" title="${esc(_tvs("Uydu/sokak altlığı"))}">${DG_SENS.base==="sat"?"🗺 "+esc(_tvs("Sokak")):"🛰 "+esc(_tvs("Uydu"))}</button>`+
      `</div>`+
    `</div>`;

  if(scanned){
    /* dönem seçici */
    h+=`<div class="dg-png-field" style="margin:4px 0">`+
      `<label class="dg-png-label" for="dgSensPeriod">${esc(_tvs("DÖNEM"))}</label>`+
      `<select id="dgSensPeriod" class="dg-png-select" onchange="dgSensPeriod(this.value)">`+
        `<option value="latest"${rec.period==="latest"?" selected":""}>${esc(_tvs("Güncel sezon (en yeni görüntü)"))}</option>`+
        `<option value="ref"${rec.period==="ref"?" selected":""}>${esc(_tvs("WorldCover yılı (2021)"))}</option>`+
      `</select></div>`;
    /* sınıf kaydırıcıları — kullanıcı istediği "rapor barları gibi yatay bar" */
    for(const k of DG_SENS_CLASSES){
      const m=dgSensMeta(k);
      const cand=dgSensCandidates(k);
      const nCorr=Object.values(rec.corrections).filter(r=>r.to===k&&r.from!==k).length;
      h+=
      `<div class="dg-sens-row">`+
        `<span class="dg-sens-label">${m.emoji||""} ${esc(m.tr||k)}</span>`+
        `<input type="range" class="dg-sens-slider" min="0" max="100" step="1" value="${Number(rec.sens[k])||50}" `+
          `oninput="dgSensSlide('${k}',this.value)" aria-label="${esc(m.tr||k)} ${esc(_tvs("hassasiyet"))}">`+
        `<span class="dg-sens-count" id="dgSensCnt-${k}">${cand.length} ${esc(_tvs("aday"))} · ✓${nCorr}</span>`+
        (cand.length?`<button type="button" class="dg-png-btn ghost sm" onclick="dgSensBulk('${k}')">✓ ${esc(_tvs("Hepsini kabul"))}</button>`:"")+
      `</div>`;
    }
    /* onay satırı: düzeltilmiş alanlar (anlık) */
    const adj=dgSensAdjusted();
    if(adj&&adj.n){
      const ra=adj.raster,ca=adj.corrected;
      h+=`<div class="dg-sens-adj">`+
        `<b>${esc(_tvs("Onaylarınla"))}</b> (${adj.nCorrected} ✏️ · ${adj.nConfirmed} ✅): `+
        DG_SENS_CLASSES.map(k=>{
          const d=(Number(ca[k]||0)-Number(ra[k]||0))/10000;
          return dgSensMeta(k).emoji+" "+dgSensHa(ca[k])+" ha"+(Math.abs(d)>=0.005?" <b>("+(d>0?"+":"")+d.toFixed(2)+")</b>":"");
        }).join(" · ")+
      `</div>`;
    }
    /* görünürlük + dışa aktarım */
    h+=
    `<div class="dg-sens-actions">`+
      `<label class="dg-png-option" style="flex:1;min-width:150px">`+
        `<span class="dg-png-icon">⚠</span>`+
        `<span class="dg-png-copy"><strong>${esc(_tvs("Adayları haritada göster"))}</strong></span>`+
        `<input type="checkbox" ${DG_SENS.showCand?"checked":""} onchange="dgSensToggleCand(this.checked)">`+
        `<span class="dg-png-switch"></span>`+
      `</label>`+
      `<button type="button" class="dg-png-btn ghost sm" onclick="dgSensExportGeoJson()">📥 GeoJSON</button>`+
      `<button type="button" class="dg-png-btn ghost sm" onclick="dgSensExportCsv()">📥 CSV</button>`+
      `<button type="button" class="dg-png-btn red sm" onclick="dgSensReset()">🗑 ${esc(_tvs("Kararları sıfırla"))}</button>`+
    `</div>`+
    `<div class="dg-sens-hint">${esc(_tvs("Hücreye dokun: ✅ Kabul (uydu gördüğün sınıf) · ❌ Harita doğru · ↩ Geri al. Kararlar bu park için kalıcıdır; raster sonucu değişmez, düzeltme katmanı ayrıca tutulur."))}</div>`;
  }
  host.innerHTML=h;
}

function dgSensAdjusted(){
  const rec=DG_SENS.record;
  const cells=dgSensCells();
  if(!rec||!cells||!Object.keys(rec.corrections||{}).length)return null;
  const ga=dgSensGroupAreas();
  const adj=window.DG_LC_VALIDATE.applyCorrections(ga,cells,rec.corrections);
  return{raster:ga,corrected:adj.correctedAreas,n:adj.nCorrected+adj.nConfirmed,nCorrected:adj.nCorrected,nConfirmed:adj.nConfirmed,movedAreaM2:adj.movedAreaM2};
}

/* ── tarama ── */
async function dgSensScan(){
  if(DG_SENS.busy)return;
  const cells=dgSensCells();
  const rec=DG_SENS.record;
  if(!cells||!cells.length){toast(_tvs("Hücre listesi boş — önce arazi örtüsü analizi."),"err","🛰️");return;}
  if(!rec)return;
  DG_SENS.busy=true;
  const btn=document.getElementById("dgSensScanBtn");
  if(btn){btn.disabled=true;btn.dataset.oldText=btn.innerHTML;btn.innerHTML="⏳ "+_tvs("Uydu verisi indiriliyor…");btn.style.opacity=".65";btn.style.cursor="wait";}
  toast(_tvs("🛰 Güncel Sentinel-2 sahneleri seçiliyor (bulutsuz medyan + mevsimsel kalıcılık)…"),"info","🛰️");
  try{
    const last=(typeof DG_LC_LAST!=="undefined")?DG_LC_LAST:null;
    const mode=rec.period==="ref"?"ref":"latest";
    const profile=await window.DG_LC_S2.profile(
      cells,
      (typeof PARK_POLY!=="undefined"?PARK_POLY:null),
      {year:(last&&last.report&&last.report.year)||2021,mode}
    );
    rec.profile={
      cells:profile.cells,
      stats:profile.stats,
      scenes:profile.scenes,
      waterScenes:profile.waterScenes||[],
      range:profile.range,
      skipped:profile.skipped
    };
    rec.scannedAt=new Date().toISOString();
    dgSensSave();
    /* 0056: gözle doğrulama GÖRÜNTÜDE yapılır — tarama bitince altlık
     * otomatik uyduya geçer (kullanıcı: "gözümle görüp takip edeyim"). */
    if(DG_SENS.base!=="sat"&&typeof switchBaseLayer==="function"){
      try{switchBaseLayer("sat");DG_SENS.base="sat";}catch(e){}
    }
    dgSensRender();
    dgSensRefreshLayer();
    toast(_tvst("✓ Tarama bitti: {n} hücre · kaydırıcıları oynat, adaylar haritada.",{n:profile.stats.nProfiled}),"ok","🛰️");
  }catch(err){
    toast(_tvs("Tarama başarısız: ")+String((err&&err.message)||err).slice(0,140),"err","🛰️");
  }finally{
    DG_SENS.busy=false;
    if(btn&&btn.dataset.oldText){btn.innerHTML=btn.dataset.oldText;btn.disabled=false;btn.style.opacity="";btn.style.cursor="";}
  }
}

function dgSensPeriod(v){
  if(DG_SENS.record)DG_SENS.record.period=(v==="ref"?"ref":"latest");
  dgSensScan();
}

/* ── kaydırıcı ── */
function dgSensSlide(cls,val){
  const rec=DG_SENS.record;
  if(!rec)return;
  rec.sens[cls]=Math.max(0,Math.min(100,Number(val)||50));
  /* sayaçları anlık güncelle (render pahalı olmasın), katmanı debounce'la */
  const cand=dgSensCandidates(cls);
  const el=document.getElementById("dgSensCnt-"+cls);
  if(el){
    const nCorr=Object.values(rec.corrections).filter(r=>r.to===cls&&r.from!==cls).length;
    el.textContent=cand.length+" "+_tvs("aday")+" · ✓"+nCorr;
  }
  if(DG_SENS.debounce)clearTimeout(DG_SENS.debounce);
  DG_SENS.debounce=setTimeout(()=>{dgSensRefreshLayer();dgSensSave();},220);
}

function dgSensToggleCand(on){
  DG_SENS.showCand=!!on;
  dgSensRefreshLayer();
}

function dgSensBase(){
  DG_SENS.base=DG_SENS.base==="sat"?"osm":"sat";
  if(typeof switchBaseLayer==="function")switchBaseLayer(DG_SENS.base);
  dgSensRender();
}

/* ── harita katmanı: adaylar kesikli, onaylılar dolu ── */
function dgSensRefreshLayer(){
  if(typeof map==="undefined"||!map||!window.L)return;
  if(DG_SENS.layer){map.removeLayer(DG_SENS.layer);DG_SENS.layer=null;}
  const rec=DG_SENS.record;
  const cells=dgSensCells();
  if(!rec||!rec.profile||!rec.profile.cells||!cells)return;
  const renderer=(typeof L.canvas==="function")?L.canvas({padding:.25}):null;
  DG_SENS.layer=L.layerGroup().addTo(map);
  const edge=window.DG_LC_VALIDATE.defaults.edgeAreaM2;
  let n=0;
  for(const c of cells){
    if(n++>=5000)break; /* mobil koruma tavanı */
    const key=dgSensCellKey(c);
    const sp=rec.profile.cells[key];
    if(!sp)continue;
    if(Number(c.areaM2||0)<edge)continue;
    const dec=rec.corrections[key];
    const pred=dgSensPredict(sp);
    const isCand=!dec&&pred!==c.classKey&&pred!=="ambiguous"&&pred!=="nodata";
    if(!dec&&!isCand)continue;
    if(isCand&&!DG_SENS.showCand)continue;
    if(!c.quadWgs||c.quadWgs.length!==4)continue;
    const latlngs=c.quadWgs.map(p=>[p[1],p[0]]);
    let style;
    if(dec&&dec.to&&dec.to!==dec.from){
      style={color:DG_SENS_COLORS[dec.to]||"#14532d",weight:1.6,fill:true,fillColor:DG_SENS_COLORS[dec.to]||"#14532d",fillOpacity:.5};
    }else if(dec){
      style={color:"#16a34a",weight:1.4,fill:false,dashArray:"2,3"};
    }else{
      style={color:DG_SENS_COLORS[pred]||"#dc2626",weight:2,dashArray:"5,4",fill:true,fillColor:DG_SENS_COLORS[pred]||"#dc2626",fillOpacity:.14};
    }
    style.interactive=true;
    style.renderer=renderer||undefined;
    const poly=L.polygon(latlngs,style);
    /* 0055 REGRESYON (kullanıcı bildirimi: "yeşil gridleri seçerken sistem
     * tekrardan park algılama moduna geçiyor"): Leaflet'te interaktif
     * katmana tıklama DOM'da haritaya KABARIR → PARK_MODE açıksa
     * bindParkClick aynı tıklamayla yeniden park algılar, drawPark
     * paneli sökerdi. Katman olayındaki özgün DOM olayının kabarması
     * burada durdurulur — popup açılır, harita tıklaması YANMAZ. */
    poly.on("click",ev=>{
      try{
        const oe=ev&&(ev.originalEvent||ev);
        if(oe&&window.L&&L.DomEvent&&L.DomEvent.stopPropagation)L.DomEvent.stopPropagation(oe);
      }catch(e){}
      dgSensPopup(key);
    });
    poly.addTo(DG_SENS.layer);
  }
}

function dgSensPopup(key){
  const rec=DG_SENS.record;
  const cells=dgSensCells();
  if(!rec||!cells)return;
  const c=cells.find(x=>dgSensCellKey(x)===key);
  if(!c||!rec.profile||!rec.profile.cells[key])return;
  const sp=rec.profile.cells[key];
  const pred=dgSensPredict(sp);
  const dec=rec.corrections[key];
  const mR=dgSensMeta(c.classKey);
  const V=window.DG_LC_VALIDATE;
  const ibi=V.ibi?V.ibi(sp.ndvi,sp.mndwi,sp.ndbi):null;
  const my=sp.mndwiMaxYear!==undefined?sp.mndwiMaxYear:(sp.mndwiMax!==undefined?sp.mndwiMax:sp.mndwi);
  const ny=sp.ndviMaxYear!==undefined?sp.ndviMaxYear:(sp.ndviMax!==undefined?sp.ndviMax:sp.ndvi);
  let html=
    `<div style="font-size:.78rem;line-height:1.5;min-width:210px">`+
      `<b>${esc(_tvs("Harita"))}:</b> ${mR.emoji||""} ${esc(mR.tr||c.classKey)}<br>`+
      `<b>${esc(_tvs("Uydu kanıtı"))}:</b> ${pred==="ambiguous"||pred==="nodata"?"—":((dgSensMeta(pred).emoji||"")+" "+esc(dgSensMeta(pred).tr||pred))}<br>`+
      `<span style="font-size:.68rem;color:#555">NDVI ${(+sp.ndvi).toFixed(2)} · MNDWI ${(+sp.mndwi).toFixed(2)}${my!==undefined&&my!==null?" · 💧"+(+my).toFixed(2):""}${ny!==undefined&&ny!==null?" · 🌱"+(+ny).toFixed(2):""}${ibi!==null?" · IBI "+(+ibi).toFixed(2):""}</span><br>`+
      `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">`;
  if(pred!=="ambiguous"&&pred!=="nodata"&&pred!==c.classKey){
    html+=`<button type="button" class="dg-png-btn primary sm" onclick="dgSensDecide('${esc(key)}','${esc(pred)}')">✅ ${esc(_tvs("Kabul"))}</button>`;
  }
  html+=`<button type="button" class="dg-png-btn ghost sm" onclick="dgSensDecide('${esc(key)}','${esc(c.classKey)}')">❌ ${esc(_tvs("Harita doğru"))}</button>`;
  if(dec)html+=`<button type="button" class="dg-png-btn red sm" onclick="dgSensUndo('${esc(key)}')">↩ ${esc(_tvs("Geri al"))}</button>`;
  html+=`</div></div>`;
  if(typeof L!=="undefined"&&L.popup){
    L.popup({maxWidth:280,className:"dg-sens-popup"})
      .setLatLng([c.center.lat,c.center.lon])
      .setContent(html)
      .openOn(map);
  }
}

function dgSensDecide(key,toCls){
  const rec=DG_SENS.record;
  const cells=dgSensCells();
  if(!rec||!cells)return;
  const c=cells.find(x=>dgSensCellKey(x)===key);
  if(!c)return;
  if(!rec.corrections)rec.corrections={};
  rec.corrections[key]={from:c.classKey,to:toCls||c.classKey,ts:new Date().toISOString()};
  try{map.closePopup();}catch(e){}
  dgSensRefreshLayer();
  dgSensRender();
  dgSensSave();
}

function dgSensUndo(key){
  const rec=DG_SENS.record;
  if(!rec||!rec.corrections)return;
  delete rec.corrections[key];
  try{map.closePopup();}catch(e){}
  dgSensRefreshLayer();
  dgSensRender();
  dgSensSave();
}

function dgSensBulk(cls){
  const cand=dgSensCandidates(cls);
  if(!cand.length)return;
  if(!confirm(_tvst("{n} aday hücre '{c}' olarak kabul edilsin mi? (Yalnız görüntüyle gözle doğruladığın sınıf için kullan)",{n:cand.length,c:dgSensMeta(cls).tr||cls})))return;
  const rec=DG_SENS.record;
  if(!rec.corrections)rec.corrections={};
  const now=new Date().toISOString();
  for(const x of cand)rec.corrections[dgSensCellKey(x.cell)]={from:x.cell.classKey,to:cls,ts:now};
  dgSensRefreshLayer();
  dgSensRender();
  dgSensSave();
  toast(_tvst("✓ {n} hücre kabul edildi ve kaydedildi.",{n:cand.length}),"ok","⚖");
}

function dgSensReset(){
  const rec=DG_SENS.record;
  if(!rec)return;
  if(!confirm(_tvs("Tüm kararlar silinsin mi? (Tarama profili kalır)")))return;
  rec.corrections={};
  dgSensRefreshLayer();
  dgSensRender();
  dgSensSave();
}

/* ── dışa aktarım ── */
function dgSensExportGeoJson(){
  const rec=DG_SENS.record;
  const cells=dgSensCells();
  if(!rec||!cells||!Object.keys(rec.corrections||{}).length){toast(_tvs("Önce en az bir karar ver."),"warn","📥");return;}
  const fc=window.DG_LC_VALIDATE.correctedGeoJson(cells,rec.corrections,rec.profile?rec.profile.cells:null);
  if(typeof downloadBlob==="function"){
    downloadBlob("dendrogeo_onayli_hucreler_"+(rec.parkId||"park")+".geojson","application/geojson;charset=utf-8",JSON.stringify(fc,null,1));
    toast(_tvs("✓ Onaylı hücre GeoJSON'u indirildi (denetim izli)."),"ok","📥");
  }
}

function dgSensExportCsv(){
  const rec=DG_SENS.record;
  const cells=dgSensCells();
  if(!rec||!cells){toast(_tvs("Önce en az bir karar ver."),"warn","📥");return;}
  const adj=dgSensAdjusted();
  const camp={
    id:rec.id,parkId:rec.parkId,parkName:rec.parkName,seed:0,
    samples:[],labels:{},corrections:rec.corrections,
    metrics:null,gate:null,
    correctedAreas:adj?adj.corrected:null,
    rasterAreas:adj?adj.raster:null,
    createdAt:rec.scannedAt||rec.createdAt,
    engineVersion:(typeof DG_LC_ENGINE_VERSION!=="undefined")?DG_LC_ENGINE_VERSION:"?",
    sens:rec.sens,period:rec.period
  };
  if(typeof downloadBlob==="function"){
    downloadBlob("dendrogeo_onaylar_"+(rec.parkId||"park")+".csv","text/csv;charset=utf-8",window.DG_LC_VALIDATE.csv(camp));
    toast(_tvs("✓ Onay CSV'si indirildi."),"ok","📥");
  }
}

/* ── temizlik (clearPark kancası) ── */
function dgSensCleanup(){
  if(DG_SENS.layer&&typeof map!=="undefined"&&map){try{map.removeLayer(DG_SENS.layer);}catch(e){}}
  DG_SENS.layer=null;
  DG_SENS.record=null;
  dgSensGuard(false); /* 0056: park kapandı — algılama serbest */
  const host=document.getElementById("lcSens");
  if(host){host.style.display="none";host.innerHTML="";}
}

window.DG_LC_SENS={
  mount:dgSensMount,
  cleanup:dgSensCleanup,
  guard:dgSensGuard,
  state:DG_SENS
};
