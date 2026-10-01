"use strict";
/* ===== DendroGeo · src/services/species-ai.js — AI AĞAÇ TÜRÜ TANIMA (0041) =====
 * Kullanıcının kendi eğittiği modelin SOKETİ. İki mod öngörüldü:
 *
 *   A) HTTPS UÇ NOKTA (hazır): Yönetim → 🤖 AI Tür Tanıma kartına URL girilir.
 *      İstek: POST multipart/form-data, alan adı "photo" (jpeg blob).
 *      Yanıt (ESNEK ayrıştırma): {species|label|name|prediction: "Karaçam",
 *      confidence|score|prob: 0.87} — 0..1 veya 0..100 kabul edilir.
 *      Gereksinimler: CORS (Access-Control-Allow-Origin: https://dendrogeo.org)
 *      + URL'nin index.html CSP connect-src listesine eklenmesi (tek satır).
 *
 *   B) TARAYICI-İÇİ ONNX/TF.js (gelecek/offline): vendor'a runtime + model
 *      dosyası eklenince dgAiDetect genişletilir — saha internetsiz çalışır.
 *      (lazylibs.js deseni hazır: geotiff/chart.js de böyle tembel yükleniyor.)
 *
 * BİLİMSEL İLKE: öneri ASLA otomatik kaydedilmez; formu ÖN DOLDURUR, kararı
 * sahada insan verir (qa: tür alanı her zaman düzenlenebilir kalır).
 * Ayar localStorage'da (cihaza özel) — veritabanı/şema değişmez. */

const DG_AI_CFG_KEY="dg_ai_cfg";
function dgAiCfg(){try{return JSON.parse(localStorage.getItem(DG_AI_CFG_KEY)||"{}")||{};}catch(e){return{};}}
function dgAiSaveCfg(c){try{localStorage.setItem(DG_AI_CFG_KEY,JSON.stringify(c||{}));}catch(e){}}
function dgAiEnabled(){const c=dgAiCfg();return !!(c.on&&c.url);}
const _tai=(s)=>(typeof dgCf==="function"?dgCf(s):s);

/* AI etiketini tür sözlüğünün KANONİK adına çevir (resolveSpeciesName
 * eşanlamlıları + Türkçe-duyarlı normalizasyonu zaten yapar). */
function dgAiCanonical(label){
 try{
  if(typeof resolveSpeciesName==="function"){
   const c=resolveSpeciesName(String(label||""));
   if(c)return c;
  }
 }catch(e){}
 return null;
}

/* Fotoğraf blob'unu uç noktaya gönder → {label, conf} | null */
async function dgAiDetect(blob){
 if(!dgAiEnabled()||!blob)return null;
 const c=dgAiCfg();
 const fd=new FormData();
 fd.append("photo",blob,"foto.jpg");
 const r=await fetch(c.url,{method:"POST",body:fd});
 if(!r.ok)throw new Error("HTTP "+r.status);
 const j=await r.json();
 const label=String(j&&(j.species||j.label||j.name||j.prediction||"")).trim();
 if(!label)return null;
 let conf=Number(j&&(j.confidence!=null?j.confidence:(j.score!=null?j.score:j.prob)));
 if(Number.isFinite(conf)&&conf>0&&conf<=1)conf=conf*100;
 return {label:label,conf:Number.isFinite(conf)?Math.round(conf):null,raw:j};
}

/* checkPhoto kancası: QA geçen fotoğrafta öneriyi üret (arka planda). */
async function dgAiOnPhoto(file){
 const box=$("aiSuggest");
 if(!dgAiEnabled()){if(box)box.style.display="none";return;}
 if(box){box.style.display="block";box.className="alert info";box.innerHTML="🤖 "+_tai("AI türü tanıyor…");}
 let res=null;
 try{res=await dgAiDetect(file);}
 catch(e){
  if(box){box.className="alert warn";box.innerHTML="⚠ "+_tai("AI önerisi alınamadı")+': <span class="mono" style="font-size:.75rem">'+esc(e&&e.message||e)+"</span>";}
  return;
 }
 if(!res||!box){if(box&&!res){box.style.display="none";}return;}
 const canon=dgAiCanonical(res.label);
 const confTxt=res.conf!=null?" %"+res.conf:"";
 try{window.DG_AI_LAST={label:res.label,canon:canon,conf:res.conf};}catch(e){}
 box.className="alert ok";
 box.innerHTML='🤖 <b>'+_tai("AI önerisi")+":</b> "+esc(canon||res.label)+esc(confTxt)+
  (canon
   ?' <button class="btn sm blue" style="margin-left:8px" onclick="dgAiUse()">'+_tai("Kullan")+'</button>'+
    ' <button class="btn sm ghost" onclick="dgAiDismiss()">'+_tai("Yoksay")+'</button>'
   :' <span style="font-size:.78rem;color:var(--mut)">— '+_tai("listede yok, elle seçin")+'</span>')+
  '<div style="font-size:.7rem;color:var(--mut);margin-top:4px">'+_tai("Öneri formu ön doldurur; kararı sahada insan verir — veritabanına otomatik yazılmaz.")+'</div>';
}

/* "Kullan": grubu+türü seç, Latince adı ve canlı hesabı tazele. */
function dgAiUse(){
 const last=(typeof window!=="undefined"&&window.DG_AI_LAST)||null;
 if(!last||!last.canon)return;
 try{
  let grp=null;
  for(const g in SPECIES_DATA){if((SPECIES_DATA[g]||[]).some(s=>s.tr===last.canon)){grp=g;break;}}
  if(grp&&$("mGroup")){
   $("mGroup").value=grp;
   if(typeof fillSpecies==="function")fillSpecies();
   if($("mSpecies"))$("mSpecies").value=last.canon;
   if(typeof showLatin==="function")showLatin();
   if(typeof liveCalc==="function")liveCalc();
  }
 }catch(e){}
 const box=$("aiSuggest");
 if(box){box.className="alert ok";box.innerHTML="✓ "+_tai("Tür seçildi")+": <b>"+esc(last.canon)+"</b>"+(last.conf!=null?" <span class='dg-meta'>%"+last.conf+"</span>":"");}
}
function dgAiDismiss(){const b=$("aiSuggest");if(b)b.style.display="none";}

/* ── Yönetim kartı (loadAdmin çağırır; yalnız admin/owner görünümünde) ── */
function dgAiAdminRender(){
 const box=$("dgAiAdmin");if(!box)return;
 const c=dgAiCfg();
 box.innerHTML=
  '<label class="dg-consent" for="dgAiOn" style="display:flex;gap:8px;align-items:flex-start;font-size:.84rem"><input type="checkbox" id="dgAiOn" style="width:auto;margin-top:3px" '+(c.on?"checked":"")+' onchange="dgAiAdminSave()"> <span>'+_tai("Etkin — ölçüm formunda fotoğraf çekilince otomatik öneri")+'</span></label>'+
  '<div class="lbl" style="margin-top:12px">'+_tai("Uç nokta (POST · multipart 'photo' · JSON yanıt)")+'</div>'+
  '<input id="dgAiUrl" type="url" placeholder="https://…/predict" value="'+esc(c.url||"")+'" onchange="dgAiAdminSave()" style="margin-top:6px">'+
  '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'+
   '<button class="btn sm blue" onclick="dgAiTest()">'+_tai("🧪 Test isteği gönder")+'</button>'+
  '</div>'+
  '<div id="dgAiTestOut" class="dg-meta" style="margin-top:8px"></div>'+
  '<p style="font-size:.75rem;color:var(--mut);margin-top:10px">'+_tai("Sunucu CORS açmalı (Access-Control-Allow-Origin: https://dendrogeo.org) ve URL, CSP connect-src listesine eklenmeli — adresi iletin, tek satırda eklenir. Model tarayıcıda çalışsın isterseniz ONNX/TF.js modu planlı (çevrimdışı saha).")+'</p>';
}
function dgAiAdminSave(){
 const c=dgAiCfg();
 const on=$("dgAiOn"),u=$("dgAiUrl");
 c.on=!!(on&&on.checked);
 c.url=u?String(u.value||"").trim():"";
 dgAiSaveCfg(c);
}
async function dgAiTest(){
 dgAiAdminSave();
 const out=$("dgAiTestOut");
 const c=dgAiCfg();
 if(!c.url){if(out)out.textContent=_tai("Önce uç nokta URL'si girin.");return;}
 if(out)out.textContent="⏳ "+_tai("test isteği gönderiliyor…");
 try{
  /* 8×8 yeşil test görseli (model gerçek foto bekler; amaç hattı doğrulamak) */
  const cv=document.createElement("canvas");cv.width=8;cv.height=8;
  const x=cv.getContext("2d");x.fillStyle="#2e8b57";x.fillRect(0,0,8,8);
  const blob=await new Promise(r=>cv.toBlob(r,"image/jpeg",0.7));
  const t0=Date.now();
  const res=await dgAiDetect(blob);
  if(out)out.textContent=res
   ?("✓ "+(Date.now()-t0)+" ms · "+res.label+(res.conf!=null?" %"+res.conf:""))
   :("— "+_tai("yanıt boş ya da çözümlenemedi (CSP/CORS/kontrol edin)"));
 }catch(e){
  if(out)out.textContent="⚠ "+String(e&&e.message||e)+" — "+_tai("CSP connect-src ve CORS kontrol edin");
 }
}
