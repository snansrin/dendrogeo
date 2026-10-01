"use strict";
/* ===== DendroGeo · src/services/species-ai.js — 🌳 AI AĞAÇ ALGILAMA (0042) =====
 * KULLANICI KARARI (0042): "ben tür tanıma istemedim, sadece ağacı algılasın."
 * Bu modül, kullanıcının kendi eğittiği AĞAÇ ALGILAMA modelinin soketidir:
 * ölçüm formunda fotoğraf çekilince "fotoğrafta ağaç var mı?" doğrulaması yapar.
 *
 *   A) HTTPS UÇ NOKTA (hazır): Yönetim → 🤖 AI Ağaç Algılama kartına URL.
 *      İstek : POST multipart/form-data · alan adı "photo" (jpeg blob)
 *      Yanıt : ESNEK ayrıştırma — şu biçimlerin hepsi kabul:
 *              {tree:true, confidence:0.93} · {is_tree:1} · {detected:true}
 *              {label:"tree"|"ağaç", score:87} · {detections:[{class:"tree",conf:.9}]}
 *              true/false · {results:[...]}  (0-1 ve 0-100 güven ikisi de olur)
 *      Gereksinimler: CORS (Access-Control-Allow-Origin: https://dendrogeo.org)
 *      + URL'nin index.html CSP connect-src listesine eklenmesi (tek satır).
 *
 *   B) TARAYICI-İÇİ ONNX/TF.js (planlı): model vendor'a eklenince dgAiDetect
 *      genişletilir → çevrimdışı sahada da çalışır (lazylibs deseni hazır).
 *
 * BİLİMSEL İLKE: AI sonucu yalnız DOĞRULAMA bilgisidir; veritabanına hiçbir
 * şey yazmaz (bekçi testi kilitler). "AI kapısı" admin tarafından açılırsa
 * ağaç doğrulanmadan KAYDET düğmesi foto QA'daki gibi bloklanır — karar
 * her durumda insandadır (kapıyı da insan kurar).
 * Ayarlar localStorage'da (cihaza özel) — şema/migration/RLS değişmez. */

const DG_AI_CFG_KEY="dg_ai_cfg";
const _tai=(s)=>(typeof dgCf==="function"?dgCf(s):s);
function dgAiCfg(){try{return JSON.parse(localStorage.getItem(DG_AI_CFG_KEY)||"{}")||{};}catch(e){return{};}}
function dgAiSaveCfg(c){try{localStorage.setItem(DG_AI_CFG_KEY,JSON.stringify(c||{}));}catch(e){}}
function dgAiEnabled(){const c=dgAiCfg();return !!(c.on&&c.url);}

/* ESNEK yanıt ayrıştırıcı → {tree:boolean, conf:number|null} | null (çözülemedi)
 * 0042 sağlamlaştırma: null/boş sayıya dönmez, "no_tree" gibi OLUMSUZ
 * etiketler false sayılır, çözümlenemeyen yanıt null döner (kapıyı etkilemez). */
function dgAiParse(j){
 const num=(v)=>{if(v==null||v==="")return null;const n=Number(v);return Number.isFinite(n)?n:null;};
 const norm=(v)=>{let n=num(v);if(n==null)return null;if(n>0&&n<=1)n*=100;return Math.round(n);};
 const NEG=/^(no|not|non|none|false|yok|degil|değil|background|arka|other|diğer|person|kisi|kişi|human|insan|bina|building|car|araba|sky|gökyüzü|gokyuzu|çim|cim|grass)/i;
 const isTreeWord=(s)=>{const x=String(s==null?"":s).trim();if(!x)return false;if(NEG.test(x))return false;return /tree|a[ğg]a[çc]|forest|orman/i.test(x);};
 if(typeof j==="boolean")return{tree:j,conf:null};
 if(j==null||typeof j!=="object")return null;
 const pick=(ks)=>{for(const k of ks){if(j[k]!=null)return j[k];}return null;};
 let tree=pick(["tree","is_tree","isTree","agac","ağaç","detected","has_tree","hasTree","valid"]);
 let conf=pick(["confidence","score","prob","probability","conf"]);
 if(tree==null){
  const lab=pick(["label","class","name","prediction","category"]);
  if(lab!=null){tree=isTreeWord(lab);if(conf==null)conf=pick(["confidence","score","prob"]);}
 }
 if(tree==null){
  for(const key of ["detections","results","objects","boxes"]){
   if(Array.isArray(j[key])&&j[key].length){
    const d=j[key].find(x=>x&&isTreeWord(x.class||x.label||x.name||x.category));
    tree=!!d;
    if(d&&conf==null)conf=(d.confidence!=null?d.confidence:(d.score!=null?d.score:(d.prob!=null?d.prob:d.conf)));
    break;
   }
  }
 }
 if(tree==null){
  /* sayısal güven tek başına geldiyse: 0-1 → ≥0.5, 0-100 → ≥50 "ağaç var" */
  const n=num(conf!=null?conf:pick(["score","confidence","prob"]));
  if(n!=null){tree=(n<=1?n>=0.5:n>=50);conf=n;}
 }
 if(tree==null)return null;
 if(typeof tree==="string")tree=/^(true|1|yes|evet|var|tree|ağaç)$/i.test(tree.trim());
 if(typeof tree==="number")tree=(tree<=1?tree>=0.5:tree>=50);
 return{tree:!!tree,conf:norm(conf)};
}

/* Fotoğraf blob'u → {tree,conf} (hata fırlatır; çağıran yakalar) */
async function dgAiDetect(blob){
 if(!dgAiEnabled()||!blob)return null;
 const c=dgAiCfg();
 const fd=new FormData();
 fd.append("photo",blob,"foto.jpg");
 const r=await fetch(c.url,{method:"POST",body:fd});
 if(!r.ok)throw new Error("HTTP "+r.status);
 const ct=String(r.headers.get("content-type")||"");
 const j=ct.includes("json")?await r.json():JSON.parse(await r.text());
 const out=dgAiParse(j);
 if(!out)throw new Error("yanıt çözümlenemedi");
 return out;
}

function dgAiOk(res){
 const c=dgAiCfg();
 const thr=(Number(c.thr)!=null&&Number.isFinite(Number(c.thr)))?Number(c.thr):50;
 return !!res&&res.tree===true&&(res.conf==null||res.conf>=thr);
}

/* checkPhoto kancası (measure.js): QA geçen fotoğrafta ağaç doğrulaması. */
async function dgAiOnPhoto(file){
 const box=$("aiSuggest");
 if(!dgAiEnabled()){if(box)box.style.display="none";return;}
 if(box){box.style.display="block";box.className="alert info";box.innerHTML="🌳 "+_tai("AI ağaç doğrulaması yapılıyor…");}
 let res=null;
 try{res=await dgAiDetect(file);}
 catch(e){
  if(box){
   box.className="alert warn";
   box.innerHTML="⚠ "+_tai("AI doğrulaması yapılamadı (ağ/CSP/CORS)")+': <span class="mono" style="font-size:.75rem">'+esc(e&&e.message||e)+"</span><br>"+_tai("fotoğraf QA sonucu geçerli, devam edilebilir.");
  }
  return; /* hata = kapıyı KAPATMA (sahada ağ sorunu ölçümü engellemesin) */
 }
 if(!res){if(box)box.style.display="none";return;}
 const c=dgAiCfg();
 const confTxt=res.conf!=null?" %"+res.conf:"";
 if(dgAiOk(res)){
  if(box){box.className="alert ok";box.innerHTML="🌳 <b>"+_tai("Ağaç algılandı")+"</b>"+esc(confTxt)+" ✓";}
 }else{
  if(box){
   box.className=c.block?"alert err":"alert warn";
   box.innerHTML="⚠ <b>"+_tai("AI ağaç algılayamadı")+"</b>"+esc(confTxt)+
    (res.conf!=null&&res.tree?" ("+_tai("Eşik (%) — altındaki güven 'ağaç yok' sayılır")+")":"")+
    " — "+_tai("kadrajı ağacı gösterecek şekilde düzeltin; yine de devam edebilirsiniz (insan kararı).")+
    (c.block?'<div style="font-size:.78rem;margin-top:4px"><b>'+_tai("AI kapısı açık: ağaç doğrulanmadan kayıt engellenir.")+"</b></div>":"");
  }
  /* AI kapısı (admin açarsa): fotoğrafı geçersiz say → KAYDET bloklanır
   * (measure.js zaten `if(f&&!photoOk)` ile durdurur). Yeniden çekimde
   * checkPhoto photoOk'u baştan hesaplar → kapı kendini onarır. */
  if(c.block){try{photoOk=false;}catch(e){}}
 }
}

/* ── Yönetim kartı (loadAdmin çağırır; yalnız admin/owner görünümünde) ── */
function dgAiAdminRender(){
 const box=$("dgAiAdmin");if(!box)return;
 const c=dgAiCfg();
 const thr=(c.thr!=null&&c.thr!=="")?c.thr:50;
 box.innerHTML=
  '<label class="dg-consent" for="dgAiOn" style="display:flex;gap:8px;align-items:flex-start;font-size:.84rem"><input type="checkbox" id="dgAiOn" style="width:auto;margin-top:3px" '+(c.on?"checked":"")+' onchange="dgAiAdminSave()"> <span>'+_tai("Etkin — fotoğraf çekilince AI ağaç doğrulaması")+'</span></label>'+
  '<label class="dg-consent" for="dgAiBlock" style="display:flex;gap:8px;align-items:flex-start;font-size:.84rem;margin-top:8px"><input type="checkbox" id="dgAiBlock" style="width:auto;margin-top:3px" '+(c.block?"checked":"")+' onchange="dgAiAdminSave()"> <span>'+_tai("AI kapısı: ağaç doğrulanmazsa fotoğrafı reddet (fotoğraf QA'sına ek)")+'</span></label>'+
  '<div class="lbl" style="margin-top:12px">'+_tai("Uç nokta (POST · multipart 'photo' · JSON yanıt)")+'</div>'+
  '<input id="dgAiUrl" type="url" placeholder="https://…/predict" value="'+esc(c.url||"")+'" onchange="dgAiAdminSave()" style="margin-top:6px">'+
  '<div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;align-items:center">'+
   '<label class="lbl" for="dgAiThr" style="margin:0">'+_tai("Eşik (%) — altındaki güven 'ağaç yok' sayılır")+'</label>'+
   '<input id="dgAiThr" type="number" min="0" max="100" step="1" value="'+esc(String(thr))+'" onchange="dgAiAdminSave()" style="width:90px">'+
  '</div>'+
  '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'+
   '<button class="btn sm blue" onclick="dgAiTest()">'+_tai("🧪 Test isteği gönder")+'</button>'+
  '</div>'+
  '<div id="dgAiTestOut" class="dg-meta" style="margin-top:8px"></div>'+
  '<p style="font-size:.75rem;color:var(--mut);margin-top:10px">'+_tai("Sunucu CORS açmalı (Access-Control-Allow-Origin: https://dendrogeo.org) ve URL, CSP connect-src listesine eklenmeli — adresi iletin, tek satırda eklenir. Model tarayıcıda çalışsın isterseniz ONNX/TF.js modu planlı (çevrimdışı saha).")+'</p>';
}
function dgAiAdminSave(){
 const c=dgAiCfg();
 const on=$("dgAiOn"),u=$("dgAiUrl"),thr=$("dgAiThr"),blk=$("dgAiBlock");
 c.on=!!(on&&on.checked);
 c.url=u?String(u.value||"").trim():"";
 c.thr=thr&&thr.value!==""?Math.max(0,Math.min(100,Number(thr.value)||0)):50;
 c.block=!!(blk&&blk.checked);
 dgAiSaveCfg(c);
}
async function dgAiTest(){
 dgAiAdminSave();
 const out=$("dgAiTestOut");
 const c=dgAiCfg();
 if(!c.url){if(out)out.textContent=_tai("Önce uç nokta URL'si girin.");return;}
 if(out)out.textContent="⏳ "+_tai("test isteği gönderiliyor…");
 try{
  /* 64×64 yeşil doku — amaç modeli değil HATTI doğrulamak (CSP/CORS/biçim) */
  const cv=document.createElement("canvas");cv.width=64;cv.height=64;
  const x=cv.getContext("2d");x.fillStyle="#2e8b57";x.fillRect(0,0,64,64);
  x.fillStyle="#1e6f4b";for(let i=0;i<64;i+=8)x.fillRect(i,0,4,64);
  const blob=await new Promise(r=>cv.toBlob(r,"image/jpeg",0.8));
  const t0=Date.now();
  const res=await dgAiDetect(blob);
  if(out)out.textContent=res
   ?((res.tree?"✓ 🌳 "+_tai("ağaç"):"— "+_tai("ağaç yok"))+(res.conf!=null?" %"+res.conf:"")+" · "+(Date.now()-t0)+" ms")
   :("— "+_tai("yanıt boş ya da çözümlenemedi (CSP/CORS/kontrol edin)"));
 }catch(e){
  if(out)out.textContent="⚠ "+String(e&&e.message||e)+" — "+_tai("CSP connect-src ve CORS kontrol edin");
 }
}
