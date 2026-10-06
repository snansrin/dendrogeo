"use strict";
/* 0037: i18n güvenlikli yerel yardımcılar (harness'ler constants yüklemeyebilir). */
const _tmf=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tmff=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\{(\w+)\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));
/* ===== DendroGeo v2 · src/services/map.js =====
Harita init, marker yönetimi, waypoint CRUD, navigasyon çizimi */

/* KOORDİNAT DOĞRULAMASI (2026-09-26).
 *
 * ESKİ KOD:  rows=(data||[]).filter(r=>Number.isFinite(+r.lat)&&Number.isFinite(+r.lon));
 * Tuzak: +null === 0 ve +"" === 0, Number.isFinite(0) ise TRUE. Yani lat/lon'u
 * NULL ya da boş string gelen bir kayıt "geçerli" sayılıp (0,0) noktasına —
 * Gine Körfezi'ndeki meşhur "Null Island"a — çiziliyor, üstelik küme
 * rozetine ve renderAnalysis yüzdelerine gerçek bir ağaç gibi giriyordu.
 * (Test bu davranışı yakaladı: 2 geçerli + 2 bozuk satır → 3 işaretçi.)
 * Artık boş değer reddedilir ve küresel sınır kontrolü yapılır. Tam (0,0)
 * da reddedilir: gerçek bir envanter noktası olması fiilen imkânsız. */
function dgValidCoord(lat,lon){
 if(lat===null||lat===undefined||lat==="")return false;
 if(lon===null||lon===undefined||lon==="")return false;
 const a=Number(lat),o=Number(lon);
 if(!Number.isFinite(a)||!Number.isFinite(o))return false;
 if(a<-90||a>90||o<-180||o>180)return false;
 return !(a===0&&o===0);
}

// 1. Marker HTML üretici
function popupHtml(r){
 /* 0035b: balon etiketleri dgT() ile çevrilir (EN modu). Tür adı da sözlükte
  * (tam eşleşme) — balon her açılışta yeniden kurulduğu için dil anında yansır. */
 const _t=(s)=>(typeof dgT==="function"?dgT(s):s);
 return `<div style="min-width:140px"><b>P${r.point_id}</b> · ${esc(_t(r.species))}<br><span style="font-size:.75rem;color:#5f6d65">DBH: ${Number.isFinite(+r.dbh_cm)?(+r.dbh_cm).toFixed(1):"—"} cm · ${_t("Boy")}: ${r.height_m||"—"} m<br>${_t("Karbon")}: ${(r.carbon_kg||0).toFixed(1)} kg</span>`+(r.photo_url?`<br><img src="${esc(r.photo_url)}" style="width:160px;border-radius:8px;margin-top:6px">`:"")+`</div>`;
}
// 2. Marker yükleme (chunked)
/* İDEMPOTENT (2026-09-26 · canlı tarayıcıda ölçüldü): küme zaten varsa ÖNCE
 * clearLayers() çağrılır.
 *
 * ESKİ DAVRANIŞ (hata): loadWorld() hem startShell'de hem her approveMeas'ta
 * hem park-registry'den çalışıyor; loadLiveMap() da sekme her açıldığında
 * çağrılabiliyordu. addMarkersChunked küme varsa YENİDEN EKLEDİĞİ için aynı
 * 12 kayıt kümeye 2., 3. kez biniyordu. Ölçüm (gerçek Chrome, canlı site):
 *   1. loadWorld → cluster 12 işaretçi, rozet "12"
 *   2. loadWorld → cluster 24 işaretçi, rozet "24"   ← yanlış sayı
 *   3. onay başına +12 …
 * Belirti kullanıcıya iki şekilde dönüyordu: "onayladığım kayıt haritada yok"
 * (rozet/istatistik tutarsız) ve tür-karbon analizinin iki kez sayılması.
 *
 * TOKEN: chunk'lar setTimeout(step,16) ile parça parça eklendiği için iki
 * yükleme çakışırsa ESKİ turun kalan chunk'ları clearLayers()'dan SONRA da
 * eklenmeye devam ederdi. Her yükleme m._markerToken'ı artırır; bayat tur
 * ilk adımında kendini iptal eder. */
function addMarkersChunked(m,rows,chunk=150){
 let i=0;
 if(!m._cluster){
  /* YEDEK KATMAN (2026-09-26 · kullanıcı bildirimi: "listede var, haritada yok").
   * vendor/leaflet.markercluster-1.5.3.js HERHANGİ bir nedenle yüklenemezse
   * (ağ filtresi/ reklam-engelleyici kuralı, önbellekte 404 gövdesi, SW'de
   * bayat karma) L.markerClusterGroup TANIMSIZ kalıyordu. Eski kod o anda
   * fırlatıyor, loadApprovedMarkers hatayı yutup "✓ 0 kayıt" basıyor ve
   * KULLANICI LİSTELERİ DOLUYKEN BOŞ HARİTA görüyordu.
   * Artık eklenti yoksa DÜZ L.layerGroup()'a düşülür: kümeleme olmaz ama
   * noktalar TEK TEK çizilir — veri asla görünmez kalmaz. Bayrak, kullanıcıya
   * amber bir not göstermek için kullanılır. */
  if(typeof L.markerClusterGroup==="function"){
   m._cluster=L.markerClusterGroup({
    maxClusterRadius:80,
    spiderfyOnMaxZoom:true,
    showCoverageOnHover:false,
    disableClusteringAtZoom:15,
    iconCreateFunction:c=>{
     const n=c.getChildCount();
     const cls=n<10?"small":n<50?"medium":"large";
     return L.divIcon({html:`<div>${n}</div>`,className:`marker-cluster marker-cluster-${cls}`,iconSize:[40,40]});
    }
   });
   m._clusterDegraded=false;
  }else{
   console.warn("DENDROGEO · markercluster eklentisi yok → noktalar kümelenmeden çiziliyor");
   m._cluster=L.layerGroup();
   m._clusterDegraded=true;
  }
  m.addLayer(m._cluster);
 }else{
  m._cluster.clearLayers();
 }
 const token=m._markerToken=(m._markerToken||0)+1;
 (function step(){
  if(token!==m._markerToken)return;   /* bayat tur: daha yeni bir yükleme başladı */
  const end=Math.min(i+chunk,rows.length);
  for(;i<end;i++){
   const r=rows[i];
   const mk=L.marker([r.lat,r.lon],{
    icon:L.divIcon({
     className:'tree-marker',
     html:`<div style="width:14px;height:14px;border-radius:50%;background:#1e6f4b;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
     iconSize:[18,18],
     iconAnchor:[9,9]
    })
   });
   mk.bindPopup(popupHtml(r));
   m._cluster.addLayer(mk);
  }
  if(i<rows.length)setTimeout(step,16);
 })();
}
// 3. Onaylı marker'ları getir
/* HATA ARTIK SESSİZ DEĞİL (2026-09-26).
 *
 * ESKİ KOD:  const{data,count}=await sb.from(...)...   ← error YOKSAYILIYORDU
 *            ...
 *            }catch(e){done&&done(0,[]);}
 *
 * İki ayrı yol "boş harita"yı BAŞARI gibi gösteriyordu:
 *   1) Sorgu error dönerse (RLS/42501, PostgREST şema önbelleği, JWT
 *      tazelenirken 401, ağ kopması) data=null → rows=[] → done(0,[]) →
 *      ekranda YEŞİL "✓ 0 onaylı kayıt yüklendi" kutusu.
 *   2) addMarkersChunked fırlatırsa (ör. markercluster eklentisi yüklenmedi)
 *      catch yutuyor → yine done(0,[]) → yine sahte yeşil.
 * Kullanıcı "verim silindi mi?" diye bunu bildirdi; oysa veri veritabanında
 * duruyordu. Artık done(n,rows,err) hata metnini 3. argümanla taşır ve
 * başarısızlıkta n=-1 olur; çağıranlar kırmızı kutu + ↻ düğmesi gösterir.
 *
 * İMZA GERİYE UYUMLU: err argümanını okumayan eski çağıranlar çalışmaya
 * devam eder (n=-1'i 0 gibi görürler); ama repo içindeki üç çağıran da
 * (loadLiveMap, loadWorld, initLanding) güncellendi. */
async function loadApprovedMarkers(m,limit,done){
 if(!m){done&&done(-1,[],"Harita henüz kurulmadı (initMaps çağrılmadı)");return;}
 try{
  const{data,count,error}=await sb.from("measurements")
   .select("lat,lon,point_id,species,dbh_cm,height_m,carbon_kg,photo_url,grp",{count:"exact"})
   .eq("status","Onaylı").limit(limit);
  if(error)throw new Error((error.code?error.code+": ":"")+error.message);
  /* Limit aşımında UYAR: işaretçiler ve bu satırlardan hesaplanan toplam karbon
   * kesilmiş kümeye dayanır. Bkz. src/utils/truncation.js */
  dgWarnIfTruncated(data,limit,"Canlı harita",count);
  const rows=(data||[]).filter(r=>dgValidCoord(r.lat,r.lon));
  addMarkersChunked(m,rows);
  done&&done(rows.length,rows,null);
 }catch(e){
  const msg=(e&&(e.message||e))+"";
  console.error("DENDROGEO · onaylı işaretçiler yüklenemedi:",msg);
  done&&done(-1,[],msg);
 }
}
// 4. Canlı harita
/* İDEMPOTENT + TAZELENEBİLİR (2026-09-26).
 *
 * BİLDİRİLEN HATA: "son yüklenen veriyi onaylamama rağmen canlı haritada
 * göremiyorum." Kök neden burası değil, ui/shell.js'teki kapıydı:
 *   if(!liveLoaded){liveLoaded=true;loadLiveMap();}
 * Yani Canlı Harita sekmesi bir oturumda YALNIZ BİR KEZ yükleniyordu;
 * approveMeas() loadWorld()'ü tazelese de canlı haritayı tazelemiyordu.
 * Kullanıcı onaydan sonra sekmeye dönünce ESKİ işaretçi kümesini görüyor,
 * F5 atmadan yenisini göremiyordu.
 *
 * ÇÖZÜM: liveLoaded + DG_LIVE_DIRTY. Onay/red/silme ve çevrimdışı
 * senkronizasyon dgMarkLiveDirty() çağırır; go("map") bayrağı görünce
 * yeniden çeker. Elle tazelemek için karta ↻ düğmesi kondu (partials/shell.html). */
async function loadLiveMap(){
 const el=$("mapLoad");
 if(el){el.style.display="";el.className="alert info";el.textContent="⏳ Onaylı kayıtlar yükleniyor…";}
 await loadApprovedMarkers(map,3000,(n,rows,err)=>{
  dgMarkLiveLoaded(!err);
  if(!el)return;
  if(err){
   el.style.display="";
   el.className="alert err";
   el.innerHTML=`<b>⚠ Onaylı kayıtlar yüklenemedi</b> — harita bu yüzden boş. Veri silinmedi: `+
    `<span class="mono" style="font-size:.74rem">${esc(err)}</span> `+
    `<button class="btn sm" style="margin-left:6px" onclick="loadLiveMap()">↻ Yeniden dene</button>`;
   return;
  }
  /* Kümeleme eklentisi yüklenemediyse kullanıcıya SÖYLE (sessiz kalite kaybı
   * olmasın): noktalar tek tek çizilir, balon yerine nokta görür. */
  const deg=map&&map._clusterDegraded;
  el.className=deg?"alert warn":"alert ok";
  /* 0035c: durum satırı dgTf şablonuyla çevrilir (EN modunda Türkçe kalmaz). */
  const _tf=(typeof dgTf==="function"?dgTf:(_t,v)=>_t.replace(/\{(\w+)\}/g,(m,k)=>v[k]));
  el.textContent=_tf(deg?"⚠ {n} onaylı kayıt yüklendi · {t} · kümeleme eklentisi yüklenemedi, noktalar tek tek çizildi.":"✓ {n} onaylı kayıt yüklendi · {t} · noktaya dokun → bilgi + fotoğraf.",{n:n,t:new Date().toLocaleTimeString("tr-TR")});
  setTimeout(()=>el.style.display="none",6000);
  renderAnalysis(rows,"liveAnalysis");
 });
}
/* liveLoaded/DG_LIVE_DIRTY ui/state.js'te (body sonunda) bildiriliyor; bu
 * fonksiyon yalnız ÇAĞRI ANINDA dokunduğu için yükleme sırası sorun değil.
 * try/catch: harness/birim testlerde state.js yüklenmeyebilir. */
function dgMarkLiveLoaded(ok){
 try{liveLoaded=true;DG_LIVE_DIRTY=false;}catch(e){}
}
function dgMarkLiveDirty(){
 try{DG_LIVE_DIRTY=true;}catch(e){}
}
// 5. Harita başlatma
function initMaps(){
 /* ODbL: her OSM karosu katmanında attribution zorunlu (eski hâlde yoktu). */
 if(!map){map=L.map("map").setView([39.99,32.65],12);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:DG_ATTR.osm,maxZoom:19}).addTo(map);}
 if(!navMap){navMap=L.map("navMap").setView([39.992,32.6498],15);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:DG_ATTR.osm,maxZoom:19}).addTo(navMap);}
 if(!worldMap){worldMap=L.map("worldMap").setView([39,35],3);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:DG_ATTR.osm,maxZoom:19}).addTo(worldMap);}
}
// 6. Waypoint CRUD
async function uploadWpCsv(){
 const pid=+$("nProject").value;if(!pid)return toast("Proje seç");
 const f=$("nCsv").files[0];if(!f)return toast("CSV seç");
 let n=0,invalid=0;
 try{
  const lines=(await f.text()).replace(/^\uFEFF/,"").split(/\r?\n/);
  for(let i=1;i<lines.length;i++){
   if(!lines[i].trim())continue;
   const c=lines[i].split(",").map(v=>v.trim().replace(/^"|"$/g,""));
   const lon=Number(c[0]),lat=Number(c[1]),id=Number(c[2]);
   if(c.length<3||!c[0]||!c[1]||!Number.isInteger(id)||id<=0||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){invalid++;continue;}
   const{error}=await sb.from("waypoints").upsert({owner:USER.id,project_id:pid,wp_id:id,lat,lon},{onConflict:"project_id,wp_id"});
   if(error)throw error;
   n++;
  }
  toast("✓ "+n+" waypoint kaydedildi."+(invalid?" "+invalid+" geçersiz satır atlandı.":""),invalid?"warn":"ok");
 }catch(e){toast(dgCf("Waypoint yükleme hatası:")+" "+e.message+" · "+n+" satır kaydedildi.","err");}
 await loadWaypoints();
}
/* 0040: kaydırma koruma sarmalı — yeniden çizimde #main scrollTop korunur. */
async function loadWaypoints(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return await loadWaypoints__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
async function loadWaypoints__scroll(){
 const pid=+$("nProject").value;
 const previousTarget=navTarget;
 WP=[];navTarget=null;drawNav();
 if(!pid){renderWaypointList();return;}
 try{
  const{data,error}=await sb.from("waypoints").select("*").eq("project_id",pid).order("wp_id",{ascending:true});
  if(+$("nProject").value!==pid)return;
  if(error)throw error;
  WP=data||[];
  navTarget=WP.find(w=>w.id===previousTarget?.id&&!w.visited)||null;
  drawNav();
 }catch(e){toast(dgCf("Waypoint listesi alınamadı:")+" "+e.message,"err");}
}
let DG_WP_PAGE=0,DG_WP_QUERY="";
const DG_WP_PAGE_SIZE=8;
function dgWaypointPage(delta){DG_WP_PAGE+=delta;renderWaypointList();}
function renderWaypointList(){
 const done=WP.filter(w=>w.visited).length;
 $("dWp").textContent=WP.length;$("dVisit").textContent=done;
 $("navInfo").textContent=WP.length+" nokta · "+(WP.length-done)+" bekleyen · "+done+" tamamlanan. Liste projeye kalıcı kaydedilir.";
 const query=($("wpSearch")?.value||"").trim().toLowerCase().replace(/^p/,"");
 const filter=$("wpFilter")?.value||"all";
 const rows=WP.filter(w=>String(w.wp_id).includes(query)&&(filter==="all"||(filter==="done"?w.visited:!w.visited)));
 if($("wpSort")?.value==="distance"&&GPS)rows.sort((a,b)=>hav(GPS.latitude,GPS.longitude,a.lat,a.lon)-hav(GPS.latitude,GPS.longitude,b.lat,b.lon)||a.wp_id-b.wp_id);
 else rows.sort((a,b)=>a.wp_id-b.wp_id);
 const signature=String($("nProject").value)+":"+query+":"+filter+":"+($("wpSort")?.value||"id");if(signature!==DG_WP_QUERY){DG_WP_PAGE=0;DG_WP_QUERY=signature;}
 const pages=Math.max(1,Math.ceil(rows.length/DG_WP_PAGE_SIZE));DG_WP_PAGE=Math.max(0,Math.min(pages-1,DG_WP_PAGE));
 const visible=rows.slice(DG_WP_PAGE*DG_WP_PAGE_SIZE,(DG_WP_PAGE+1)*DG_WP_PAGE_SIZE);
 const pager=$("wpPager");if(pager)pager.innerHTML=`<button class="btn sm ghost" onclick="dgWaypointPage(-1)" ${DG_WP_PAGE===0?"disabled":""}>←</button><span>${rows.length?DG_WP_PAGE*DG_WP_PAGE_SIZE+1:0}–${Math.min(rows.length,(DG_WP_PAGE+1)*DG_WP_PAGE_SIZE)} / ${rows.length}</span><button class="btn sm ghost" onclick="dgWaypointPage(1)" ${DG_WP_PAGE===pages-1?"disabled":""}>→</button>`;
 const openCoordinates=new Set(Array.from($("wpListTable").querySelectorAll?.("details[open]")||[],el=>el.getAttribute("data-wp-id")));
 $("wpListTable").innerHTML=rows.length?visible.map(w=>`<li class="waypoint-point ${w.visited?'done':''}"${navTarget?.id===w.id?' aria-current="true"':''}><details class="waypoint-coordinates" data-wp-id="${Number(w.id)}"${openCoordinates.has(String(w.id))?" open":""}><summary aria-label="P${Number(w.wp_id)} ${dgCf("Koordinatlar")}"><b>P${Number(w.wp_id)}</b><span class="mono waypoint-distance">${GPS?Math.round(hav(GPS.latitude,GPS.longitude,w.lat,w.lon))+" m":"—"}</span><span aria-hidden="true">⌄</span></summary><div><span data-label="Enlem">${dgCf("Enlem")}: ${Number(w.lat).toFixed(6)}</span><span data-label="Boylam">${dgCf("Boylam")}: ${Number(w.lon).toFixed(6)}</span></div></details><div class="waypoint-point-actions"><span>${w.visited?'<span class="badge on">✓ Yapıldı</span>':'<span class="badge admin">Bekliyor</span>'}</span><div data-label="İşlem">${w.visited?'':`<button class="btn sm blue" onclick="selectWaypoint(${Number(w.id)})">🎯 Hedef</button>`}</div></div></li>`).join(""):'<li class="waypoint-empty">'+(WP.length?"Aramaya uygun nokta yok.":(+$("nProject").value?"Bu projede waypoint yok. CSV yükleyin.":"Önce proje seçin."))+"</li>";
}

async function deleteAllWaypoints(){
 const pid=+$("nProject").value;
 if(!pid)return toast("Proje seç");
 if(!confirm(dgCf("⚠ Bu projedeki TÜM waypoint'ler kalıcı olarak silinsin mi? Yanlış liste ise sonra yeniden yükleyebilirsiniz.")))return;
 const{error}=await sb.from("waypoints").delete().eq("project_id",pid);
 if(error)return toast("Hata: "+error.message,"err");
 navTarget=null;WP=[];
 toast("✓ Liste tamamen silindi. Yeni CSV yükleyebilirsiniz.");
 loadWaypoints();
}
async function selectWaypoint(id){
 const w=WP.find(x=>x.id===id);if(!w)return;
 navTarget=w;
 if(!manualPoint)$("mPoint").value=w.wp_id;
 drawNav();
 dgFocusWaypoint();
}
// Navigation actions select targets only; arrival retains the existing visit/save flow.
function dgNearestWaypoint(){
 if(!GPS){toast(dgCf("En yakın noktayı seçmek için önce konumu etkinleştirin."),"warn");go("measure");return;}
 const pending=WP.filter(w=>!w.visited);
 if(!pending.length)return toast(dgCf("Bekleyen waypoint kalmadı."),"info");
 const nearest=pending.reduce((a,b)=>hav(GPS.latitude,GPS.longitude,a.lat,a.lon)<=hav(GPS.latitude,GPS.longitude,b.lat,b.lon)?a:b);
 selectWaypoint(nearest.id);
}
function dgNextWaypoint(){
 const pending=WP.filter(w=>!w.visited).sort((a,b)=>a.wp_id-b.wp_id);
 if(!pending.length)return toast(dgCf("Bekleyen waypoint kalmadı."),"info");
 const next=pending.find(w=>w.wp_id>(navTarget?.wp_id??-Infinity))||pending[0];
 selectWaypoint(next.id);
}
function dgFocusWaypoint(showMap=false){
 if(showMap){const p=$("wpMapPanel");if(p)p.open=true;if(navMap?.invalidateSize)navMap.invalidateSize();}
 if(!navTarget||!navMap)return;
 const target=[navTarget.lat,navTarget.lon];
 if(GPS)navMap.fitBounds([[GPS.latitude,GPS.longitude],target],{padding:[36,36],maxZoom:18});
 else navMap.setView(target,18);
}
function dgFitWaypoints(){
 if(!navMap||!WP.length)return;
 const points=WP.map(w=>[w.lat,w.lon]);
 if(GPS)points.push([GPS.latitude,GPS.longitude]);
 navMap.fitBounds(points,{padding:[36,36],maxZoom:18});
}
function dgWaypointGuidance(){
 const el=$("navGuidance");if(!el)return;
 if(!navTarget||navTarget.visited){el.textContent=dgCf("Hedef seçerek navigasyona başlayın.");return;}
 if(!GPS){el.textContent=dgCf("Hedef seçildi. Mesafe ve yön için konumu etkinleştirin.");return;}
 const distance=hav(GPS.latitude,GPS.longitude,navTarget.lat,navTarget.lon);
 el.textContent=distance<=GPS.accuracy?dgCf("Hedef GPS belirsizlik alanında. Noktayı sahada doğrulayın."):distance<=50?dgCf("Hedefe yaklaştınız. Noktayı doğrulayıp Vardım düğmesine basın."):dgCf("Kesikli çizgi hedefe kuş uçuşu yönü gösterir; yürüyüş rotası değildir.");
}
// 7. Navigasyon çizimi
/* "🎯 Vardım → Ölçüme Geç" butonu (index.html:563) daha önce TANIMSIZ bir
 * fonksiyon çağırıyordu (arriveWp hiç yazılmamıştı → ölü buton).
 * Akış: aktif hedefi (yoksa GPS'e en yakın ziyaret edilmemiş WP) bul,
 * uzaklık 50 m'den fazlaysa onay sor, DB'de visited işaretle, ölçüm
 * formuna point id'yi yaz ve ölçüm sekmesine geç. */
async function arriveWp(){
  let w=navTarget;
  if(!w||w.visited){
    const ts=WP.filter(x=>!x.visited);
    if(ts.length&&GPS){
      w=ts.sort((a,b)=>
        hav(GPS.latitude,GPS.longitude,a.lat,a.lon)-
        hav(GPS.latitude,GPS.longitude,b.lat,b.lon))[0];
    }
  }
  if(!w)return toast("Aktif waypoint yok","warn","🎯");
  if(GPS){
    const d=hav(GPS.latitude,GPS.longitude,w.lat,w.lon);
    if(d>50&&!confirm(dgTfs("Hedeften {d} m uzaktasın.\nYine de 'vardım' işaretlensin mi?",{d:d.toFixed(0)})))return;
  }
  const{error}=await sb.from("waypoints").update({visited:true}).eq("id",w.id);
  if(error)return toast("Hata: "+error.message,"err","🎯");
  w.visited=true;
  navTarget=null;
  if(!manualPoint)$("mPoint").value=w.wp_id;
  drawNav();
  loadWaypoints();
  /* Waypoint hangi projeye bağlıysa ölçüm formu da o projeye geçsin: park
   * kapısı (dgParkGate) doğru projeyi değerlendirsin. go("measure") kapıyı
   * zaten tazeliyor. (2026-09-24) */
  if(w.project_id&&$("mProject"))$("mProject").value=String(w.project_id);
  toast(dgTfs("✓ Vardın: P{id} → ölçüme geç",{id:w.wp_id}),"ok","🎯");
  go("measure");
}
window.arriveWp=arriveWp;

function drawNav(){
 if(!GPS){
  $("navDist").textContent="—";
  $("navTarget").textContent=navTarget?"Hedef: P"+navTarget.wp_id:"Listeden veya haritadan hedef seçin.";
  $("navArrow").style.transform="rotate(0)";
 }
 if($("navGps"))$("navGps").textContent=GPS?"GPS doğruluğu: "+(Number.isFinite(GPS.accuracy)?"±"+Math.round(GPS.accuracy)+" m":"bilinmiyor"):"GPS konumu bekleniyor; hedef seçebilirsiniz.";
 renderWaypointList();
 dgWaypointGuidance();
 if(!navMap)return;
 navMap.eachLayer(l=>{if(l._wp)navMap.removeLayer(l);});
 WP.forEach(w=>{
  const done=w.visited;
  const icon=L.divIcon({
   className:"",
   html:`<div class="wp-badge2 ${done?"done":""}" style="--wpbg:${done?"#16a34a":"#e11d48"}"><span>${w.wp_id}</span></div>`,
   iconSize:[28,28],iconAnchor:[14,24]
  });
  const m=L.marker([w.lat,w.lon],{icon}).addTo(navMap);m._wp=1;
  const _tm=(s)=>(typeof dgCf==="function"?dgCf(s):s);m.bindPopup(done?"<s>P"+w.wp_id+"</s> "+_tm("✓ Yapıldı"):"P"+w.wp_id+" · "+_tm("Hedef yapmak için tıkla"));
  m.on("click",()=>{selectWaypoint(w.id);});
 });
 if(GPS){
  const b=(navTarget&&!navTarget.visited)?brg(GPS.latitude,GPS.longitude,navTarget.lat,navTarget.lon):null;
  const me=L.marker([GPS.latitude,GPS.longitude],{
   icon:L.divIcon({
    className:"",
    html:`<div class="loc-marker">${b!=null?`<svg class="nav-arrow-svg" viewBox="0 0 100 100" style="transform:rotate(${b}deg)"><path d="M50 5 L70 70 L50 55 L30 70 Z" fill="#2b6cb0" stroke="#fff" stroke-width="4"/></svg>`:""}<div class="dot"></div></div>`,
    iconSize:[48,48],iconAnchor:[24,24]
   }),
   zIndexOffset:1000
  }).addTo(navMap);me._wp=1;
  if(!navTarget){const ts=WP.filter(w=>!w.visited);if(ts.length)navTarget=ts.sort((a,b)=>hav(GPS.latitude,GPS.longitude,a.lat,a.lon)-hav(GPS.latitude,GPS.longitude,b.lat,b.lon))[0];}
  if(navTarget&&!navTarget.visited){const d=hav(GPS.latitude,GPS.longitude,navTarget.lat,navTarget.lon),bearing=brg(GPS.latitude,GPS.longitude,navTarget.lat,navTarget.lon);
   $("navDist").textContent=Math.round(d)+" m";$("navTarget").textContent=(typeof dgCf==="function"?dgCf("Hedef:"):"Hedef:")+" P"+navTarget.wp_id+" · "+Math.round(bearing)+"°";
   $("navArrow").style.transform="rotate("+bearing+"deg)";
   const ln=L.polyline([[GPS.latitude,GPS.longitude],[navTarget.lat,navTarget.lon]],{color:"#c2452d",dashArray:"5,8",weight:2}).addTo(navMap);ln._wp=1;
  }else{$("navDist").textContent="—";$("navTarget").textContent=(typeof dgCf==="function"?dgCf("Hedef seç / tamamlandı"):"Hedef seç / tamamlandı");$("navArrow").style.transform="rotate(0)";}
 }
 renderWaypointList();
 dgWaypointGuidance();
}
/* =========================================================
 * MODÜL 2: HARİTA KATMANI SEÇİMİ
 * ========================================================= */

function switchBaseLayer(type){
 if(!map)return;
 if(!["osm","sat","topo"].includes(type))return;
 for(const id of ["baseLayerSelect","dgSensBaseSelect","dgPendingBaseSelect"]){const el=document.getElementById(id);if(el)el.value=type;}
 if(window.DG_LC_SENS?.state)window.DG_LC_SENS.state.base=type;
 let current=null;map.eachLayer(l=>{if(l._dgBase===type)current=l;});if(current)return;
 // Mevcut tile layer'ı bul ve kaldır
 map.eachLayer(l=>{
  if(l._url)map.removeLayer(l);
 });
 
 const urls={
  osm:"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  sat:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  topo:"https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
 };
 /* Atıf metinleri tek kaynaktan (constants.js DG_ATTR): lisansların istediği
  * tam biçim orada tutuluyor, burada kopya tutulmaz. */
 const attr=DG_ATTR;
 
 const layer=L.tileLayer(urls[type],{attribution:attr[type],maxZoom:22,maxNativeZoom:type==="topo"?17:type==="sat"?19:19,keepBuffer:1,updateWhenIdle:true,updateWhenZooming:false});
 layer._dgBase=type;layer.addTo(map);
 toast("✓ Harita: "+(type==="osm"?"Sokak":(type==="sat"?"Uydu":"Topoğrafik")),"ok","🗺️");
}

/* ═══════════ 0036 (T5) · PARK ORTAK CANLI KONUM ═══════════
 * İstek: "ortak proje yapılırken ortaklar haritada birbirlerinin konumunu
 * görsün, her ortak farklı renkte, üstüne gelince kimlik."
 * Tasarım: Supabase Realtime PRESENCE — park başına kanal (dg-park-<id>).
 * GEÇİCİDİR: konum VERİTABANINA YAZILMAZ, kanal kapanınca silinir; yalnız
 * aynı parkın kanalındaki kullanıcılar görür. Kırmızı çizgiler (şema, RLS,
 * migration) hiç devreye girmez. Her adım typeof/try korumalı: Realtime
 * kapalıysa özellik sessizce devre dışı kalır, ölçüm akışı etkilenmez. */
let DG_PARK_CH=null,DG_PARK_CH_ID=0,DG_LIVE_ON=true,DG_MATES_LAYER=null,DG_LAST_PING=0,DG_PARK_CH_RETRY=0,DG_PARK_CH_WATCH=null,DG_PARK_CH_LIVE=false;
function dgParkShareFail(){
 DG_PARK_CH_LIVE=false;
 const nx=$("dgMatesNote");
 if(nx)nx.textContent=_tmf("⚠ Gerçek zamanlı katman kapalı — canlı konum gösterilemiyor (Supabase → Dashboard → Realtime).");
 if(DG_PARK_CH_RETRY<2){DG_PARK_CH_RETRY++;
  setTimeout(()=>{try{if(DG_PARK_CH&&sb&&sb.removeChannel)sb.removeChannel(DG_PARK_CH);}catch(e){}
   DG_PARK_CH=null;DG_PARK_CH_ID=0;if(DG_LIVE_ON)dgLiveShareJoinCurrent();},3000);}
}
const DG_MATE_COLORS=["#c2452d","#2b6cb0","#7c3aed","#0f766e","#be185d","#4d7c0f","#b45309","#0e7490"];
function dgMateColor(id){let h=0;const s=String(id||"?");for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return DG_MATE_COLORS[h%DG_MATE_COLORS.length];}
function dgLiveShareToggle(on){
 DG_LIVE_ON=!!on;
 if(!DG_LIVE_ON)dgLiveShareLeave();else dgLiveShareJoinCurrent();
 if(typeof toast==="function")toast(_tmf(on?"Canlı konum paylaşımı açık (bu parkın ortaklarıyla).":"Canlı konum paylaşımı kapalı."),"info","👥");
}
async function dgLiveShareJoinCurrent(){
 try{
  if(!DG_LIVE_ON||typeof USER==="undefined"||!USER||typeof sb==="undefined")return;
  const sel=$("mProject");const pid=sel&&sel.value?+sel.value:0;
  if(!pid){dgLiveShareLeave();return;}
  const{data}=await sb.from("projects").select("park_id").eq("id",pid).maybeSingle();
  const park=(data&&data.park_id)||0;
  if(!park){dgLiveShareLeave();return;}
  if(DG_PARK_CH_ID===park&&DG_PARK_CH)return;
  dgLiveShareLeave();
  DG_PARK_CH_ID=park;
  const note0=$("dgMatesNote");if(note0)note0.textContent=_tmf("⏳ gerçek zamanlı katmana bağlanılıyor…");
  /* 0038: SUBSCRIBE ÖNCE (presence anon apikey ile çalışır — canlı WS
   * probuyla doğrulandı), JWT arka planda; 8 sn watchdog takılı düşürür. */
  DG_PARK_CH=sb.channel("dg-park-"+park,{config:{presence:{key:String(USER.id)}}});
  DG_PARK_CH.on("presence",{event:"sync"},()=>dgLiveMatesDraw());
  DG_PARK_CH.subscribe(st=>{
   if(st==="SUBSCRIBED"){
    if(DG_PARK_CH_WATCH){clearTimeout(DG_PARK_CH_WATCH);DG_PARK_CH_WATCH=null;}
    DG_PARK_CH_LIVE=true;DG_LAST_PING=0;dgLiveSharePing();dgLiveMatesDraw();
   }
   else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT"||st==="CLOSED"){dgParkShareFail();}
  });
  if(DG_PARK_CH_WATCH)clearTimeout(DG_PARK_CH_WATCH);
  DG_PARK_CH_WATCH=setTimeout(()=>{dgParkShareFail();},8000);
  (async()=>{try{
   const{data}=await sb.auth.getSession();
   const tok=data&&data.session&&data.session.access_token;
   if(tok&&sb.realtime&&sb.realtime.setAuth)sb.realtime.setAuth(tok);
  }catch(e){}})();
 }catch(e){DG_PARK_CH=null;DG_PARK_CH_ID=0;}
}
function dgLiveShareLeave(){
 try{if(DG_PARK_CH&&sb&&sb.removeChannel)sb.removeChannel(DG_PARK_CH);}catch(e){}
 DG_PARK_CH=null;DG_PARK_CH_ID=0;
 if(DG_MATES_LAYER&&typeof map!=="undefined"&&map){try{map.removeLayer(DG_MATES_LAYER);}catch(e){}}
 DG_MATES_LAYER=null;
 const note=$("dgMatesNote");if(note)note.textContent="";
}
function dgLiveSharePing(){
 try{
  if(!DG_PARK_CH||!DG_PARK_CH_LIVE||typeof DG_PARK_CH.track!=="function"||!DG_LIVE_ON)return;
  if(typeof GPS==="undefined"||!GPS||GPS.latitude==null)return;
  const now=Date.now();if(now-DG_LAST_PING<10000)return;DG_LAST_PING=now;
  DG_PARK_CH.track({id:String(USER.id),n:(typeof PROFILE!=="undefined"&&PROFILE&&PROFILE.full_name)||"?",la:GPS.latitude,lo:GPS.longitude,t:now});
 }catch(e){}
}
function dgLiveMatesDraw(){
 try{
  if(typeof map==="undefined"||!map||!DG_PARK_CH||typeof L==="undefined")return;
  if(!DG_MATES_LAYER){DG_MATES_LAYER=L.layerGroup().addTo(map);}
  DG_MATES_LAYER.clearLayers();
  const st=DG_PARK_CH.presenceState();let n=0;
  for(const k in st){const arr=st[k]||[];for(const p of arr){
   if(!p||String(p.id)===String(USER.id)||p.la==null||p.lo==null)continue;
   n++;
   const col=dgMateColor(p.id);
   const ini=String(p.n||"?").trim().slice(0,1).toLocaleUpperCase("tr-TR");
   const ic=L.divIcon({className:"",html:'<div style="width:18px;height:18px;border-radius:50%;background:'+col+';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800">'+esc(ini)+'</div>',iconSize:[18,18],iconAnchor:[9,9]});
   const age=Math.max(0,Math.round((Date.now()-(p.t||Date.now()))/1000));
   const ageTxt=age<60?age+" "+dgCf("sn"):Math.round(age/60)+" "+dgCf("dk");
   L.marker([p.la,p.lo],{icon:ic,interactive:true,keyboard:false,zIndexOffset:600}).addTo(DG_MATES_LAYER)
    .bindTooltip("<b>"+esc(p.n||"?")+"</b><br>"+_tmf("son konum")+": "+ageTxt+" "+_tmf("önce"),{direction:"top",offset:[0,-11]});
  }}
  const box=$("dgMatesNote");
  if(box)box.textContent=n?_tmff("👥 {n} ortak bu parkta çevrimiçi — konumlar canlı görünüyor (üstüne gel: kimlik).",{n:n}):"";
 }catch(e){}
}
