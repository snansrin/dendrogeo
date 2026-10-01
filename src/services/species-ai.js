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

/* ═══ 0043 · YERLEŞİK ÇEVRİMDIŞI AĞAÇ ALGILAYICI ═══
 * KULLANICI: "ağaç algılamayı da düzelt." Algılama YALNIZ soketti: uç nokta
 * (c.on+c.url) verilmediyse dgAiOnPhoto HİÇBİR ŞEY yapmıyordu → "🤖 AI Ağaç
 * Algılama" kartı ölü/bozuk görünüyordu. Artık uç nokta yoksa TARAYICIDA
 * (canvas) çalışan sezgisel bir algılayıcı devreye girer: sahada, çevrimdışı,
 * gerçek model/CORS/CSP gerektirmez. Uç nokta VERİLİRSE o önceliklidir (yerleşik
 * yalnız yedek olarak, uç nokta ağ/CSP/CORS ile çökerse devreye girer).
 *
 * Sezgi (modelin yerini TUTMAZ, kaba elek): taç yeşili oranı + gövde/dal kahvesi
 * + yeşilin kadrajın ÜST yarısında olması (taç) + gökyüzünün kadrajı DOMİNE
 * etmemesi + pozlama. → {tree:true/false, conf:0-100}.
 *
 * BİLİMSEL/GÜVENLİK İLKESİ: yerleşik sonuç YALNIZ UYARIDIR (advisory) — kaydı
 * ASLA engellemez; sezgisel yanlış-negatifler saha veri girişini durdurmamalı.
 * Sert kapı (photoOk=false) YALNIZ gerçek model uç noktası + admin'in açık
 * izniyle tetiklenir. DB'ye DOKUNMAZ (bekçi testi: veritabanı çağrısı yasak). */
async function dgAiBuiltin(file){
 if(!file)return null;
 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("görsel okunamadı"));i.src=url;});
  const S=128,c=document.createElement("canvas");c.width=S;c.height=S;
  const x=c.getContext("2d",{willReadFrequently:true});
  x.drawImage(img,0,0,S,S);
  const d=x.getImageData(0,0,S,S).data;
  let green=0,brown=0,sky=0,bright=0,greenTop=0,topPx=0;
  const n=S*S,topCut=S*0.62;
  for(let py=0;py<S;py++){
   const isTop=py<topCut;
   for(let px=0;px<S;px++){
    const p=(py*S+px)*4,R=d[p],G=d[p+1],B=d[p+2];
    const lum=(R+G+B)/3;bright+=lum;
    if(isTop)topPx++;
    if(2*G-R-B>18&&G>45&&G>B-6){green++;if(isTop)greenTop++;}
    else if(R>G&&G>=B-4&&R-B>12&&R>48&&R<205)brown++;
    if(B>R+6&&B>=G-4&&lum>148)sky++;
   }
  }
  const greenR=green/n,brownR=brown/n,skyR=sky/n,greenTopR=topPx?greenTop/topPx:0;
  bright/=n;
  let score=0;
  score+=Math.min(48,greenR*150);              /* taç yeşili (en çok 48) */
  score+=Math.min(16,brownR*200);              /* gövde/dal kahvesi (en çok 16) */
  score+=Math.min(14,greenTopR*36);            /* yeşil üst yarıda = taç (en çok 14) */
  score+=Math.min(10,(1-Math.min(1,skyR))*10); /* gökyüzü azsa puan (en çok 10) */
  if(bright<26||bright>240)score-=14;          /* çok karanlık / patlak */
  score=Math.max(0,Math.min(100,Math.round(score)));
  /* Eşikler BİLEREK gevşek (yanlış-negatiften kaçın): fotoğraf QA'sı zaten
   * ≥%25 yeşil örtü şart koşuyor, yani buraya gelen kare yeşil ağırlıklı. */
  const tree=(greenR>=0.12||brownR>=0.06)&&skyR<0.85&&score>=35;
  return{tree,conf:score,greenR:+greenR.toFixed(3),brownR:+brownR.toFixed(3),skyR:+skyR.toFixed(3)};
 }finally{try{URL.revokeObjectURL(url);}catch(e){}}
}

/* checkPhoto kancası (measure.js): QA geçen fotoğrafta ağaç doğrulaması.
 * 0043: uç nokta varsa o (gerçek model), yoksa YERLEŞİK çevrimdışı algılayıcı.
 * Yerleşik sonuç advisory'dir (kaydı engellemez); sert kapı yalnız gerçek model. */
async function dgAiOnPhoto(file){
 const box=$("aiSuggest");
 const c=dgAiCfg();
 const ext=dgAiEnabled();                 /* c.on && c.url → gerçek model uç noktası */
 const builtin=(c.builtin!==false);       /* yerleşik çevrimdışı algılayıcı: varsayılan AÇIK */
 if(!ext&&!builtin){if(box)box.style.display="none";return;}
 if(box){box.style.display="block";box.className="alert info";
  box.innerHTML="🌳 "+_tai(ext?"AI ağaç doğrulaması yapılıyor…":"Ağaç algılanıyor (yerleşik · çevrimdışı)…");}
 let res=null;
 if(ext){
  try{res=await dgAiDetect(file);if(res)res.src="ext";}
  catch(e){
   /* Uç nokta çöktü (ağ/CSP/CORS): saha işi durmasın → yerleşik algılayıcıya
    * düş (varsa); o da yoksa sebebi göster AMA kapıyı KAPATMA (engelleme). */
   res=null;
   if(builtin){try{const b=await dgAiBuiltin(file);b.src="builtin";b.advisory=true;b.netWarn=(e&&e.message)||String(e);res=b;}catch(e2){}}
   if(!res){
    if(box){
     box.className="alert warn";
     box.innerHTML="⚠ "+_tai("AI doğrulaması yapılamadı (ağ/CSP/CORS)")+': <span class="mono" style="font-size:.75rem">'+esc(e&&e.message||e)+"</span><br>"+_tai("fotoğraf QA sonucu geçerli, devam edilebilir.");
    }
    return;
   }
  }
 }else{
  try{res=await dgAiBuiltin(file);if(res){res.src="builtin";res.advisory=true;}}
  catch(e){if(box)box.style.display="none";return;}
 }
 if(!res){if(box)box.style.display="none";return;}
 const advisory=!!res.advisory;
 const confTxt=res.conf!=null?" %"+res.conf:"";
 const srcNote=advisory?' <span style="font-size:.75rem;color:var(--mut)">('+_tai("yerleşik algılayıcı")+(res.netWarn?" · "+_tai("uç nokta erişilemedi, yerleşik kullanıldı"):"")+")</span>":"";
 /* Kapı (photoOk=false) YALNIZ gerçek model + admin izniyle; yerleşik asla engellemez. */
 const treeOk=advisory?!!res.tree:dgAiOk(res);
 if(treeOk){
  if(box){box.className="alert ok";box.innerHTML="🌳 <b>"+_tai("Ağaç algılandı")+"</b>"+esc(confTxt)+" ✓"+srcNote;}
 }else{
  if(box){
   box.className=(!advisory&&c.block)?"alert err":"alert warn";
   box.innerHTML="⚠ <b>"+_tai("AI ağaç algılayamadı")+"</b>"+esc(confTxt)+
    (!advisory&&res.conf!=null&&res.tree?" ("+_tai("Eşik (%) — altındaki güven 'ağaç yok' sayılır")+")":"")+
    " — "+_tai("kadrajı ağacı gösterecek şekilde düzeltin; yine de devam edebilirsiniz (insan kararı).")+srcNote+
    ((!advisory&&c.block)?'<div style="font-size:.78rem;margin-top:4px"><b>'+_tai("AI kapısı açık: ağaç doğrulanmadan kayıt engellenir.")+"</b></div>":"");
  }
  /* AI kapısı (admin GERÇEK model uç noktasıyla açarsa): fotoğrafı geçersiz say
   * → KAYDET bloklanır (measure.js zaten `if(f&&!photoOk)` ile durdurur).
   * Yeniden çekimde checkPhoto photoOk'u baştan hesaplar → kapı kendini onarır. */
  if(!advisory&&c.block){try{photoOk=false;}catch(e){}}
 }
}

/* ── Yönetim kartı (loadAdmin çağırır; yalnız admin/owner görünümünde) ──
 * 0043: kart artık YERLEŞİK çevrimdışı algılayıcıyı (varsayılan açık) önde
 * gösterir; gerçek model uç noktası "Gelişmiş" opsiyonudur (yerleşik yerine
 * geçer + sert kapı kurabilir). Böylece uç nokta olmadan da "ağaç algılama"
 * ÇALIŞIR (kullanıcı: "ağaç algılamayı da düzelt"). */
function dgAiAdminRender(){
 const box=$("dgAiAdmin");if(!box)return;
 const c=dgAiCfg();
 const thr=(c.thr!=null&&c.thr!=="")?c.thr:50;
 const biOn=(c.builtin!==false);
 box.innerHTML=
  '<label class="dg-consent" for="dgAiBuiltin" style="display:flex;gap:8px;align-items:flex-start;font-size:.84rem"><input type="checkbox" id="dgAiBuiltin" style="width:auto;margin-top:3px" '+(biOn?"checked":"")+' onchange="dgAiAdminSave()"> <span>'+_tai("Yerleşik ağaç algılama (çevrimdışı · model gerektirmez · yalnız uyarı, kaydı engellemez)")+'</span></label>'+
  '<div class="lbl" style="margin-top:14px">'+_tai("Gelişmiş: gerçek model uç noktası (opsiyonel · yerleşik algılayıcının yerine geçer)")+'</div>'+
  '<label class="dg-consent" for="dgAiOn" style="display:flex;gap:8px;align-items:flex-start;font-size:.84rem;margin-top:6px"><input type="checkbox" id="dgAiOn" style="width:auto;margin-top:3px" '+(c.on?"checked":"")+' onchange="dgAiAdminSave()"> <span>'+_tai("Etkin — fotoğraf çekilince AI ağaç doğrulaması")+'</span></label>'+
  '<label class="dg-consent" for="dgAiBlock" style="display:flex;gap:8px;align-items:flex-start;font-size:.84rem;margin-top:8px"><input type="checkbox" id="dgAiBlock" style="width:auto;margin-top:3px" '+(c.block?"checked":"")+' onchange="dgAiAdminSave()"> <span>'+_tai("AI kapısı: ağaç doğrulanmazsa fotoğrafı reddet (fotoğraf QA'sına ek)")+'</span></label>'+
  '<div class="lbl" style="margin-top:12px">'+_tai("Uç nokta (POST · multipart 'photo' · JSON yanıt)")+'</div>'+
  '<input id="dgAiUrl" type="url" placeholder="https://…/predict" value="'+esc(c.url||"")+'" onchange="dgAiAdminSave()" style="margin-top:6px">'+
  '<div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;align-items:center">'+
   '<label class="lbl" for="dgAiThr" style="margin:0">'+_tai("Eşik (%) — altındaki güven 'ağaç yok' sayılır")+'</label>'+
   '<input id="dgAiThr" type="number" min="0" max="100" step="1" value="'+esc(String(thr))+'" onchange="dgAiAdminSave()" style="width:90px">'+
  '</div>'+
  '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">'+
   '<button class="btn sm blue" onclick="dgAiTest()">'+_tai("🧪 Test isteği gönder")+'</button>'+
   '<button class="btn sm ghost" onclick="dgAiTestBuiltin()">'+_tai("🌳 Yerleşik algılayıcıyı dene")+'</button>'+
  '</div>'+
  '<div id="dgAiTestOut" class="dg-meta" style="margin-top:8px"></div>'+
  '<p style="font-size:.75rem;color:var(--mut);margin-top:10px">'+_tai("Yerleşik algılayıcı tarayıcıda çalışır (çevrimdışı saha): yeşil örtü + gövde + kadraj sezgisiyle 'ağaç var mı' der; YALNIZ UYARIDIR, kaydı engellemez. Daha kesin sonuç için gerçek model bağlayın: sunucu CORS açmalı (Access-Control-Allow-Origin: https://dendrogeo.org) ve URL, CSP connect-src listesine eklenmeli — adresi iletin, tek satırda eklenir.")+'</p>';
}
function dgAiAdminSave(){
 const c=dgAiCfg();
 const on=$("dgAiOn"),u=$("dgAiUrl"),thr=$("dgAiThr"),blk=$("dgAiBlock"),bi=$("dgAiBuiltin");
 c.on=!!(on&&on.checked);
 c.url=u?String(u.value||"").trim():"";
 c.thr=thr&&thr.value!==""?Math.max(0,Math.min(100,Number(thr.value)||0)):50;
 c.block=!!(blk&&blk.checked);
 /* 0043: yerleşik çevrimdışı algılayıcı — kutu yoksa/yüklendiyse varsayılan AÇIK. */
 c.builtin=!(bi&&!bi.checked);
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
/* 0043: yerleşik çevrimdışı algılayıcıyı uç nokta OLMADAN dener — yönetim
 * kartındaki "🌳 Yerleşik algılayıcıyı dene" düğmesi. Sentetik bir "ağaç"
 * karesi (gökyüzü + taç + gövde + zemin) çizip dgAiBuiltin'i çalıştırır;
 * amaç heuristiğin canlı olduğunu ve makul puan ürettiğini göstermek. */
async function dgAiTestBuiltin(){
 const out=$("dgAiTestOut");
 if(out)out.textContent="⏳ "+_tai("yerleşik algılayıcı deneniyor…");
 try{
  const cv=document.createElement("canvas");cv.width=128;cv.height=128;
  const x=cv.getContext("2d");
  x.fillStyle="#bfe3ff";x.fillRect(0,0,128,64);          /* gökyüzü */
  x.fillStyle="#2e7d32";x.beginPath();x.arc(64,54,40,0,6.2832);x.fill(); /* taç */
  x.fillStyle="#6b4423";x.fillRect(58,72,12,48);          /* gövde */
  x.fillStyle="#5b8c3e";x.fillRect(0,112,128,16);         /* zemin örtüsü */
  const blob=await new Promise(r=>cv.toBlob(r,"image/jpeg",0.9));
  const t0=Date.now();
  const res=await dgAiBuiltin(blob);
  if(out)out.textContent=res
   ?((res.tree?"✓ 🌳 "+_tai("ağaç"):"— "+_tai("ağaç yok"))+(res.conf!=null?" %"+res.conf:"")+" · "+(Date.now()-t0)+" ms · "+_tai("yerleşik"))
   :("— "+_tai("sonuç yok"));
 }catch(e){
  if(out)out.textContent="⚠ "+String(e&&e.message||e);
 }
}
