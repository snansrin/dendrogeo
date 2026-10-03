"use strict";
/* DendroGeo · ui/lc-workbench.js — DOĞRULAMA ÇALIŞMA SAHASI (v5 · 2026-10-03)
 *
 * Park panelindeki "🛰 Uydu Doğrulama" kartının beyni. Üç adım:
 *   A · SPEKTRAL TARAMA   — Sentinel-2 L2A medyan kompozit → hücre bazında
 *                           NDVI/MNDWI/NDBI → otomatik uzlaşma + uyuşmazlık
 *                           hücrelerinin kırmızı işaretlenmesi (lc-s2.js).
 *   B · ÖRNEKLEM TURU     — Olofsson tabakalı örnek noktalar; Esri World
 *                           Imagery (~0.5 m) altlığında sıralı etiketleme
 *                           (bottom sheet, tek el/telefon kullanımı).
 *   C · DOĞRULUK KARNESİ  — hata matrisi, OA±CI95, kappa, UA/PA, alan
 *                           düzeltmeli hektarlar ± CI, kapı hükmü, CSV/JSON
 *                           dışa aktarım + IndexedDB kampanya kalıcılığı.
 *
 * KIRMIZI ÇİZGİ: bu modül hiçbir sayısal alan sonucunu DEĞİŞTİRMEZ.
 * dgLcAnalyze çıktısı (DG_LC_LAST) salt okunur; karne yalnız ÖLÇER ve
 * BEYAN eder. Yayın hattı (make-report/publish-queue) bu modülü tanımaz.
 *
 * BAĞIMLILIKLAR (çağrı anında global): $, esc, toast, dgCf/dgTfs (i18n),
 * map, L, switchBaseLayer, DG_LC_LAST, DG_LC_CLASSES, DG_LC_LAYER,
 * window.DG_LC_VALIDATE (lc-validate.js), window.DG_LC_S2 (lc-s2.js),
 * downloadBlob (park-export.js), PARK_POLY/PARK_HOLES, dgParkId/dgCurrentPark.
 * YÜKLEME SIRASI: zincirde lc-validate + lc-s2 + ui/lc-report'tan SONRA,
 * landcover facade'tan ÖNCE (lazylibs DG_LULC_CHAIN). */

/* i18n güvenli yardımcılar (0037 deseni): harness'ler i18n.js'siz yükleyebilir */
const _tvw=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tvwt=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));

/* Tek sahip: çalışma sahası durumu */
const DG_VALW={
  open:false,
  tab:"A",
  campaign:null,        /* {id,parkId,parkName,seed,samples,labels{},spectral,metrics,agreement,gate,createdAt,scenes,engineVersion} */
  markers:[],           /* [{sample,marker}] */
  flagLayer:null,       /* uyuşmazlık hücreleri L.layerGroup */
  tourIdx:-1,           /* etiketleme turu aktif örnek indeksi */
  busy:false,
  baseBeforeTour:null
};

function dgValwParkId(){
  /* park-panel kimlik çipiyle aynı kaynak: DG_PARK_SESSION (park-registry) */
  try{
    if(typeof DG_PARK_SESSION!=="undefined"&&DG_PARK_SESSION&&DG_PARK_SESSION.id)return{id:DG_PARK_SESSION.id,name:DG_PARK_SESSION.name||""};
  }catch(e){}
  return{id:null,name:(typeof PARK_POLY!=="undefined"&&PARK_POLY&&PARK_POLY.length)?"seçili park":""};
}

function dgValwCells(){
  const last=(typeof DG_LC_LAST!=="undefined")?DG_LC_LAST:null;
  return last&&last.result&&Array.isArray(last.result.cells)?last.result.cells:null;
}

/* ═════════════ AÇILIŞ / KURULUM ═════════════ */

async function dgValwOpen(){
  const host=document.getElementById("valWorkbench");
  if(!host)return;
  if(!dgValwCells()){
    toast(_tvw("Önce 🌿 Yüzey Örtüsü Analizi'ni çalıştırın — doğrulama onun hücreleri üzerinde yapılır."),"warn","🛰️");
    return;
  }
  DG_VALW.open=true;
  host.style.display="block";
  /* Parkın kayıtlı kampanyası varsa geri yükle (saha sürekliliği: telefon
   * değişse/yenilense bile etiketleme kaldığı yerden devam eder). */
  if(!DG_VALW.campaign){
    try{
      const pk=dgValwParkId();
      const saved=pk.id?await window.DG_LC_VALIDATE.loadCampaigns(pk.id):[];
      if(saved&&saved.length){
        saved.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
        DG_VALW.campaign=saved[0];
        toast(_tvwt("💾 Kayıtlı kampanya yüklendi: {n} örnek",{n:(DG_VALW.campaign.samples||[]).length}),"info","🛰️");
      }
    }catch(e){/* IndexedDB yoksa sessiz: kampanya bellekte yaşar */}
  }
  dgValwRender();
}

function dgValwClose(){
  const host=document.getElementById("valWorkbench");
  if(host)host.style.display="none";
  DG_VALW.open=false;
  dgValwEndTour(false);
}

function dgValwTab(t){
  DG_VALW.tab=t;
  dgValwRender();
}

function dgValwRender(){
  const host=document.getElementById("valWorkbench");
  if(!host)return;
  const c=DG_VALW.campaign;
  const nLab=c?Object.keys(c.labels||{}).length:0;
  const nSmp=c?(c.samples||[]).length:0;
  const hasSpec=!!(c&&c.spectral);
  const hasMatrix=nLab>0;
  host.innerHTML=
    `<div class="dg-valw-tabs" role="tablist" aria-label="${esc(_tvw("Doğrulama adımları"))}">`+
      `<button type="button" role="tab" aria-selected="${DG_VALW.tab==="A"}" class="dg-valw-tab${DG_VALW.tab==="A"?" on":""}" onclick="dgValwTab('A')">🛰 A · ${esc(_tvw("Spektral"))}</button>`+
      `<button type="button" role="tab" aria-selected="${DG_VALW.tab==="B"}" class="dg-valw-tab${DG_VALW.tab==="B"?" on":""}" onclick="dgValwTab('B')">🎯 B · ${esc(_tvw("Örneklem"))}${nSmp?" ("+nLab+"/"+nSmp+")":""}</button>`+
      `<button type="button" role="tab" aria-selected="${DG_VALW.tab==="C"}" class="dg-valw-tab${DG_VALW.tab==="C"?" on":""}" onclick="dgValwTab('C')" ${hasMatrix?"":"disabled"}>📊 C · ${esc(_tvw("Karne"))}</button>`+
    `</div>`+
    `<div class="dg-valw-pane" style="margin-top:8px">`+
      (DG_VALW.tab==="A"?dgValwPaneA():DG_VALW.tab==="B"?dgValwPaneB():dgValwPaneC())+
    `</div>`;
}

/* ═════════════ ADIM A · SPEKTRAL TARAMA ═════════════ */

function dgValwPaneA(){
  const c=DG_VALW.campaign;
  const spec=c&&c.spectral;
  let out=
    `<div class="dg-png-sub" style="margin-bottom:8px">`+
      esc(_tvw("Sentinel-2 L2A bulutsuz medyan kompozit, WorldCover referans dönemiyle aynı vejetasyon sezonundan seçilir. Her 10 m hücrede NDVI/MNDWI/NDBI hesaplanır; spektral tahmin sınıflandırmayla karşılaştırılır. Bu adım OTOMATİKTİR ve sayısal alan sonuçlarını değiştirmez."))+
    `</div>`+
    `<div class="dg-png-fields">`+
      `<div class="dg-png-field"><label class="dg-png-label" for="valwPeriod">${esc(_tvw("DÖNEM"))}</label>`+
        `<select id="valwPeriod" class="dg-png-select">`+
          `<option value="ref" selected>${esc(_tvw("WorldCover yılı (2021 Haz–Eyl)"))}</option>`+
          `<option value="latest">${esc(_tvw("Güncel sezon (değişim notu)"))}</option>`+
        `</select></div>`+
    `</div>`+
    `<button id="valwScanBtn" class="dg-png-btn primary" onclick="dgValwRunSpectral()">${spec?esc(_tvw("🔁 Spektral Taramayı Yenile")):esc(_tvw("🛰 Spektral Taramayı Başlat"))}</button>`;

  if(spec){
    const ag=spec.agreement;
    out+=`<div style="margin-top:10px">`+
      `<div class="dg-png-kicker">${esc(_tvw("OTOMATİK UZLAŞMA (hücre bazında)"))}</div>`;
    const clsOrder=["green","water","hard","bare"];
    const colors={green:"#22c55e",water:"#3b82f6",hard:"#64748b",bare:"#8b5a2b"};
    for(const k of clsOrder){
      const p=ag.perClass[k];
      const pct=p.pct===null?null:p.pct;
      out+=`<div class="dg-valw-bar-row">`+
        `<span class="dg-valw-bar-label">${(window.DG_LC_VALIDATE.labels[k]||{}).emoji||""} ${esc((window.DG_LC_VALIDATE.labels[k]||{}).tr||k)}</span>`+
        `<span class="dg-valw-bar"><i style="width:${pct===null?0:pct}%;background:${colors[k]}"></i></span>`+
        `<span class="dg-valw-bar-val">${pct===null?"—":"%"+pct}</span>`+
      `</div>`;
    }
    out+=
      `<div style="margin-top:6px">`+
        `<span class="dg-valw-chip">${esc(_tvw("Genel uzlaşma"))}: <b>${ag.overallPct===null?"—":"%"+ag.overallPct}</b> (${ag.nCandidates} ${esc(_tvw("hücre"))})</span>`+
        `<span class="dg-valw-chip">⚠ ${ag.flagged.length} ${esc(_tvw("uyuşmazlık"))}</span>`+
        `<span class="dg-valw-chip">🛰 ${spec.stats.nProfiled}/${spec.stats.nCells} ${esc(_tvw("profilli"))}</span>`+
        `<span class="dg-valw-chip">📅 ${esc(spec.range.label)}</span>`+
      `</div>`+
      `<div class="dg-valw-scenes">`+
        spec.scenes.map(s=>"🛰 "+esc(s.datetime)+" · ☁ %"+s.cloud+" · "+s.usedCells+" "+_tvw("hücre")).join("<br>")+
        (spec.waterScenes&&spec.waterScenes.length
          ?"<br>💧 "+_tvw("su kalıcılığı")+": "+spec.waterScenes.map(s=>esc(s.datetime)+" ("+esc(String(s.window||"").slice(0,13))+") ☁ %"+s.cloud).join(" · ")
          :"")+
        (spec.skipped&&spec.skipped.length?"<br>⚠ "+_tvw("atlanan sahne")+": "+spec.skipped.map(s=>esc(s.id)).join(", "):"")+
      `</div>`+
      `<label class="dg-png-option" style="margin-top:8px">`+
        `<span class="dg-png-icon">⚠</span>`+
        `<span class="dg-png-copy"><strong>${esc(_tvw("Uyuşmazlık hücrelerini vurgula"))}</strong>`+
        `<span>${esc(_tvw("Kırmızı kontur: spektral tahmin ile harita sınıfı ayrışan hücreler"))}</span></span>`+
        `<input type="checkbox" id="valwFlagTog" ${DG_VALW.flagLayer?"checked":""} onchange="dgValwToggleFlags(this.checked)">`+
        `<span class="dg-png-switch"></span>`+
      `</label>`+
      `<div class="dg-png-field" style="margin-top:6px">`+
        `<label class="dg-png-label" for="valwOpacity">${esc(_tvw("SINIFLANDIRMA SAYDAMLIĞI"))}</label>`+
        `<input type="range" id="valwOpacity" class="dg-valw-slider" min="0" max="100" value="38" oninput="dgValwSetOpacity(this.value)" aria-label="${esc(_tvw("Sınıflandırma katmanı saydamlığı"))}">`+
      `</div>`+
    `</div>`;
  }
  return out;
}

async function dgValwRunSpectral(){
  if(DG_VALW.busy)return;
  const cells=dgValwCells();
  if(!cells||!cells.length){toast(_tvw("Hücre listesi boş — önce arazi örtüsü analizi."),"err","🛰️");return;}
  DG_VALW.busy=true;
  const btn=document.getElementById("valwScanBtn");
  if(btn){btn.disabled=true;btn.dataset.oldText=btn.innerHTML;btn.innerHTML="⏳ "+_tvw("Sahneler indiriliyor…");btn.style.opacity=".65";btn.style.cursor="wait";}
  toast(_tvw("🛰 Sentinel-2 spektral tarama başladı — bulutsuz sahneler seçiliyor…"),"info","🛰️");
  try{
    const periodSel=document.getElementById("valwPeriod");
    const mode=periodSel&&periodSel.value==="latest"?"latest":"ref";
    const last=(typeof DG_LC_LAST!=="undefined")?DG_LC_LAST:null;
    const profile=await window.DG_LC_S2.profile(
      cells,
      (typeof PARK_POLY!=="undefined"?PARK_POLY:null),
      {year:(last&&last.report&&last.report.year)||2021,mode}
    );
    window.DG_LC_S2.predictAll(profile);
    /* Uzlaşma: validate çekirdeği hesaplar */
    const agreement=window.DG_LC_VALIDATE.agreement(cells,profile.cells);
    if(!DG_VALW.campaign)dgValwNewCampaign();
    DG_VALW.campaign.spectral={
      cells:profile.cells,
      stats:profile.stats,
      scenes:profile.scenes,
      waterScenes:profile.waterScenes||[],
      range:profile.range,
      skipped:profile.skipped,
      agreement
    };
    dgValwRecompute();
    toast(_tvwt("✓ Spektral tarama bitti: {n} hücre profillendi · uzlaşma %{p}",{n:profile.stats.nProfiled,p:agreement.overallPct===null?"—":agreement.overallPct}),"ok","🛰️");
  }catch(err){
    toast(_tvw("Spektral tarama başarısız: ")+String((err&&err.message)||err).slice(0,140),"err","🛰️");
  }finally{
    DG_VALW.busy=false;
    dgValwRender();
    const b2=document.getElementById("valwScanBtn");
    if(b2&&b2.dataset.oldText){b2.innerHTML=b2.dataset.oldText;b2.disabled=false;b2.style.opacity="";b2.style.cursor="";}
  }
}

function dgValwToggleFlags(on){
  if(typeof map==="undefined"||!map||!window.L)return;
  if(DG_VALW.flagLayer){map.removeLayer(DG_VALW.flagLayer);DG_VALW.flagLayer=null;}
  if(!on)return;
  const spec=DG_VALW.campaign&&DG_VALW.campaign.spectral;
  if(!spec||!spec.agreement||!spec.agreement.flagged.length)return;
  DG_VALW.flagLayer=L.layerGroup().addTo(map);
  for(const f of spec.agreement.flagged.slice(0,2000)){
    if(!f.quadWgs||f.quadWgs.length!==4)continue;
    L.polygon(f.quadWgs.map(p=>[p[1],p[0]]),{
      color:"#dc2626",weight:2,dashArray:"4,4",fill:false,interactive:false
    }).addTo(DG_VALW.flagLayer);
  }
}

function dgValwSetOpacity(v){
  const a=Math.max(0,Math.min(1,Number(v)/100))*0.6;
  if(typeof DG_LC_LAYER!=="undefined"&&DG_LC_LAYER&&DG_LC_LAYER.eachLayer){
    DG_LC_LAYER.eachLayer(l=>{try{l.setStyle({fillOpacity:a,opacity:Math.min(0.9,a+0.25)});}catch(e){}});
  }
}

/* ═════════════ ADIM B · ÖRNEKLEM + ETİKETLEME TURU ═════════════ */

function dgValwPaneB(){
  const c=DG_VALW.campaign;
  const nSmp=c?(c.samples||[]).length:0;
  const nLab=c?Object.keys(c.labels||{}).length:0;
  let out=`<div class="dg-png-sub" style="margin-bottom:8px">`+
    esc(_tvw("Olofsson vd. (2014) tabakalı rastgele örnekleme: her harita sınıfından eşit sayıda nokta, tohumlu PRNG ile seçilir (tekrar üretilebilir). Etiketleme, ~0.5 m Esri World Imagery üzerinde yapılır — referans İNSAN yorumudur."))+
  `</div>`;
  if(!nSmp){
    out+=
      `<div class="dg-png-fields">`+
        `<div class="dg-png-field"><label class="dg-png-label" for="valwPerStratum">${esc(_tvw("SINIF BAŞINA NOKTA"))}</label>`+
          `<select id="valwPerStratum" class="dg-png-select">`+
            `<option value="5">5 · hızlı (~20 nokta)</option>`+
            `<option value="8">8 · dengeli (~32 nokta)</option>`+
            `<option value="10" selected>10 · standart (~40 nokta)</option>`+
            `<option value="15">15 · ayrıntılı (~60 nokta)</option>`+
            `<option value="20">20 · yoğun (~80 nokta)</option>`+
          `</select></div>`+
        `<div class="dg-png-field"><label class="dg-png-label" for="valwSeed">${esc(_tvw("TOHUM"))}</label>`+
          `<input id="valwSeed" class="dg-png-input" type="number" value="${(c&&c.seed)||window.DG_LC_VALIDATE.defaults.seed}"></div>`+
      `</div>`+
      `<button class="dg-png-btn primary" onclick="dgValwMakeSample()">🎯 ${esc(_tvw("Örnek Noktaları Üret"))}</button>`;
  }else{
    const done=Math.round(100*nLab/Math.max(1,nSmp));
    out+=
      `<div class="dg-valw-bar-row"><span class="dg-valw-bar-label">${esc(_tvw("Etiketleme"))}</span>`+
        `<span class="dg-valw-bar"><i style="width:${done}%;background:#22c55e"></i></span>`+
        `<span class="dg-valw-bar-val">${nLab}/${nSmp}</span></div>`+
      `<div style="margin-top:4px">`+
        `<span class="dg-valw-chip">🌱 ${esc(_tvw("tohum"))}: ${(c&&c.seed)||"—"}</span>`+
        (c&&c.spectral?`<span class="dg-valw-chip">🛰 ${esc(_tvw("spektral ipucu hazır"))}</span>`:`<span class="dg-valw-chip">🛰 ${esc(_tvw("spektral tarama yok — ipuçsuz"))}</span>`)+
      `</div>`+
      `<div class="dg-png-options" style="margin-top:8px">`+
        `<button class="dg-png-btn primary" onclick="dgValwStartTour()">📡 ${esc(_tvw("Etiketleme Turunu Başlat"))}</button>`+
        `<button class="dg-png-btn ghost" onclick="dgValwShowMarkers()">📍 ${esc(_tvw("Noktaları Haritada Göster"))}</button>`+
        `<button class="dg-png-btn red sm" onclick="dgValwResetSample()">🗑 ${esc(_tvw("Örneklemi Sıfırla"))}</button>`+
      `</div>`;
  }
  return out;
}

function dgValwNewCampaign(){
  const pk=dgValwParkId();
  const seedIn=document.getElementById("valwSeed");
  const seed=Number(seedIn&&seedIn.value)||window.DG_LC_VALIDATE.defaults.seed;
  DG_VALW.campaign={
    id:"val-"+(pk.id||"x")+"-"+Date.now(),
    parkId:pk.id,parkName:pk.name,
    seed,
    samples:[],labels:{},
    spectral:null,metrics:null,agreement:null,gate:null,
    createdAt:new Date().toISOString(),
    engineVersion:(typeof DG_LC_ENGINE_VERSION!=="undefined")?DG_LC_ENGINE_VERSION:"?"
  };
}

function dgValwMakeSample(){
  const cells=dgValwCells();
  if(!cells||!cells.length){toast(_tvw("Hücre listesi boş — önce arazi örtüsü analizi."),"err","🎯");return;}
  if(!DG_VALW.campaign)dgValwNewCampaign();
  const perSel=document.getElementById("valwPerStratum");
  const seedIn=document.getElementById("valwSeed");
  const c=DG_VALW.campaign;
  if(seedIn&&Number(seedIn.value))c.seed=Number(seedIn.value);
  if(Object.keys(c.labels||{}).length&&!confirm(_tvw("Mevcut etiketler yeni örneklemle silinecek. Devam edilsin mi?")))return;
  c.samples=window.DG_LC_VALIDATE.stratifiedSample(cells,{
    perStratum:Number(perSel&&perSel.value)||10,
    seed:c.seed
  });
  c.labels={};
  c.metrics=null;c.gate=null;
  dgValwRecompute();
  dgValwRender();
  dgValwShowMarkers();
  toast(_tvwt("✓ {n} örnek nokta üretildi (tohum {s}) — tur başlatılabilir.",{n:c.samples.length,s:c.seed}),"ok","🎯");
}

function dgValwResetSample(){
  const c=DG_VALW.campaign;
  if(!c)return;
  if(!confirm(_tvw("Örneklem ve tüm etiketler silinsin mi?")))return;
  c.samples=[];c.labels={};c.metrics=null;c.gate=null;
  dgValwClearMarkers();
  dgValwRecompute();
  dgValwRender();
}

function dgValwShowMarkers(){
  if(typeof map==="undefined"||!map||!window.L)return;
  dgValwClearMarkers();
  const c=DG_VALW.campaign;
  if(!c||!c.samples||!c.samples.length)return;
  const colors={green:"#16a34a",water:"#2563eb",hard:"#475569",bare:"#8b5a2b"};
  const bounds=[];
  c.samples.forEach((s,i)=>{
    const labeled=c.labels[s.id];
    const icon=L.divIcon({
      className:"",
      html:`<div class="dg-valw-marker${labeled?" done":""}" style="background:${colors[s.mapClass]||"#64748b"}">${i+1}</div>`,
      iconSize:[34,34],iconAnchor:[17,17]
    });
    const m=L.marker([s.lat,s.lon],{icon,title:s.id+" · "+((window.DG_LC_VALIDATE.labels[s.mapClass]||{}).tr||s.mapClass)});
    m.on("click",()=>dgValwOpenSheet(i));
    m.addTo(map);
    DG_VALW.markers.push({sample:s,marker:m,idx:i});
    bounds.push([s.lat,s.lon]);
  });
  if(bounds.length>1){try{map.fitBounds(L.latLngBounds(bounds),{padding:[46,46]});}catch(e){}}
}

function dgValwClearMarkers(){
  for(const m of DG_VALW.markers){try{map.removeLayer(m.marker);}catch(e){}}
  DG_VALW.markers=[];
}

function dgValwStartTour(){
  const c=DG_VALW.campaign;
  if(!c||!c.samples||!c.samples.length){toast(_tvw("Önce örnek noktaları üretin."),"warn","🎯");return;}
  if(typeof map==="undefined"||!map)return;
  /* Altlık: uydu (referans görsel kanıt). Tur bitince eski altlığa dönülür. */
  DG_VALW.baseBeforeTour="osm";
  if(typeof switchBaseLayer==="function")switchBaseLayer("sat");
  dgValwShowMarkers();
  /* İlk etiketlenmemiş noktadan başla */
  let start=c.samples.findIndex(s=>!c.labels[s.id]);
  if(start<0)start=0;
  dgValwOpenSheet(start);
  toast(_tvw("📡 Etiketleme turu: her noktada görüntüyü incele, gerçekte NE GÖRÜYORSAN onu işaretle. Harita sınıfını değil!"),"info","🛰️");
}

function dgValwEndTour(silent){
  DG_VALW.tourIdx=-1;
  const sheet=document.getElementById("valwSheet");
  if(sheet)sheet.remove();
  if(!silent&&DG_VALW.baseBeforeTour&&typeof switchBaseLayer==="function"){
    switchBaseLayer(DG_VALW.baseBeforeTour);
    DG_VALW.baseBeforeTour=null;
  }
  DG_VALW.baseBeforeTour=null;
  for(const m of DG_VALW.markers){
    try{m.marker.getElement&&m.marker.getElement()&&m.marker.getElement().classList.remove("current");}catch(e){}
  }
  if(DG_VALW.open)dgValwRender();
}

function dgValwOpenSheet(i){
  const c=DG_VALW.campaign;
  if(!c||!c.samples[i])return;
  DG_VALW.tourIdx=i;
  const s=c.samples[i];
  if(typeof map!=="undefined"&&map){
    try{map.flyTo([s.lat,s.lon],Math.max(map.getZoom(),19),{duration:0.8});}catch(e){map.setView([s.lat,s.lon],19);}
  }
  for(const m of DG_VALW.markers){
    const el=m.marker.getElement&&m.marker.getElement();
    if(el){el.classList.toggle("current",m.idx===i);}
  }
  dgValwRenderSheet();
}

function dgValwRenderSheet(){
  const c=DG_VALW.campaign;
  const i=DG_VALW.tourIdx;
  if(i<0||!c||!c.samples[i]){return;}
  const s=c.samples[i];
  let sheet=document.getElementById("valwSheet");
  if(!sheet){
    sheet=document.createElement("div");
    sheet.id="valwSheet";
    sheet.className="dg-valw-sheet";
    sheet.setAttribute("role","dialog");
    sheet.setAttribute("aria-label",_tvw("Örnek nokta etiketleme"));
    document.body.appendChild(sheet);
  }
  const spec=c.spectral&&c.spectral.cells?c.spectral.cells[s.row+":"+s.col]:null;
  const cur=c.labels[s.id];
  const nLab=Object.keys(c.labels||{}).length;
  const V=window.DG_LC_VALIDATE;
  const hint=spec&&spec.ndvi!==undefined
    ?`<span class="dg-valw-chip">NDVI ${(+spec.ndvi).toFixed(2)}</span>`+
     `<span class="dg-valw-chip">MNDWI ${(+spec.mndwi).toFixed(2)}</span>`+
     `<span class="dg-valw-chip">NDBI ${(+spec.ndbi).toFixed(2)}</span>`+
     `<span class="dg-valw-chip">🛰 ${V.spectralPredict(spec)==="nodata"?_tvw("yetersiz gözlem"):((V.labels[V.spectralPredict(spec)]||{}).emoji||"")+" "+_tvw("öneri")}</span>`
    :`<span class="dg-valw-chip">🛰 ${esc(_tvw("bu hücrede spektral veri yok"))}</span>`;
  sheet.innerHTML=
    `<div class="dg-valw-sheet-head">`+
      `<div>`+
        `<div class="dg-valw-sheet-title">🎯 ${esc(_tvw("Nokta"))} ${i+1}/${c.samples.length} · ${esc(s.id)}</div>`+
        `<div class="dg-valw-sheet-sub">`+
          `${esc(_tvw("Harita diyor ki"))}: <b>${(V.labels[s.mapClass]||{}).emoji||""} ${esc((V.labels[s.mapClass]||{}).tr||s.mapClass)}</b>`+
          `${cur?" · "+esc(_tvw("Senin etiketin"))+": <b>"+((V.labels[cur]||{}).emoji||"")+" "+esc((V.labels[cur]||{}).tr||cur)+"</b>":""}`+
          ` · ${nLab}/${c.samples.length} ${esc(_tvw("etiketli"))}`+
        `</div>`+
        `<div style="margin-top:4px">${hint}</div>`+
      `</div>`+
      `<button type="button" class="dg-png-btn ghost sm" onclick="dgValwEndTour(false)" aria-label="${esc(_tvw("Turu kapat"))}">✕</button>`+
    `</div>`+
    `<div class="dg-valw-classgrid">`+
      `<button type="button" class="dg-valw-classbtn water" onclick="dgValwLabel('water')"><span class="big">💧</span>${esc(_tvw("Su"))}</button>`+
      `<button type="button" class="dg-valw-classbtn green" onclick="dgValwLabel('green')"><span class="big">🌿</span>${esc(_tvw("Yeşil"))}</button>`+
      `<button type="button" class="dg-valw-classbtn hard" onclick="dgValwLabel('hard')"><span class="big">🧱</span>${esc(_tvw("Sert zemin"))}</button>`+
      `<button type="button" class="dg-valw-classbtn bare" onclick="dgValwLabel('bare')"><span class="big">🟫</span>${esc(_tvw("Çıplak"))}</button>`+
      `<button type="button" class="dg-valw-classbtn amb" onclick="dgValwLabel('ambiguous')"><span class="big">❓</span>${esc(_tvw("Kararsız"))}</button>`+
      `<button type="button" class="dg-valw-classbtn" onclick="dgValwStep(-1)"><span class="big">↩️</span>${esc(_tvw("Geri"))}</button>`+
    `</div>`+
    `<div class="dg-valw-sheet-actions">`+
      `<button type="button" class="dg-png-btn ghost" onclick="dgValwStep(-1)">⬅ ${esc(_tvw("Önceki"))}</button>`+
      `<button type="button" class="dg-png-btn ghost" onclick="dgValwStep(1)">${esc(_tvw("Sonraki"))} ➡</button>`+
      `<button type="button" class="dg-png-btn primary" onclick="dgValwFinishTour()">✅ ${esc(_tvw("Turu Bitir"))}</button>`+
    `</div>`+
    `<div class="dg-png-sub" style="margin-top:8px;font-size:.66rem">`+
      esc(_tvw("Altın kural: HARİTANIN dediğini değil, GÖRÜNTÜDE gördüğünü işaretle. Gölgeli/karışık piksellerde ❓ Kararsız kullan — karne bunu dürüstçe sayar."))+
    `</div>`;
}

function dgValwLabel(refClass){
  const c=DG_VALW.campaign;
  const i=DG_VALW.tourIdx;
  if(!c||i<0||!c.samples[i])return;
  const s=c.samples[i];
  if(!c.labels)c.labels={};
  c.labels[s.id]=refClass;
  /* işaretleyiciyi 'done' yap */
  const mm=DG_VALW.markers.find(m=>m.idx===i);
  if(mm&&mm.marker.getElement)mm.marker.getElement().classList.add("done");
  /* sonraki etiketlenmemişe geç */
  let next=-1;
  for(let k=1;k<=c.samples.length;k++){
    const j=(i+k)%c.samples.length;
    if(!c.labels[c.samples[j].id]){next=j;break;}
  }
  if(next>=0){dgValwOpenSheet(next);}
  else{
    dgValwRecompute();
    dgValwRenderSheet();
    toast(_tvw("🎉 Tüm noktalar etiketlendi — Karne hazır."),"ok","📊");
  }
  dgValwAutosave();
}

function dgValwStep(d){
  const c=DG_VALW.campaign;
  if(!c||!c.samples.length)return;
  let i=DG_VALW.tourIdx;
  if(i<0)i=0;
  i=(i+d+c.samples.length)%c.samples.length;
  dgValwOpenSheet(i);
}

function dgValwFinishTour(){
  dgValwRecompute();
  dgValwEndTour(false);
  DG_VALW.tab="C";
  dgValwRender();
}

/* ═════════════ ADIM C · KARNE ═════════════ */

function dgValwRecompute(){
  const c=DG_VALW.campaign;
  if(!c)return;
  const V=window.DG_LC_VALIDATE;
  const samples=(c.samples||[]).map(s=>({mapClass:s.mapClass,refClass:c.labels[s.id]||null,row:s.row,col:s.col})).filter(s=>s.refClass);
  const conf=V.confusion(samples);
  /* Ağırlıklar: TAM SAYIM raster alanları (DG_LC_LAST.result.groupAreas) */
  const last=(typeof DG_LC_LAST!=="undefined")?DG_LC_LAST:null;
  const ga=last&&last.result?last.result.groupAreas:{};
  const assigned=last&&last.result?last.result.assignedAreaM2:0;
  const W=V.weights(ga,assigned);
  c.metrics=conf.nTotal+conf.nAmbiguous>0?V.metrics(conf,W,assigned):null;
  c.confusion=conf;
  const nLab=Object.keys(c.labels||{}).length;
  c.agreement=c.spectral?c.spectral.agreement:null;
  c.gate=(c.metrics||c.agreement)?V.gateOf(c.metrics,c.agreement,nLab):null;
}

function dgValwPaneC(){
  const c=DG_VALW.campaign;
  if(!c||!c.metrics){
    return `<div class="dg-png-sub">${esc(_tvw("Karne için B adımında en az birkaç nokta etiketlenmiş olmalı."))}</div>`;
  }
  const V=window.DG_LC_VALIDATE;
  const m=c.metrics;
  const cls=V.classes;
  let out="";
  /* Hüküm */
  if(c.gate){
    const cls2=c.gate.state==="GECERLI"?"ok":c.gate.state==="KRITIK"?"crit":"review";
    out+=`<div class="dg-valw-verdict ${cls2}">${esc(c.gate.label)}`+
      (c.gate.reasons&&c.gate.reasons.length?`<div class="dg-valw-reasons">${c.gate.reasons.map(r=>"· "+esc(r)).join("<br>")}</div>`:"")+
    `</div>`;
  }
  /* Özet çipler */
  out+=`<div style="margin:6px 0">`+
    `<span class="dg-valw-chip">OA <b>%${(m.oa*100).toFixed(1)}</b> ±${(m.oaCi95*100).toFixed(1)}</span>`+
    `<span class="dg-valw-chip">κ <b>${m.kappa===null?"—":m.kappa.toFixed(2)}</b></span>`+
    `<span class="dg-valw-chip">n <b>${m.n}</b>${m.nAmbiguous?" ("+m.nAmbiguous+" ❓)":""}</span>`+
    (c.agreement&&c.agreement.overallPct!==null?`<span class="dg-valw-chip">🛰 ${esc(_tvw("uzlaşma"))} <b>%${c.agreement.overallPct}</b></span>`:"")+
  `</div>`;
  /* Hata matrisi */
  out+=`<div class="dg-png-kicker">${esc(_tvw("HATA MATRİSİ (satır: harita · sütun: referans)"))}</div>`+
    `<table class="dg-valw-matrix"><thead><tr><th>${esc(_tvw("harita↓ / ref→"))}</th>`+
    cls.map(j=>`<th>${(V.labels[j]||{}).emoji||""}</th>`).join("")+
    `<th>❓</th><th>nᵢ</th></tr></thead><tbody>`+
    cls.map(i=>{
      const row=c.confusion.n[i];
      const ni=c.confusion.nRow[i]||0;
      return `<tr><th>${(V.labels[i]||{}).emoji||""} ${esc((V.labels[i]||{}).tr||i)}</th>`+
        cls.map(j=>`<td class="${i===j?"diag":(row[j]?"off":"")}">${row[j]||"·"}</td>`).join("")+
        `<td class="off">${row.ambiguous||"·"}</td><th>${ni}</th></tr>`;
    }).join("")+
    `</tbody></table>`;
  /* Sınıf metrikleri */
  out+=`<div class="dg-png-kicker">${esc(_tvw("SINIF KARNESİ (Olofsson 2014)"))}</div>`+
    `<table class="dg-valw-matrix"><thead><tr><th>${esc(_tvw("Sınıf"))}</th><th>UA ±CI95</th><th>PA</th><th>${esc(_tvw("Düzeltilmiş alan (ha)"))}</th><th>Wᵢ</th></tr></thead><tbody>`+
    cls.map(k=>{
      const pc=m.perClass[k]||{};
      return `<tr><th>${(V.labels[k]||{}).emoji||""} ${esc((V.labels[k]||{}).tr||k)}</th>`+
        `<td>${pc.ua===null||pc.ua===undefined?"—":"%"+(pc.ua*100).toFixed(1)+(pc.uaCi95!==null&&pc.uaCi95!==undefined?" ±"+(pc.uaCi95*100).toFixed(1):"")}</td>`+
        `<td>${pc.pa===null||pc.pa===undefined?"—":"%"+(pc.pa*100).toFixed(1)}</td>`+
        `<td>${pc.adjustedAreaHa===undefined?"—":Number(pc.adjustedAreaHa).toFixed(2)+(pc.adjustedCi95Ha?" ±"+Number(pc.adjustedCi95Ha).toFixed(2):"")}</td>`+
        `<td class="off">${pc.weight!==undefined?(pc.weight*100).toFixed(1)+"%":"—"}</td></tr>`;
    }).join("")+
    `</tbody></table>`+
    `<div class="dg-png-sub" style="font-size:.66rem">${esc(_tvw("UA: kullanıcı doğruluğu (haritanın bu sınıf dediği yerlerin gerçekte doğruluk oranı) · PA: üretici doğruluğu (gerçekte bu sınıf olanların haritada yakalanma oranı) · Düzeltilmiş alan: tabaka ağırlıklı Olofsson tahmini ± %95 CI. Kararsız (❓) etiketler doğruluk payına dahil edilmez (muhafazakâr)."))}</div>`;
  /* Aksiyonlar */
  out+=`<div class="dg-png-options" style="margin-top:10px">`+
    `<button class="dg-png-btn primary" onclick="dgValwSave()">💾 ${esc(_tvw("Kampanyayı Kaydet"))}</button>`+
    `<button class="dg-png-btn ghost" onclick="dgValwExportCsv()">📥 CSV</button>`+
    `<button class="dg-png-btn ghost" onclick="dgValwExportJson()">📥 JSON</button>`+
    `<button class="dg-png-btn red sm" onclick="dgValwDelete()">🗑 ${esc(_tvw("Kampanyayı Sil"))}</button>`+
  `</div>`;
  /* Kayıtlı kampanyalar */
  out+=`<div id="valwSaved" class="dg-png-sub" style="font-size:.68rem"></div>`;
  setTimeout(()=>dgValwListSaved(),0);
  return out;
}

async function dgValwSave(){
  const c=DG_VALW.campaign;
  if(!c){toast(_tvw("Kaydedilecek kampanya yok."),"warn","💾");return;}
  dgValwRecompute();
  try{
    await window.DG_LC_VALIDATE.saveCampaign(JSON.parse(JSON.stringify(c)));
    toast(_tvw("✓ Kampanya cihaza kaydedildi (IndexedDB)."),"ok","💾");
  }catch(e){
    toast(_tvw("Kayıt başarısız: ")+String((e&&e.message)||e).slice(0,100),"err","💾");
  }
}

async function dgValwListSaved(){
  const box=document.getElementById("valwSaved");
  if(!box)return;
  try{
    const pk=dgValwParkId();
    const list=pk.id?await window.DG_LC_VALIDATE.loadCampaigns(pk.id):[];
    if(!list.length){box.textContent="";return;}
    list.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
    box.innerHTML="<b>"+esc(_tvw("Bu parkın kayıtlı kampanyaları"))+":</b><br>"+list.slice(0,5).map(cm=>
      "📁 "+esc(cm.id.slice(0,28))+" · "+String(cm.createdAt||"").slice(0,10)+
      " · "+Object.keys(cm.labels||{}).length+" "+_tvw("etiket")+
      (cm.gate?" · "+esc(cm.gate.label):"")+
      ` <button type="button" class="dg-png-btn ghost sm" onclick="dgValwLoadCampaign('${esc(cm.id)}')">Yükle</button>`
    ).join("<br>");
  }catch(e){box.textContent="";}
}

async function dgValwLoadCampaign(id){
  try{
    const pk=dgValwParkId();
    const list=pk.id?await window.DG_LC_VALIDATE.loadCampaigns(pk.id):[];
    const cm=list.find(x=>x.id===id);
    if(!cm){toast(_tvw("Kampanya bulunamadı."),"err","📁");return;}
    DG_VALW.campaign=cm;
    dgValwRecompute();
    dgValwRender();
    toast(_tvw("✓ Kampanya yüklendi."),"ok","📁");
  }catch(e){toast(_tvw("Yükleme başarısız."),"err","📁");}
}

function dgValwDelete(){
  const c=DG_VALW.campaign;
  if(!c)return;
  if(!confirm(_tvw("Kampanya cihazdan silinsin mi? (Dışa aktarılmadıysa veri kaybolur)")))return;
  window.DG_LC_VALIDATE.deleteCampaign(c.id).catch(()=>{});
  DG_VALW.campaign=null;
  dgValwClearMarkers();
  dgValwRender();
}

function dgValwExportCsv(){
  const c=DG_VALW.campaign;
  if(!c){toast(_tvw("Önce kampanya oluştur."),"warn","📥");return;}
  dgValwRecompute();
  /* samples + labels birleştirilmiş kopya (csv serileştirici refClass bekler) */
  const cc=Object.assign({},c,{samples:(c.samples||[]).map(s=>Object.assign({},s,{refClass:c.labels[s.id]||""}))});
  if(typeof downloadBlob==="function"){
    downloadBlob("dendrogeo_val_"+(c.parkId||"park")+".csv","text/csv;charset=utf-8",window.DG_LC_VALIDATE.csv(cc));
    toast(_tvw("✓ Doğrulama CSV'si indirildi."),"ok","📥");
  }
}

function dgValwExportJson(){
  const c=DG_VALW.campaign;
  if(!c){toast(_tvw("Önce kampanya oluştur."),"warn","📥");return;}
  dgValwRecompute();
  const cc=Object.assign({},c,{samples:(c.samples||[]).map(s=>Object.assign({},s,{refClass:c.labels[s.id]||""}))});
  if(typeof downloadBlob==="function"){
    downloadBlob("dendrogeo_val_"+(c.parkId||"park")+".json","application/json;charset=utf-8",window.DG_LC_VALIDATE.json(cc));
    toast(_tvw("✓ Doğrulama JSON'u indirildi (parmak izli)."),"ok","📥");
  }
}

/* Otomatik kaydetme: etiketleme sırasında 5 etikette bir (sahada bağlantı
 * kopması/sekme kapanmasına karşı). Sessiz — hata durumunda toast yok. */
let DG_VALW_AUTON=0;
function dgValwAutosave(){
  DG_VALW_AUTON++;
  if(DG_VALW_AUTON%5===0&&DG_VALW.campaign){
    dgValwRecompute();
    window.DG_LC_VALIDATE.saveCampaign(JSON.parse(JSON.stringify(DG_VALW.campaign))).catch(()=>{});
  }
}

/* Temizlik: park değişince/kapanınca tur ve katmanlar kalksın */
function dgValwCleanup(){
  dgValwEndTour(true);
  if(DG_VALW.flagLayer&&typeof map!=="undefined"&&map){try{map.removeLayer(DG_VALW.flagLayer);}catch(e){}}
  DG_VALW.flagLayer=null;
  dgValwClearMarkers();
  DG_VALW.campaign=null;
  DG_VALW.open=false;
}

window.DG_LC_WORKBENCH={
  open:dgValwOpen,
  close:dgValwClose,
  cleanup:dgValwCleanup,
  state:DG_VALW
};
