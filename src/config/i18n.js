"use strict";
/* ===== DendroGeo · src/config/i18n.js — TR/EN ÇALIŞMA-ZAMANI DİL KATMANI (0035) =====
 * Kullanıcı isteği: "EN'e basıldığında site komple İngilizce olmalı, app de aynı
 * şekilde; basıldıktan sonra EN yerine TR gelmeli."
 *
 * MİMARİ — sözlük tabanlı, markup'a dokunmayan çevirmen:
 *   · Markup'taki varsayılan dil HER ZAMAN Türkçe (SEO, JSON-LD ve 940+ test
 *     Türkçe metinleri kilitliyor; data-i18n kalabalığı yerine tam-eşleşme
 *     sözlüğü seçildi → partials değişmeden çeviri çalışır).
 *   · dgApplyI18n(): kök altındaki metin düğümlerini + placeholder/title/
 *     aria-label özniteliklerini gezerek TAM EŞLEŞEN dizeleri çevirir.
 *     Eşleşmeyen diziğe DOKUNULMAZ (formüller, veriler, tür adları, sayılar).
 *   · TR'ye dönüş: DG_I18N_EN tersine çevrilir (EN→TR haritası otomatik).
 *   · MutationObserver: dil EN iken sonradan render edilen düğümler (tablo
 *     satırları, panel kartları, toast'lar) da sözlükte varsa çevrilir.
 *   · Kalıcılık: localStorage 'dg_lang'; <html lang> güncellenir.
 *   .notranslate / translate="no" / script / style / svg / textarea ATLANIR
 *   (Leaflet panoları ve harita DOM'u korunur — 2026-09-26 dersi).
 *
 * KAPSAM SINIRI (bilinçli): KVKK açık rıza metni hukuki metindir, TR kalır.
 * Tür adları (İBRELİ/YAPRAKLI/…) veritabanı anahtarıdır, çevrilmez.
 * Değişken gömülü dinamik dizeler (toast'lardaki sayılı mesajlar) v1'de TR;
 * sözlüğe tam dize eklemek yeterli — altyapı hazır. */

/* English translation entries are loaded from i18n-en.js first. */

const DG_I18N_TR={};
for(const k in DG_I18N_EN){ if(!(DG_I18N_EN[k] in DG_I18N_TR)) DG_I18N_TR[DG_I18N_EN[k]]=k; }

let DG_LANG="tr";
try{ if(localStorage.getItem("dg_lang")==="en") DG_LANG="en"; }catch(e){}

const DG_I18N_SKIP="script,style,svg,textarea,.notranslate,[translate=\"no\"]";

function dgT(s){ const t=String(s==null?"":s).trim(); if(!t)return s;
 return DG_LANG==="en"?(DG_I18N_EN[t]??s):(DG_I18N_TR[t]??s); }

/* ŞABLON ÇEVİRİ (0035c): sayı/değişken gömülü dinamik dizeler tam eşleşmez.
 * dgTf("✓ {n} onaylı kayıt yüklendi", {n:44}) → TR'de aynı, EN'de sözlükteki
 * EN şablonuna aynı {var} yer tutucularıyla çevrilir. Çağıran taraf şablonu
 * BİREBİR yazmalı (sözlük anahtarı = TR şablonun kendisi). */
function dgTf(tpl,vars){
 let out=dgT(tpl);
 out=String(out);
 for(const k in vars) out=out.split("{"+k+"}").join(String(vars[k]));
 return out;
}

/* Bir alt ağacı çevir: metin düğümleri + placeholder/title/aria-label. */
function dgApplyI18n(root){
 root=root||document.body; if(!root||typeof document.createTreeWalker!=="function")return;
 if(root.closest&&root.closest(DG_I18N_SKIP))return;
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
 let n=w.currentNode=root;
 const nodes=[];
 if(root.nodeType===3||root.nodeType===1)nodes.push(root);
 while((n=w.nextNode()))nodes.push(n);
 for(const nd of nodes){
  if(nd.nodeType===3){
   if(nd.parentElement&&nd.parentElement.closest(DG_I18N_SKIP))continue;
   const raw=nd.nodeValue, t=raw.trim();
   if(!t)continue;
   const dict=DG_LANG==="en"?DG_I18N_EN:DG_I18N_TR;
   const hit=dict[t];
   if(hit&&hit!==t){
    const lead=raw.slice(0,raw.indexOf(t)), tail=raw.slice(raw.indexOf(t)+t.length);
    nd.nodeValue=lead+hit+tail;
   }
  }else if(nd.nodeType===1){
   if(nd.closest&&nd.closest(DG_I18N_SKIP)&&nd!==root)continue;
   // Retain the original template across language switches and count changes.
   for(const target of ["text","aria-label"]){
    const template=nd.getAttribute("data-i18n-"+target);
    if(!template)continue;
    let values={};try{values=JSON.parse(nd.getAttribute("data-i18n-values")||"{}");}catch(e){}
    const value=dgTf(template,values);
    if(target==="text"){if(nd.textContent!==value)nd.textContent=value;}
    else if(nd.getAttribute(target)!==value)nd.setAttribute(target,value);
   }
   for(const at of ["placeholder","title","aria-label","data-label","alt"]){
    const v=nd.getAttribute&&nd.getAttribute(at);
    if(v){const tv=dgT(v); if(tv!==v)nd.setAttribute(at,tv);}
   }
  }
 }
}

function dgUpdateLangToggles(){
 document.querySelectorAll(".dg-lang-toggle").forEach(b=>{
  b.textContent=DG_LANG==="en"?"TR":"EN";
  b.setAttribute("aria-label",DG_LANG==="en"?"TR · Türkçe'ye geç":"EN · Switch to English");
 });
}

function dgSetLang(lang,skipSave){
 DG_LANG=(lang==="en")?"en":"tr";
 try{ if(!skipSave)localStorage.setItem("dg_lang",DG_LANG); }catch(e){}
 document.documentElement.lang=DG_LANG;
 dgApplyI18n(document.body);
 dgUpdateLangToggles();
 const tk=Object.keys(DG_I18N_EN).length; /* sözlük yüklü ✓ */
 const dt=DG_LANG==="en"?(DG_I18N_EN[document.title.trim()]||document.title):(DG_I18N_TR[document.title.trim()]||document.title);
 if(dt&&dt!==document.title)document.title=dt;
 try{ window.dispatchEvent(new CustomEvent("dg:lang",{detail:{lang:DG_LANG,keys:tk}})); }catch(e){}
}
function dgToggleLang(){ dgSetLang(DG_LANG==="en"?"tr":"en"); }

/* Dinamik içerik: lang!=tr iken eklenen düğümleri de çevir; TR'de geri al. */
if(typeof window!=="undefined"&&"MutationObserver" in window){
 const mo=new MutationObserver(muts=>{
  for(const m of muts){
   if(m.type==="characterData"){dgApplyI18n(m.target);continue;}
   if(m.type==="attributes"){dgApplyI18n(m.target);continue;}
   for(const nd of m.addedNodes){
    if(nd.nodeType===1){ if(nd.closest&&nd.closest(DG_I18N_SKIP))continue; dgApplyI18n(nd); }
    else if(nd.nodeType===3){
     if(nd.parentElement&&nd.parentElement.closest(DG_I18N_SKIP))continue;
     const raw=nd.nodeValue,t=raw.trim(); if(!t)continue;
     const dict=DG_LANG==="en"?DG_I18N_EN:DG_I18N_TR; const hit=dict[t];
     if(hit&&hit!==t){const i=raw.indexOf(t);nd.nodeValue=raw.slice(0,i)+hit+raw.slice(i+t.length);}
    }
   }
  }
 });
 const startMo=()=>{ if(document.body)mo.observe(document.body,{childList:true,characterData:true,attributes:true,attributeFilter:["placeholder","title","aria-label","data-label","alt","data-i18n-values"],subtree:true}); };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",startMo);else startMo();
}

/* Açılış: kayıtlı dil EN ise uygula (markup TR gelir). */
(function dgI18nInit(){
 const run=()=>{ dgUpdateLangToggles(); if(DG_LANG==="en")dgSetLang("en",true); };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run();
})();
