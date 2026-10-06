"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar (harness'ler constants yüklemeyebilir). */
const _tms=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tmsf=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));
/* ============ KONUMDAN İL/ÜLKE ALGILAMA ============ */
/* TÜRKİYE'de il adı "state" alanındadır (admin_level=4); ilçe "city/town"a düşer.
   TR için KESİN çözüm: önce state oku → ilçe asla gelmez. */
async function reverseGeocode(lat,lon){
 try{
  const r=await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat="+lat+"&lon="+lon+"&accept-language=tr",{headers:{Accept:"application/json"}});
  if(!r.ok)return null;
  const j=await r.json();const a=j.address||{};
  const cc=(a.country_code||"").toLowerCase();
  const city=cc==="tr"
   ?(a.state||a.province||a.city||null)
   :(a.city||a.town||a.village||a.municipality||a.state||null);
  const country=a.country||null;
  if(!city&&!country)return null;
  return{city:city||"Bilinmiyor",country:country||"Bilinmiyor"};
 }catch(e){return null;}
}
/* --- 2. FOTOĞRAF DENETİMİ (0044 · ÇOK SINIFLI BİTKİ/DAL SEZGİSİ) ---
 * KULLANICI (0044): "%25'i kırmızı yapraklı ağaçlar sağlamıyor ve önümüz kış,
 * fotoğrafta sadece dal olacağı için yeşil çok az — o yüzden fotoğraf
 * yükleyemez kullanıcılar. Ben bugün 1 fotoğraf için sahada 30 dk harcadım."
 *
 * KÖK NEDEN (kanıtla): eski kapı YALNIZ yeşili sayıyordu (2G-R-B>20 && G>50).
 *   · mor/kırmızı yaprak (Prunus pissardii vb.) → %12 yeşil  → KAYIT ENGELLİ
 *   · kış çıplak dal                            → %0.4 yeşil → KAYIT ENGELLİ
 *   · sonbahar sarı/kızıl                       → %4-6 yeşil → KAYIT ENGELLİ
 *   · gövde+şerit metre (DBH) kadrajı           → %18 yeşil  → KAYIT ENGELLİ
 *   ÜSTELİK saf gökyüzü %52 "yeşil" sayılıp GEÇİYORDU: ExG indeksinde G>B
 *   koruması yoktu, mavi-gökkuşağı bandı yeşile düşüyordu.
 *
 * ÇÖZÜM: piksel başına ÇOK SINIFLI sınıflandırma + parlaklık-modu sapmasıyla
 * ince yapı (dal silüeti). Eşiklerin tamamı 22 karelik gerçek fotoğraf
 * korpusuyla kalibre edildi (test/photo-qa.test.mjs + calib/): yeşil ·
 * kızıl/mor (antosiyanin) · sonbahar (sarı/turuncu) · gövde/dal kahvesi ·
 * kış kadrajı (mavi gök fonu + dal silueti). Karar YİNE insanda: bu kapı
 * yalnızca BARİZ yanlış kareyi (gök/duvar/kapak/patlak) sahada erken
 * yakalar; ölçüm bilimine (QA_LIMITS, karbon motoru) DOKUNMAZ.
 *
 * dgPhotoScan SAF fonksiyondur (canvas verisi alır) → node'da testsiz
 * tarayıcı olmadan doğrulanabilir. */
function loadImg(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file);const i=new Image();i.onload=()=>res({i,u});i.onerror=()=>{URL.revokeObjectURL(u);rej(new Error("image"));};i.src=u;});}
function dgPhotoScan(d,S){
 const n=S*S;
 let green=0,warm=0,purple=0,woody=0,blue=0,cloud=0,dark=0,lumSum=0;
 const lum=new Float64Array(n);
 for(let i=0,p=0;i<n;i++,p+=4){
  const R=d[p],G=d[p+1],B=d[p+2];
  const L=(R+G+B)/3;lum[i]=L;lumSum+=L;
  const mx=R>G?(R>B?R:B):(G>B?G:B),mn=R<G?(R<B?R:B):(G<B?G:B),sat=mx-mn;
  const isBlue=(B>G+10&&B>R+20);                 /* gök mavisi (koyu mavi dahil) */
  if(isBlue)blue++;
  else if(L>185&&sat<30&&B>=R-4)cloud++;          /* bulut / parlak beyaz */
  else if(2*G-R-B>20&&G>40&&G>=B-2&&G>=R-12)green++; /* yeşil örtü — G>=B-2: mavi gök, G>=R-12: turuncu SIZAMAZ */
  else if(R>G+8&&G>B+5&&R>70&&L>95&&L<232&&sat>22)warm++;  /* sarı/turuncu sonbahar (kabuk L<=95'te woody'ye düşer) */
  else if(R>G+12&&R>B+8&&B>G-28&&L>30&&L<215&&sat>18)purple++; /* antosiyanin: mor/kırmızı yaprak */
  else if(R>G&&G>=B-4&&(R-B)>12&&(R-B)<95&&R>45&&R<205&&sat>8)woody++; /* kabuk / dal kahvesi */
  if(L<90&&!isBlue)dark++;                        /* koyu silüet (koyu MAVİ gök hariç) */
 }
 /* Arka plan parlaklık modu (16 kutulu histogram) → moddan >32 sapan ve
  * gök/bulut OLMAYAN pikseller = ince yapı: çıplak dal, gövde kenarı, silüet. */
 const hist=new Array(16).fill(0);
 for(let i=0;i<n;i++)hist[Math.min(15,(lum[i]/16)|0)]++;
 let bi=0;for(let k=1;k<16;k++)if(hist[k]>hist[bi])bi=k;
 const bgL=bi*16+8;
 let struct=0;
 for(let i=0,p=0;i<n;i++,p+=4){
  const L=lum[i];
  if(Math.abs(L-bgL)>32){
   const R=d[p],G=d[p+1],B=d[p+2];
   const mx=R>G?(R>B?R:B):(G>B?G:B),mn=R<G?(R<B?R:B):(G<B?G:B),sat=mx-mn;
   if(!((B>G+10&&B>R+20)||(L>185&&sat<30&&B>=R-4)))struct++;
  }
 }
 return{lum:lumSum/n,blue:blue/n,cloud:cloud/n,green:green/n,warm:warm/n,
        purple:purple/n,woody:woody/n,dark:dark/n,struct:struct/n};
}
/* KAPI (0044 · kalibre): pozlama teknik eşikleri + en az BİR bitki/dal kanıtı.
 *   foliage ≥ %5  VEYA  gövde/dal ≥ %5  VEYA  kış kadrajı
 *   (kış kadrajı = karenin ≥ %25'i gök mavisi İKEN ≥ %2.5 ince yapı veya
 *    ≥ %3 koyu silüet — çıplak dal fotoğrafının tek güvenilir imzası bu). */
function dgPhotoGate(m){
 const exp=m.lum>25&&m.lum<245;
 const fol=m.green+m.warm+m.purple;
 const winter=m.blue>=0.25&&(m.struct>=0.025||m.dark>=0.03);
 return exp&&(fol>=0.05||m.woody>=0.05||winter);
}
/* Kullanıcıya NEYİ gördüğümüzü söyler (uyarı anlaşılır olsun, ezbere değil). */
function dgPhotoLabel(m){
 const p=(x)=>"%"+Math.round(x*100);
 const t=[];
 if(m.green>=0.05)t.push(_tms("yeşil örtü")+" "+p(m.green));
 if(m.purple>=0.05)t.push(_tms("kızıl/mor yaprak")+" "+p(m.purple));
 if(m.warm>=0.05)t.push(_tms("sonbahar rengi")+" "+p(m.warm));
 if(m.woody>=0.05)t.push(_tms("gövde/dal")+" "+p(m.woody));
 if(m.blue>=0.25&&(m.struct>=0.025||m.dark>=0.03))t.push(_tms("kış kadrajı (dal silüeti)"));
 return t.join(" · ");
}
let dgPhotoCheckVersion=0;
function dgClearMeasurePhoto(){
 dgPhotoCheckVersion++;photoOk=false;
 $("mPhoto").value="";$("mPhotoName").textContent="";$("photoCheck").style.display="none";
 const remove=$("mPhotoRemove");if(remove)remove.style.display="none";
}
async function checkPhoto(e){
 const version=++dgPhotoCheckVersion;photoOk=false;
 const f=e.target.files[0],box=$("photoCheck");
 {const fn=$("mPhotoName");if(fn)fn.textContent=f?f.name:"";}
 const remove=$("mPhotoRemove");if(remove)remove.style.display=f?"inline-flex":"none";
 if(!f){photoOk=false;box.style.display="none";return;}
 if(!f.type.startsWith("image/")){photoOk=false;box.className="alert err";box.style.display="block";box.innerHTML="⚠ "+_tms("Yalnızca görsel dosyası yükleyin.");return;}
 box.style.display="block";box.className="alert info";box.innerHTML="⏳ "+_tms("Fotoğraf denetleniyor…");
 try{
  const{i,u}=await loadImg(f);
  if(version!==dgPhotoCheckVersion){URL.revokeObjectURL(u);return;}
  const S=120,c=document.createElement("canvas");c.width=S;c.height=S;
  const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(i,0,0,S,S);URL.revokeObjectURL(u);
  const m=dgPhotoScan(x.getImageData(0,0,S,S).data,S);
  const ok=dgPhotoGate(m);
  photoOk=ok;
  if(ok){
   const lbl=dgPhotoLabel(m);
   box.className="alert ok";box.innerHTML=`✓ <b>${_tms("Fotoğraf uygun")}</b> · ${lbl||_tms("bitki/dal kanıtı yeterli")} · ${_tms("Pozlama:")} ${m.lum.toFixed(0)}/255`;
  }else{
   const why=(m.lum>25&&m.lum<245)
    ?_tms("Karede ağaç/dal/bitki örtüsü kanıtı bulunamadı.")
    :_tms("Pozlama uygun değil (çok karanlık veya patlak).");
   box.className="alert err";box.innerHTML=`⚠ <b>${_tms("Fotoğraf uygun değil")}</b> · ${why}<br>${_tms("Ağacı, gövdesini veya dallarını kadraja alıp yeniden çekin.")}`;
  }
 }catch(err){if(version!==dgPhotoCheckVersion)return;photoOk=false;box.className="alert err";box.innerHTML="⚠ "+_tms("Fotoğraf okunamadı, tekrar deneyin.");}
}
/* --- 3. GPS --- */
/* Ekran kilidi: saha ölçümü sırasında ekranın kararmasını engeller.
 * iOS Safari ekran kilitlendiğinde konum izlemeyi kestiği için bu, ölçümün
 * yarıda kalmasını önler. Sekme arka plana alınıp geri dönüldüğünde kilit
 * kendiliğinden bırakıldığı için visibilitychange ile yeniden alınır.
 * Desteklemeyen tarayıcılarda sessizce yok sayılır; ölçüm akışını etkilemez. */
let WAKE_LOCK=null;
async function acquireWakeLock(){
 if(!("wakeLock" in navigator))return;
 try{
  if(WAKE_LOCK)return;
  WAKE_LOCK=await navigator.wakeLock.request("screen");
  WAKE_LOCK.addEventListener("release",()=>{WAKE_LOCK=null;});
 }catch(e){WAKE_LOCK=null;}
}
if(!window._wakeLockHooked){
 window._wakeLockHooked=true;
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&GPS)acquireWakeLock();
 });
}

/* CANLI BUTON (2026-09-26 · kullanıcı isteği): 📡 Konumu Etkinleştir, 🌿 Yüzey
 * Örtüsü Analizi butonuyla BİREBİR aynı davranışı kazanır (park-export.js
 * runLandCoverAnalysis deseni): basınca disabled + "⏳ Konum alınıyor…" +
 * opacity .65 + cursor wait; sonuçta eski metnine döner. Yeni tema/animasyon
 * YOK — aynı sınıf (.dg-png-btn primary) ve aynı mekanizma. */
function dgGpsBtnBusy(on){
 const b=$("gpsBtn");if(!b)return;
 if(on){b.dataset.oldText=b.innerHTML;b.innerHTML="⏳ Konum alınıyor…";b.disabled=true;b.style.opacity=".65";b.style.cursor="wait";}
 else{b.disabled=false;b.innerHTML=b.dataset.oldText||"📡 Konumu Etkinleştir";b.style.opacity="";b.style.cursor="";}
}
async function startGps(){
 const gpsMsg=(t,e)=>{const g=$("gpsState");if(g){g.textContent=t;g.className="alert "+(e?"err":"info");}if(e){dgGpsBtnBusy(false);const b=$("gpsBtn");if(b){b.textContent="📡 Konumu Tekrar Dene";b.dataset.oldText=b.textContent;}if(typeof toast==="function")toast(t,"err","📍");}};
 if(!navigator.geolocation)return gpsMsg("Tarayıcı konum desteklemiyor.",1);
 if(/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1))toast("<b>"+_tms("iPhone kullanıcısı mısınız?")+"</b><br>"+_tms("Ayarlar → Gizlilik ve Güvenlik → Konum Servisleri → Safari Siteleri → Uygulamayı Kullanırken."),"info","📍",12000);
 try{if(navigator.permissions&&navigator.permissions.query){const p=await navigator.permissions.query({name:"geolocation"});if(p.state==="denied")return gpsMsg("Konum izni reddedildi. Ayarlar→Safari→Konum.",1);}}catch(e){}
 gpsMsg("Konum alınıyor…",0);
 dgGpsBtnBusy(true);
 const opts={enableHighAccuracy:true,timeout:15000,maximumAge:0};
 const onOk=p=>{dgGpsBtnBusy(false);GPS=p.coords;updGps();if(typeof dgLiveSharePing==="function")dgLiveSharePing();if(typeof dgPresencePing==="function")dgPresencePing();acquireWakeLock();navigator.geolocation.watchPosition(p2=>{GPS=p2.coords;updGps();if(typeof dgLiveSharePing==="function")dgLiveSharePing();if(typeof dgPresencePing==="function")dgPresencePing();},()=>{},{...opts,maximumAge:1000});};
 const onErr=e=>{
  if(e.code===1)return gpsMsg("İzin reddedildi. iPhone: Ayarlar→Safari→Konum→Kullanırken İzin Ver.",1);
  if(e.code===3){try{navigator.geolocation.getCurrentPosition(onOk,()=>gpsMsg("GPS başarısız: dışarıda tekrar deneyin.",1),opts);}catch(err){gpsMsg("GPS hatası.",1);}return;}
  gpsMsg("GPS hatası: "+e.message,1);
 };
 try{navigator.geolocation.getCurrentPosition(onOk,onErr,opts);}catch(e){gpsMsg("Konum başlatılamadı.",1);}
}
function updGps(){
 const a=GPS.accuracy;
 const acc=$("gpsAcc"),lat=$("gLat"),lon=$("gLon"),alt=$("gAlt"),quality=$("gQ"),ring=$("gpsRing"),state=$("gpsState"),btn=$("gpsBtn");
 if(acc)acc.textContent=a.toFixed(0);
 if(lat)lat.textContent=GPS.latitude.toFixed(6);
 if(lon)lon.textContent=GPS.longitude.toFixed(6);
 if(alt)alt.textContent=Number.isFinite(GPS.altitude)?GPS.altitude.toFixed(0)+" m":"—";
 const q=a<10?"ÇOK İYİ":a<20?"İYİ":a<40?"ORTA":"ZAYIF";
 if(quality)quality.textContent=q;
 if(ring)ring.className="gpsring "+(a<10?"good":a<30?"mid":"bad");
 /* Ana ekranda doğruluk sayısı/kalite cümlesi gösterilmez; ayrıntılar açılır
  * panelde kalır. Konum alınınca tek bakışta buton durum değiştirir. */
 if(state){state.textContent="GPS aktif";state.className="alert ok";}
 if(btn){btn.textContent="✓ GPS aktif";btn.dataset.oldText="✓ GPS aktif";btn.classList.add("is-active");}
 const bd=$("gpsBadge");
 if(bd){bd.textContent="GPS aktif";bd.className="dg-png-badge";}
 if(map&&GPS){if(window._me)map.removeLayer(window._me);window._me=L.circleMarker([GPS.latitude,GPS.longitude],{radius:7,color:"#2b6cb0",weight:3,fillOpacity:.9}).addTo(map).bindPopup("Konumun");}
 drawNav();autoFillPointId();
}
/* --- 4. FORM YARDIMCILARI --- */
function fillSpecies(){
 const gv=$("mGroup").value,s=$("mSpecies");
 $("latinName").textContent="";
 /* 0036: EN modunda option GÖRÜNÜMÜ çevrilir; value kanonik TR kalmalıdır
  * (shell'de value="İBRELİ" açık yazıldı). Bayat DOM/önbellek için ters
  * sözlükten çöz → "CONIFER" gelirse "İBRELİ"ye dön. */
 const g=(typeof SPECIES_DATA!=="undefined"&&SPECIES_DATA[gv])?gv
        :((typeof DG_I18N_TR!=="undefined"&&DG_I18N_TR[gv])||gv);
 if(!g||!(typeof SPECIES_DATA!=="undefined"&&SPECIES_DATA[g])){s.disabled=true;s.innerHTML=`<option value="">${_tms("Önce grup seçin")}</option>`;$("latinName").textContent="";return;}
 s.disabled=false;
 /* 0035b: GÖRÜNEN tür adı dgT() ile çevrilir (EN modu); option VALUE her
  * zaman kanonik TR adıdır — veritabanına yazılan değer DEĞİŞMEZ. */
 /* 0036 (T1): tür listesi ALFABETİK (tr yereli) — SPECIES_DATA sırasına dokunulmaz. */
 s.innerHTML='<option value="">Seç</option>'+(SPECIES_DATA[g]||[]).slice().sort((a,b)=>String(a.tr).localeCompare(String(b.tr),"tr")).map(x=>`<option value="${x.tr}">${(typeof dgT==="function"?dgT(x.tr):x.tr)}${x.lat && x.lat!=="—"?" · "+x.lat:""}</option>`).join("");
 $("latinName").textContent="";
}
function showLatin(){
 const sp=$("mSpecies").value;
 $("latinName").textContent=(LATIN[sp]&&LATIN[sp]!=="—")?("🔬 "+LATIN[sp]):"";
}
function liveCalc(){
 const c=+$("mDbh").value,h=+$("mHeight").value,s=$("mSpecies").value,g=$("mGroup").value;
 const groupOk=(typeof MEASUREMENT_GROUPS!=="undefined"&&MEASUREMENT_GROUPS.includes(g));
 const densityOk=(typeof densityKgFor==="function"&&densityKgFor(s,g)>0);
 const measureOk=(typeof circumferenceIsValid==="function"&&circumferenceIsValid(c));
 const valid=Number.isFinite(c)&&Number.isFinite(h)&&measureOk&&h>0&&h<=100&&s&&groupOk&&densityOk;
 $("liveCalc").style.display=valid?"block":"none";
 const hint=$("measureSaveHint");if(hint)hint.style.display=valid?"none":"block";
 if(!valid)return;
 const r=calcFromCircumference(c,h,s,g);
 if(!r.valid)return;
 $("liveCalc").innerHTML=`<b>${_tms("Tahmini karbon")} · ${r.total_carbon.toFixed(1)} kg</b><br><small>${_tms("Göğüs çevresi")} ${c.toFixed(1)} cm → DBH ${r.dbh_cm.toFixed(1)} cm · AGB ${r.agb.toFixed(1)} · BHB ${r.bhb.toFixed(1)} kg · ${_tms("Hacim")} ${r.vol.toFixed(3)} m³ · ρ ${r.density_kg_m3} kg/m³</small>`;
}
function dgMeasureInvalid(id,message){
 const el=$(id);if(el){el.setAttribute("aria-invalid","true");el.focus();}
 toast(message,"err");
}
function dgResetMeasureFields(){
 for(const id of ["mPoint","mDbh","mHeight"])$(id).value="";
 dgClearMeasurePhoto();$("pointQueryResult").style.display="none";
 manualPoint=false;liveCalc();
}

/* --- 5. PROJE CRUD --- */
/* PROJE = PARK + ETİKET (2026-09-24).
 * Proje adı artık serbest metin değil: park algılanır, kullanıcı bir etiket
 * verir ("deneme") ve ad "Göksu Parkı - deneme" olur. Adı DB tarafında
 * trg_compose_project_name kurar; istemci dgProjectName() ile AYNI string'i
 * önizler. Park algılanmadan proje de ölçüm de açılamaz
 * (sunucu kapısı: trg_enforce_park_link → PARK_REQUIRED). */
let EDIT_PROJ_PARK=null;

/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
/* 0045: SON KULLANILAN PARK/PROJE hatırlanır (kullanıcı: "sayfa yenilendiğinde
 * park-proje değişmesin, en son hangisinde çalışılıyorsa onda kalsın").
 * Bellek CİHAZDA (localStorage): sunucuda yeni alan/şema/RLS yok (kırmızı çizgi).
 * Geri yükleme KOŞULLU: id hâlâ PROJ_LIST'te varsa seçilir — silinmiş/paylaşımdan
 * çıkmış proje hortlamaz; düzenleme modu (EDIT_ID) değeri zaten kendisi yazar. */
const DG_LAST_PROJ_KEY="dg_last_proj";
function dgProjectRemember(id){try{if(id)localStorage.setItem(DG_LAST_PROJ_KEY,String(id));}catch(e){}}
function dgProjectRestore(){
 let last=null;try{last=localStorage.getItem(DG_LAST_PROJ_KEY);}catch(e){}
 if(!last)return;
 if(!(PROJ_LIST||[]).some(p=>String(p.id)===last))return;
 for(const id of ["mProject","nProject"]){const s=$(id);if(s)s.value=last;}
}
function dgProjectOpenMeasure(id){
 const p=(PROJ_LIST||[]).find(x=>Number(x.id)===Number(id));if(!p)return;
 dgProjectRemember(id);
 go("measure");
 setTimeout(()=>{
  const sel=$("mProject");if(sel)sel.value=String(id);
  if(typeof dgProjectChanged==="function")dgProjectChanged();
  if(typeof dgParkGate==="function")dgParkGate();
 },80);
}
function dgProjectCard(p,isShared){
 const park=p.parks&&p.parks.name?p.parks.name:(p.park_name||"Park bağlantısı yok");
 const area=p.parks&&p.parks.area_m2?dgFmtHa(p.parks.area_m2):"";
 const loc=[p.city,p.country].filter(Boolean).map(esc).join(" · ")||"Konum belirtilmedi";
 const date=p.created_at?new Date(p.created_at).toLocaleDateString("tr-TR"):"—";
 const role=isShared?'<span class="badge admin">ORTAK</span>':'<span class="badge on">PROJE SAHİBİ</span>';
 const parkState=p.park_id
  ? `<span>🌳 ${esc(park)}${area?" · "+area:""}</span>`
  : `<span class="project-warning">⛔ park yok</span><small>${dgIsAdmin()?"Yönetici olarak bu eski projeyi parka bağlayabilirsin.":"🔐 yönetici bağlayacak"}</small>`;
 const repBtn=p.park_id?`<button class="btn sm ghost" onclick="dgUserPubOpen(${p.id})">📄 Rapor</button>`:"";
 const linkBtn=!isShared&&!p.park_id&&dgIsAdmin()?`<button class="btn sm ghost" onclick="startParkScan({projectId:${p.id},returnTo:'projects'})">🌳 Parka bağla</button>`:"";
 const actions=isShared
  ? `<button class="btn sm" onclick="dgProjectOpenMeasure(${p.id})">📏 Ölçüme geç</button><span class="project-access-note">Düzenleme ve ekip yönetimi proje sahibinde</span>`
  : `<button class="btn sm" onclick="dgProjectOpenMeasure(${p.id})">📏 Ölçüm</button>${repBtn}${linkBtn}<button class="btn sm ghost" onclick="editProject(${p.id})">✏️ Düzenle</button><button class="btn sm ghost project-danger" onclick="deleteProject(${p.id})">🗑 Sil</button>`;
 return `<article class="project-card ${isShared?"is-shared":"is-owned"}"><div class="project-card-top"><div><div class="project-card-park">${parkState}</div><h4>${esc(p.name||("Proje #"+p.id))}</h4></div>${role}</div><div class="project-card-meta"><span>📍 ${loc}</span><span>📅 ${date}</span><span class="mono">#${p.id}</span></div><div class="project-card-actions">${actions}</div></article>`;
}
async function loadProjects(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadProjects__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadProjects__scroll(){
 if(!USER)return;
 /* parks gömüsü: projenin park kimliği + alanı (kapı kartı ve tablo için).
  * Şema eskiyse (0004 uygulanmamış) PostgREST ilişkiyi bulamaz ve hata döner;
  * o zaman düz select'e düşülür ki proje listesi tamamen boş kalmasın. */
 let{data,error}=await sb.from("projects").select("*,parks(id,name,city,country,area_m2)").eq("owner",USER.id);
 if(error){
  dgParkSchemaMissing("projects↔parks: "+error.message);
  const fb=await sb.from("projects").select("*").eq("owner",USER.id);
  data=fb.data||[];
 }
 PROJ_LIST=data||[];
 /* 0025 · PAYLAŞILAN PARKLAR: kabul edilmiş park ortağıysan, o parkın
  * SAHİBİ OLMADIĞIN projeleri de listeye eklenir → aynı projeye birlikte
  * ölçü girilir. Kayıtlar her zamanki gibi owner=sen (saveMeas) ile gider;
  * konum çiti (0007) ve park bağı kilidi (0006) değişmez. v_my_parks/RPC
  * yoksa (0025 SQL uygulanmamış) sessizce eski davranış. */
 try{
  if(typeof dgMyParks==="function"){
   const shared=(await dgMyParks()).filter(x=>x.role==="collaborator");
   const ownParkIds=new Set((PROJ_LIST||[]).map(x=>Number(x.park_id)).filter(Boolean));
   const ids=shared.map(x=>Number(x.id)).filter(id=>id&&!ownParkIds.has(id));
   if(ids.length){
    const{data:sp,error:es}=await sb.from("projects").select("*,parks(id,name,city,country,area_m2)").in("park_id",ids);
    for(const q of (es?[]:(sp||[]))){
     const pk=shared.find(x=>Number(x.id)===Number(q.park_id));
     q.shared=true;
     if(pk&&!q.parks)q.parks={id:pk.id,name:pk.name,city:pk.city,country:pk.country,area_m2:pk.area_m2};
     PROJ_LIST.push(q);
    }
   }
  }
 }catch(e){/* 0025 yok → eski davranış */}
 const opts=PROJ_LIST.map(p=>`<option value="${p.id}">${esc(dgProjectOptionLabel(p))}</option>`).join("");
 const empty="<option value=''>Önce park algıla → proje oluştur</option>";
 $("mProject").innerHTML=opts||empty;
 $("nProject").innerHTML=opts||empty;
 dgProjectRestore();

 const own=PROJ_LIST.filter(p=>!p.shared), shared=PROJ_LIST.filter(p=>p.shared);
 const ownCount=$("projOwnCount"), sharedCount=$("projSharedCount");
 if(ownCount)ownCount.textContent=String(own.length);
 if(sharedCount)sharedCount.textContent=String(shared.length);
 const ownList=$("projOwnList"), sharedList=$("projSharedList"), sharedSection=$("projSharedSection");
 if(ownList)ownList.innerHTML=own.length?own.map(p=>dgProjectCard(p,false)).join(""):'<div class="project-empty"><b>Henüz kendi projen yok.</b><span>Canlı Harita’dan bir park algılayıp ilk çalışma alanını oluştur.</span></div>';
 if(sharedList)sharedList.innerHTML=shared.map(p=>dgProjectCard(p,true)).join("");
 if(sharedSection)sharedSection.style.display=shared.length?"":"none";
 const compat=$("projTable");if(compat)compat.innerHTML=own.map(p=>dgProjectCard(p,false)).join("")+shared.map(p=>dgProjectCard(p,true)).join("");
 const create=$("projCreateDetails");if(create&&!EDIT_PROJ)create.open=own.length===0;
 dgRenderProjectParkBox();
 dgParkGate();
 /* Rapor paneli açıksa ve projesi listeden düştüyse paneli kapat (0009). */
 if(typeof dgUserPubSync==="function")dgUserPubSync(PROJ_LIST);
}

/* Projeler sekmesindeki "park" kutusu: hangi park algılanmış, ad nasıl olacak. */
function dgRenderProjectParkBox(){
 const box=$("projParkBox");
 if(!box)return;
 const park=EDIT_PROJ?EDIT_PROJ_PARK:DG_PARK;
 if(park&&park.name){
  box.className="alert ok";
  box.innerHTML=`<b>🌳 Algılanan park: ${esc(park.name)}</b>${park.area_m2?" · "+dgFmtHa(park.area_m2):""}${park.osm_key?` · <span class="mono" style="font-size:.72rem">${esc(park.osm_key)}</span>`:""}`+
   `<br><span style="font-size:.8rem">Proje adı otomatik "<b>${esc(park.name)}</b> - <i>etiket</i>" olacak. Aynı parkı başkaları da algıladığında veriler karşılaştırmada tek satırda birleşir.</span>`;
  /* Park başka şehirdeyse ülke/şehir varsayılanlarını parkınkiyle tazele
   * (kayıttan önce elle değiştirilebilir). */
  if(park.city&&$("pCity")&&$("pCity").value==="Ankara")$("pCity").value=park.city;
  if(park.country&&$("pCountry")&&$("pCountry").value==="Türkiye")$("pCountry").value=park.country;
 }else{
  box.className="alert err";
  box.innerHTML=`<b>⛔ Park algılanmadı — proje oluşturulamaz.</b>`+
   `<br><span style="font-size:.8rem">Önce Canlı Harita → Park Algılama ekranında parkın içine tıkla. OSM'de park yoksa "elle oluştur" ile kimlik açabilirsin.</span>`+
   `<div style="margin-top:10px"><button class="btn sm blue" onclick="startParkScan({returnTo:'projects'})">🌳 Park Algılama Ekranına Git</button></div>`;
 }
 dgProjectNamePreview();
}

function dgProjectNamePreview(){
 const el=$("pNamePreview");
 if(!el)return;
 const park=EDIT_PROJ?EDIT_PROJ_PARK:DG_PARK;
 const label=($("pLabel")?$("pLabel").value:"").trim();
 if(!park||!park.name){el.textContent="— (önce park algıla)";el.style.color="var(--mut)";return;}
 el.textContent=dgProjectName(park.name,label);
 el.style.color="var(--ink)";
}

function editProject(id){
 const p=PROJ_LIST.find(x=>x.id===id&&!x.shared);if(!p)return;
 const panel=$("projCreateDetails");if(panel)panel.open=true;
 EDIT_PROJ=id;
 EDIT_PROJ_PARK=p.park_id
  ? {id:p.park_id,name:(p.parks&&p.parks.name)||p.park_name||"",area_m2:(p.parks&&p.parks.area_m2)||null}
  : null;
 $("pLabel").value=p.label!=null?p.label:dgLabelFromLegacy(p.name,EDIT_PROJ_PARK?EDIT_PROJ_PARK.name:"");
 $("pCountry").value=p.country||"";$("pCity").value=p.city||"";
 $("projSaveBtn").textContent="💾 Projeyi Güncelle";$("projCancelBtn").style.display="inline-block";
 dgRenderProjectParkBox();
}
function cancelProjectEdit(){
 EDIT_PROJ=null;EDIT_PROJ_PARK=null;
 $("pLabel").value="";$("projSaveBtn").textContent="+ Proje Oluştur";$("projCancelBtn").style.display="none";
 const panel=$("projCreateDetails");if(panel&&(PROJ_LIST||[]).some(p=>!p.shared))panel.open=false;
 dgRenderProjectParkBox();
}
async function createProject(){
 const label=($("pLabel").value||"").trim();

 if(EDIT_PROJ){
  if(!EDIT_PROJ_PARK){
   toast("Bu proje parka bağlı değil — önce park algıla.","err","🌳");
   startParkScan({projectId:EDIT_PROJ,returnTo:"projects"});
   return;
  }
  const{error}=await sb.from("projects").update({label,park_id:EDIT_PROJ_PARK.id,country:$("pCountry").value,city:$("pCity").value}).eq("id",EDIT_PROJ);
  if(error)return toast("Hata: "+error.message,"err");
  toast("✓ Proje güncellendi","ok","📁");
  cancelProjectEdit();
 }else{
  const park=DG_PARK;
  if(!park){
   toast("Önce park algıla — park olmadan proje açılamaz.","err","🌳");
   startParkScan({returnTo:"projects"});
   return;
  }
  const{error}=await sb.from("projects").insert({
   owner:USER.id,
   park_id:park.id,
   label,
   /* DB trigger'ı aynı adı kurar; istemci de gönderir ki eski şemada da ad tutarlı kalsın. */
   name:dgProjectName(park.name,label),
   country:$("pCountry").value||park.country||"",
   city:$("pCity").value||park.city||""
  });
  if(error)return toast("Hata: "+error.message,"err");
  toast(dgCf("✓ Proje oluşturuldu: ")+dgProjectName(park.name,label),"ok","📁");
  $("pLabel").value="";
 }
 loadProjects();
}
async function deleteProject(id){
 const{count}=await sb.from("measurements").select("*",{count:"exact",head:true}).eq("project_id",id);
 if(!confirm(dgTfs("Proje silinsin mi? Bağlı {n} ölçüm ve waypoint'ler de silinebilir.\n(Park kimliği silinmez — aynı parktaki diğer projelerin karşılaştırması devam eder.)",{n:(count||0)})))return;
 await sb.from("waypoints").delete().eq("project_id",id);
 await sb.from("projects").delete().eq("id",id);
 loadProjects();
}
/* --- 6. NOKTA YÖNETİMİ --- */
let manualPoint=false;
let dgPointRequest=0;
async function autoFillPointId(){
const request=++dgPointRequest;
if(manualPoint||EDIT_ID)return;
const pid=+$("mProject").value;
if(!pid)return;
if($("mPoint").value)return;
try{
// 1) GPS açık + ziyaret edilmemiş waypoint varsa → en yakın waypoint
if(GPS){
const{data}=await sb.from("waypoints").select("*").eq("project_id",pid).eq("visited",false);
if(data&&data.length){
const nearest=data.sort((a,b)=>hav(GPS.latitude,GPS.longitude,a.lat,a.lon)-hav(GPS.latitude,GPS.longitude,b.lat,b.lon))[0];
if(request===dgPointRequest&&!manualPoint&&!EDIT_ID&&+$("mProject").value===pid&&!$("mPoint").value)$("mPoint").value=nearest.wp_id;
return;
}
}
// 2) Waypoint yoksa → projedeki son point_id + 1 (proje boşsa 1)
const{data}=await sb.from("measurements").select("point_id").eq("project_id",pid).order("point_id",{ascending:false}).limit(1);
if(request===dgPointRequest&&!manualPoint&&!EDIT_ID&&+$("mProject").value===pid&&!$("mPoint").value)$("mPoint").value=(data&&data.length)?((data[0].point_id||0)+1):1;
}catch(e){}
}

async function queryPointId(){
 const pid=+$("mProject").value,pt=+$("mPoint").value,res=$("pointQueryResult");
 if(!pid||!pt){res.style.display="none";return;}
 const{data}=await sb.from("measurements").select("*").eq("project_id",pid).eq("point_id",pt).order("created_at",{ascending:false}).limit(1);
 if(+$("mProject").value!==pid||+$("mPoint").value!==pt)return;
 if(data&&data.length>0){
  const r=data[0];
  res.style.display="block";res.className="alert info";
  const rawCirc=Number.isFinite(+r.girth_cm)&&+r.girth_cm>0?+r.girth_cm:((typeof circumferenceCmFromDiameter==="function")?circumferenceCmFromDiameter(+r.dbh_cm):null);
  res.innerHTML=`✓ <b>P${r.point_id}</b> · ${esc(_tms(r.species))} · ${_tms("Göğüs çevresi")} ${rawCirc?rawCirc.toFixed(1):"—"} cm · DBH ${(+r.dbh_cm).toFixed(1)} cm · ${_tms("Boy")} ${r.height_m} m · ${_tms("Karbon")} ${(r.carbon_kg||0).toFixed(1)} kg · ${_tms("Durum")}: <b>${r.status?_tms(r.status):_tms("Beklemede")}</b>`+
   (r.photo_url?`<br><img src="${esc(r.photo_url)}" style="width:140px;border-radius:8px;margin-top:6px">`:"")+
   `<br><button class="btn sm blue" onclick="editRec(${r.id})" style="margin-top:8px">✏️ Düzenle & Güncelle</button> <button class="btn sm red" onclick="delRec(${r.id})" style="margin-top:8px">🗑️ Tamamen Sil</button>`;
 }else{
  res.style.display="block";res.className="alert info";
  res.innerHTML=_tmsf("ℹ P{p} için kayıt yok · Yeni kayıt oluşturulacak.",{p:pt});
 }
}
/* --- 7. KAYDET (EN BÜYÜK) --- */
/* CANLI BUTON (2026-09-27 · kullanıcı isteği): 💾 Hesapla ve Kaydet, 🌿 ve 📡
 * butonlarıyla BİREBİR aynı deseni kullanır: basınca disabled + "⏳ …" +
 * soluk + wait imleci; her çıkış yolunda (başarı/hata/erken return) finally
 * ile geri gelir. Yeni tema yok — aynı aile, aynı mekanizma. */
function dgSaveBusy(on){
 const b=$("saveBtn");if(!b)return;
 if(on){dgMeasureSaving=true;b.dataset.oldText=b.innerHTML;b.innerHTML="⏳ Hesaplanıyor ve kaydediliyor…";b.disabled=true;b.style.opacity=".65";b.style.cursor="wait";}
 else{dgMeasureSaving=false;b.disabled=false;b.textContent=EDIT_ID?"💾 Kaydı Güncelle":"💾 Hesapla ve Kaydet";b.style.opacity="";b.style.cursor="";if(typeof dgParkGate==="function")dgParkGate();}
}
let dgMeasureSaving=false;
async function saveMeas(){
 if(dgMeasureSaving)return;
 dgSaveBusy(true);
 try{return await dgSaveMeasInner();}
 catch(err){toast(_tms("Kayıt tamamlanamadı. Bilgileriniz formda duruyor; yeniden deneyin."),"err");}
 finally{dgSaveBusy(false);}
}
async function dgSaveMeasInner(){
    const pid=+$("mProject").value,pt=+$("mPoint").value,sp=$("mSpecies").value,circumference=+$("mDbh").value,h=+$("mHeight").value,grp=$("mGroup").value;
    for(const id of ["mProject","mPoint","mNo","mGroup","mSpecies","mDbh","mHeight"])$(id).setAttribute("aria-invalid","false");
    if(!pid)return dgMeasureInvalid("mProject",_tms("Bir çalışma projesi seçin."));
    if(!Number.isSafeInteger(pt)||pt<=0)return dgMeasureInvalid("mPoint",_tms("Nokta ID pozitif bir tam sayı olmalı."));
    const measurementNo=+$("mNo").value;
    if(!Number.isSafeInteger(measurementNo)||measurementNo<=0)return dgMeasureInvalid("mNo",_tms("Ölçüm No pozitif bir tam sayı olmalı."));
    if(!grp)return dgMeasureInvalid("mGroup",_tms("Ağaç grubunu seçin."));
    if(typeof MEASUREMENT_GROUPS==="undefined"||!MEASUREMENT_GROUPS.includes(grp))
      return dgMeasureInvalid("mGroup",_tms("Ölçüm yalnız İBRELİ veya YAPRAKLI grubunda yapılabilir."));
    if(!sp)return dgMeasureInvalid("mSpecies",_tms("Ağaç türünü seçin."));
    if(typeof densityKgFor!=="function"||!(densityKgFor(sp,grp)>0))
      return dgMeasureInvalid("mSpecies",_tms("Tür/grup eşleşmesi kilitli yoğunluk tablosuna uygun değil."));
    if(!Number.isFinite(circumference)||typeof circumferenceIsValid!=="function"||!circumferenceIsValid(circumference))
      return dgMeasureInvalid("mDbh",_tms("Göğüs çevresi 0’dan büyük olmalı ve çevre/π ile bulunan DBH en fazla 400 cm olabilir."));
    if(!Number.isFinite(h)||h<=0||h>100)return dgMeasureInvalid("mHeight",_tms("Boy 0’dan büyük, en fazla 100 m olmalı."));

    /* ⛔ PARK KAPISI: park algılanmamış projeye ölçüm girilemez. Düzenleme
     * (EDIT_ID) mevcut kaydı günceller, yeni ölçüm değildir → kapı uygulanmaz.
     * Aynı kural sunucuda trg_enforce_park_link ile de zorlanır (PARK_REQUIRED). */
    const gateProj=(PROJ_LIST||[]).find(p=>p.id===pid);
    if(DG_PARK_SCHEMA_OK&&!EDIT_ID&&(!gateProj||!gateProj.park_id)){
        toast("⛔ Bu projede park algılanmadı — ölçüm giremezsin. Park algılama ekranına yönlendiriliyorsun.","err","🌳");
        startParkScan({projectId:pid||null,returnTo:"measure"});
        return;
    }
    if(!EDIT_ID&&!GPS)return toast("Önce 📡 Konumu Etkinleştir butonuna basın","err");

    
    const f=$("mPhoto").files[0];
    if(f&&!photoOk)return toast("Fotoğraf denetimi başarısız — uygun bir çekim yapın","err");
    dgProjectRemember(pid);
    
    const wasEdit=!!EDIT_ID;
    const c=calcFromCircumference(circumference,h,sp,grp);
    if(!c.valid)return dgMeasureInvalid("mSpecies",_tms("Kilitli yoğunluk tablosu bu ölçüm için karbon hesabına izin vermiyor."));
    
    // 1. Fotoğrafı sıkıştır (henüz upload etme, sadece Blob olarak hazırla)
    let photoBlob = null;
    let photoFile = null;
    if(f){
        photoBlob = await compress(f);
        photoFile = "P"+String(pt).padStart(3,"0")+"_M"+measurementNo+".JPG";
    }
    
    // 2. base objesini oluştur
    const base={
        owner:USER.id,
        project_id:pid,
        /* Denormalize park kimliği: v_park_compare hem bunu hem projects.park_id'i
         * okur; dışa aktarımda park alanı/kimliği satır düzeyinde taşınır.
         * Şema eskiyse sütun hiç gönderilmez (yoksa insert 42703 ile patlar). */
        point_id:pt,
        measurement_no:measurementNo,
        grp,species:sp,
        girth_cm:circumference,
        dbh_cm:c.dbh_cm,
        height_m:h,
        volume_m3:c.vol,
        carbon_kg:c.total_carbon,
        slope_deg:0,
        shared:true,
        status:"Beklemede"
    };
    if(DG_PARK_SCHEMA_OK)base.park_id=(gateProj&&gateProj.park_id)||null;

    // 5. Supabase insert/update
// ⭐ EKLENEN: Her insert'te client_id ekle (duplicate koruması)
if (!base.client_id) base.client_id = uuidv4();
    if(!EDIT_ID){
        base.lat=GPS.latitude;
        base.lon=GPS.longitude;
        base.accuracy_m=GPS.accuracy;
        base.altitude_m=GPS.altitude;
        const geo=await reverseGeocode(GPS.latitude,GPS.longitude);
        base.country=geo?geo.country:"Bilinmiyor";
        base.city=geo?geo.city:"Bilinmiyor";
        if(geo)toast(dgCf("📍 Konum algılandı: ")+esc(geo.city)+" / "+esc(geo.country),"info","🗺️");
    }

    /* 🛰 KONUM DOĞRULAMASI (0007 · kullanıcı isteği 2026-09-26): yeni ölçüm ve
     * fotoğraf, projenin parkının DIŞINDAN girilemez. Taze GPS fix'i alınır,
     * park poligonu (yoksa alan-yarıçaplı daire) ile karşılaştırılır; eşik
     * dışındaysa yükleme HİÇ BAŞLAMAZ (fotoğraf sunucuya gitmez).
     * Sunucu garantisi: trg_geo_fence (0007) — istemci atlatılsa bile park
     * dışı INSERT/UPDATE reddedilir. Düzenleme (EDIT_ID) mevcut kaydı
     * günceller → sahada olmayı gerektirmez. */
    if(!EDIT_ID&&gateProj&&gateProj.park_id&&typeof dgVerifyAtPark==="function"){
      const pk=await sb.from("parks").select("*").eq("id",gateProj.park_id).maybeSingle();
      if(pk.data){
        const dec=await dgVerifyAtPark(pk.data,"measure");
        if(!dec.ok)return toast("⛔ "+esc(dec.message||_tmsf("Konum doğrulanamadı ({r})",{r:dec.reason})),"err","🛰");
        dgGeoStamp(base,dec);
        if(dec.verified)toast(dgCf("🛰 Konum doğrulandı: ")+esc(pk.data.name)+
          (dec.reason==="margin"?" ("+_tms("kenar payı")+")":"")+" · ±"+Math.round(dec.fix.acc)+" m","ok","🛰");
      }
    }
    
     // 3. OFFLINE KONTROLÜ (Fotoğraf ve veriyi IndexedDB'ye kaydet)
    if(!navigator.onLine){
        if(photoBlob) base.photoBlob = photoBlob;
        if(photoFile) base.photo_file = photoFile;
        base.client_id = uuidv4(); // Benzersiz ID (duplicate önleme)
if(EDIT_ID) base._editId = EDIT_ID; // ✅ çevrimdışı düzenleme işareti
        
        await saveOfflineMeasurement(base);
        toast('Çevrimdışı kaydedildi — internet gelince senkronize','info','📴');
        if(typeof dgPresenceAct==="function"){try{dgPresenceAct(wasEdit?"edit":"save","P"+String(pt).padStart(3,"0"));}catch(e){}}
        
        // ✅ Background Sync register KALDIRILDI (artık ana thread yönetiyor)
        
        if(wasEdit)cancelEdit();
        dgResetMeasureFields();
        if(!wasEdit)autoFillPointId();
        loadDash();
        loadRecords();
        return;
    }
    
    // 4. ONLINE: Fotoğrafı Supabase Storage'a yükle
    let photoUrl = null;
    if(photoBlob){
        const path = USER.id+"/"+Date.now()+".jpg";
        const {error} = await sb.storage.from("dendro-photos").upload(path, photoBlob, {contentType:"image/jpeg"});
        if(error)throw error;
        if(!error){
            photoUrl = sb.storage.from("dendro-photos").getPublicUrl(path).data.publicUrl;
        }
    }
    if(photoUrl){
        base.photo_url = photoUrl;
        base.photo_file = photoFile;
    }
    
    // 5. Supabase insert/update
    if(EDIT_ID){
        const{error}=await sb.from("measurements").update(base).eq("id",EDIT_ID);
        if(error)return toast("Hata: "+error.message,"err");
        toast("Kayıt güncellendi — onaya gönderildi","ok","✓");
        cancelEdit();
    }else{
        let{error}=await sb.from("measurements").insert(base);
        if(error){delete base.altitude_m;delete base.photo_file;({error}=await sb.from("measurements").insert(base));}
        if(error)return toast("Hata: "+error.message,"err");
        toast("Kaydedildi — "+c.total_carbon.toFixed(1)+" kg karbon","ok","🌱");
      if(typeof dgPresenceAct==="function"){try{dgPresenceAct(wasEdit?"edit":"save","P"+String(pt).padStart(3,"0"));}catch(e){}}
    }
    
    dgResetMeasureFields();
    loadDash();
    loadRecords();
    loadWaypoints();
    if(!wasEdit)autoFillPointId();
}

/* --- 8. DÜZENLEME --- */
function cancelEdit(){EDIT_ID=null;manualPoint=false;$("editBanner").style.display="none";$("saveBtn").textContent="💾 Hesapla ve Kaydet";dgParkGate();}
async function editRec(id){
 const{data}=await sb.from("measurements").select("*").eq("id",id).single();
 if(!data)return;
 dgClearMeasurePhoto();
 EDIT_ID=id;
 $("mProject").value=data.project_id;
 $("mPoint").value=data.point_id;$("mNo").value=data.measurement_no||1;
 $("mGroup").value=data.grp||"";fillSpecies();$("mSpecies").value=data.species;showLatin();
 $("mDbh").value=(data.girth_cm!=null?data.girth_cm:((typeof circumferenceCmFromDiameter==="function")?circumferenceCmFromDiameter(data.dbh_cm):data.dbh_cm));$("mHeight").value=data.height_m;
 $("editBanner").style.display="block";$("saveBtn").textContent="💾 Kaydı Güncelle";
 liveCalc();go("measure");dgProjectChanged();
}
/* --- 9. FOTOĞRAF İŞLEME --- */
async function compress(f){
 const{i,u}=await loadImg(f);
 try{
  const m=1024,sc=Math.min(1,m/Math.max(i.width,i.height)),c=document.createElement("canvas");
  c.width=i.width*sc;c.height=i.height*sc;c.getContext("2d").drawImage(i,0,0,c.width,c.height);
  return await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("image compression")),"image/jpeg",.7));
 }finally{URL.revokeObjectURL(u);}
}
async function removePhoto(url){
 if(!url)return;
 try{
  let p=url.split("/dendro-photos/")[1];
  if(p){await sb.storage.from("dendro-photos").remove([p]);}
 }catch(e){}
 try{
  const p2=decodeURIComponent(url.split("/dendro-photos/")[1]||"");
  if(p2)await sb.storage.from("dendro-photos").remove([p2]);
 }catch(e){}
}

/* 0035b: dil değişince tür listesi yeniden doldurulur (görünen adlar çevrilir,
 * value'lar kanonik TR kalır). */
window.addEventListener("dg:lang",()=>{try{const g=$("mGroup");if(g&&g.value&&$("mSpecies")){const sp=$("mSpecies").value;fillSpecies();$("mSpecies").value=sp;showLatin();}if(typeof liveCalc==="function")liveCalc();}catch(e){}});
