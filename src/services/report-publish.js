"use strict";
/* DendroGeo · services/report-publish.js — SİTE İÇİNDEN BİLİMSEL RAPOR YAYINI
 *
 * KULLANICI İSTEĞİ (2026-09-27): "raporu site üstünden yayınlayacağım" —
 * GitHub Actions arayüzüne gitmeden, uygulama içinden tek düğmeyle DGR
 * kimlikli bilimsel rapor yayınlanır ve kalıcı bağlantısı yine burada görünür.
 *
 * AKIŞ
 *   1) 📄 Yayınla → report_requests'e 'Beklemede' satırı (0008_report_publish.sql).
 *   2) rapor-yayin.yml (5 dk'da bir) → scripts/publish-queue.mjs → make-report.mjs
 *      raporu üretir, rapor/DGR-…/ altına commit'ler, sonucu
 *      rapor/yayin-kuyrugu.json'a yazar.
 *   3) Bu modül o günlüğü okur: durum rozeti, kalıcı bağlantı, 🔗 Aç ve
 *      📤 Paylaş düğmeleri kartta belirir. Bekleyen istek varken 25 sn'de bir
 *      sessizce tazelenir → sayfayı yenilemeye gerek kalmaz.
 *
 * GÜVENLİK / DÜRÜSTLÜK
 *   · Yönetici kartı (v-admin): istek yazma dgPubAdmin() kapısıyla korunur.
 *   · KULLANICI TARAFI (0009_user_report_publish.sql): parkı için projesi olan
 *     kullanıcı isteği KENDİSİ açar — sunucu kilitleri: mülkiyet (kendi
 *     projesinin parkı), kendi onaylı ölçümü, 24 saatte 3 istek kotası,
 *     requested_by = auth.uid(). İstemci kapısı yalnız UX'tir; yetki RLS +
 *     tg_report_request_gate'te (iki katman, 0006/0008 deseni).
 *   · Günlük dosyası Pages'te herkese açıktır. Bu yüzden bağlantı günlüğün
 *     yazdığı metinden DEĞİL, biçimi doğrulanmış rapor kimliğinden kurulur
 *     (DG_PUB_ID): bozulmuş/oynanmış bir günlük uygulama içine dış bağlantı
 *     sokamaz.
 *   · Sayılar burada YENİDEN HESAPLANMAZ; kart yalnız kimlik + durum gösterir.
 *     Rapordaki tüm değerler make-report.mjs'in canlı veri snapshot'ından gelir
 *     (park karşılaştırma satırındaki karbon yalnız seçim yardımıdır).
 *
 * GÖRÜNÜM: yönetici yayın merkezi ortak tema tokenları ve mevcut buton/rozet
 * aileleriyle düzenlenir. Özet, kuyruk, DOI ve son hata önde; ayrıntılı günlük
 * ile değişmezlik kuralları isteğe bağlı açılır. Kart yalnız v-admin içindedir.
 */

/* Modül durumu (üst düzey let: module-registry global ad çakışmasını kilitler). */
let DG_PUB_STATE={parks:[],requests:[],retractions:[],queue:null,queueAt:0,error:"",loading:false,pollTimer:0,pollCount:0};

const DG_PUB_QUEUE_URL="/rapor/yayin-kuyrugu.json";
const DG_PUB_ORIGIN="https://dendrogeo.org";
/* DGR-YYYY-NNNN: yayın kimliğinin TEK kabul edilen biçimi. */
const DG_PUB_ID=/^DGR-\d{4}-\d{4}$/;
const DG_PUB_DOI=/^10\.5281\/zenodo\.\d+$/;
const DG_PUB_QUEUE_STATE=window.DG_REPORT_PUBLICATION_REQUEST_APPLICATION.createReportPublicationQueueState({
 isReportId:value=>DG_PUB_ID.test(String(value||""))
});
const DG_PUB_POLL_MS=25000;      /* bekleyen istek varken tazeleme aralığı */
const DG_PUB_POLL_MAX=80;        /* ~33 dk; sonra elle 🔄 Yenile */

function dgPubAdmin(){return !!(typeof PROFILE!=="undefined"&&PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner"));}
function dgPubUrl(reportId){return window.DG_REPORT_PUBLICATION_LINK.url(reportId,DG_PUB_ORIGIN);}

/* ---------- okuma ---------- */
async function dgPubFetchQueue(){
 /* ?_=… : her okuma ağdan güncel kuyruğu ister; bozuk/erişilemeyen günlük boş kalır. */
 return window.DG_REPORT_PUBLICATION_LOG_STORE.load({fetch,url:DG_PUB_QUEUE_URL,now:Date.now});
}

async function dgPubFetchRequests(){
 const{data,error}=await window.DG_REPORT_PUBLICATION_REQUEST_STORE.load(sb);
 if(error){
  /* 42P01 = tablo yok → 0008 uygulanmamış. Sessiz kalmak yerine kartta
   * yapılacak iş yazılır (DG_PARK_SCHEMA_OK deseniyle aynı yaklaşım). */
  DG_PUB_STATE.error=(error.code==="42P01"||/report_requests/i.test(error.message||""))
   ? "SCHEMA"
   : ("İstekler okunamadı: "+(error.message||error.code||"bilinmeyen hata"));
  return [];
 }
 DG_PUB_STATE.error="";
 return data||[];
}

async function dgPubFetchParks(){
 return window.DG_REPORT_PARK_COMPARISON_STORE.load(sb);
}

/* Geri çekme istekleri (0010): tablo yoksa (0010 uygulanmamış) SESSİZCE boş
 * liste — yayın akışı bundan etkilenmez, 🗑 isteği sunucuda zaten reddedilir. */
async function dgPubFetchRetractions(){
 return window.DG_REPORT_RETRACTION_STORE.load(sb);
}

/* ---------- durum birleştirme: istek (DB) + sonuç (repo günlüğü) ---------- */
function dgPubEntryFor(reqId){
 return DG_PUB_QUEUE_STATE.entryFor(DG_PUB_STATE.queue,reqId);
}
/* GERİ ÇEKME FİLTRESİ (0010): günlükte 'Geri çekildi' kaydı olan rapor artık
 * "yayınlandı" sayılmaz — bağlantısı kurulmaz, listeden düşer, yerine durum
 * rozeti geçer. Kimlik biçimi burada da DOĞRULANIR (dgPubUrl tek kapı). */
function dgPubRetractedIds(queue){
 return DG_PUB_QUEUE_STATE.retractedIds(queue);
}
function dgPubRetractDone(queue,retId){
 return DG_PUB_QUEUE_STATE.retractionDone(queue,retId);
}
function dgPubRetractedInPark(queue,parkId){
 return DG_PUB_QUEUE_STATE.retractedInPark(queue,parkId);
}
function dgPubPublishedByPark(){
 return DG_PUB_QUEUE_STATE.publishedByPark(DG_PUB_STATE.queue);
}
function dgPubStatus(req){
 return DG_PUB_QUEUE_STATE.status(req,DG_PUB_STATE.queue);
}

/* ---------- çizim ---------- */
/* 0040: kaydırma koruma sarmalı. */
function dgPubRender(){const _y=(typeof dgScrollKeep==="function"?dgScrollKeep():null);try{return dgPubRender__scroll.apply(this,arguments);}finally{if(typeof dgScrollRestore==="function")dgScrollRestore(_y);}}
function dgPubRender__scroll(){
 const box=$("dgPubBox");if(!box)return;
 const st=DG_PUB_STATE;
 const pubByPark=dgPubPublishedByPark();
 const clock=$("dgPubClock");
 if(clock)clock.textContent=st.queueAt?(dgCf("son kontrol")+" "+new Date(st.queueAt).toLocaleTimeString("tr-TR")):"—";

 if(st.error==="SCHEMA"){
  box.innerHTML='<div class="alert warn">⚠ <b>Yayın kuyruğu veritabanında kurulu değil.</b> '+
   'Supabase → SQL Editor\'da <span class="mono">supabase/migrations/0008_report_publish.sql</span> çalıştırın, '+
   'sonra bu kartı 🔄 Yenile ile açın. (Rapor motoru hazır; yalnız istek tablosu eksik.)</div>';
  return;
 }

 const rows=st.parks.map(p=>{
  const pid=String(p.park_id);
  /* Başarısız üretim artık geçici kabul edilir: aynı DB isteği en fazla üç kez
   * yeniden denenir. Günlükte yalnız başarısız sonuç varsa satır "Beklemede"
   * kalır; kullanıcıdan yeni istek açması istenmez. */
  const req=st.requests.find(r=>{
   if(String(r.park_id)!==pid||r.status!=="Beklemede")return false;
   const prev=dgPubEntryFor(r.id);
   return !prev||prev.status==="Başarısız";
  });
  const last=st.requests.find(r=>String(r.park_id)===pid&&!(st.queue?.archived_request_ids||[]).includes(String(r.id)));
  const pub=pubByPark[pid];
  const retPend=(st.retractions||[]).find(x=>String(x.park_id)===pid&&x.status==="Beklemede"&&!dgPubRetractDone(st.queue,x.id));
  const retPark=dgPubRetractedInPark(st.queue,pid);
  let stt="none",rid="",note="";
  if(req){
   stt="pending";
   const prev=dgPubEntryFor(req.id);
   if(prev&&prev.status==="Başarısız")note="⚠ Önceki deneme başarısız · otomatik yeniden denenecek (en fazla 3 deneme)";
   else{
    const s=dgPubStatus(req);
    note=esc(s.note)+" · yayın işi 5 dakikada bir çalışır";
   }
  }else if(pub){
   stt=retPend?"retracting":"published";rid=pub.report_id;
   const doiNote=DG_PUB_DOI.test(String(pub.doi||""))?(" · DOI "+esc(pub.doi))
    :(pub.doi_status==="Başarısız"?" · DOI tekrar denenecek":" · DOI sırada");
   note=retPend?dgCf("🗑 geri çekme isteği kuyrukta — birkaç dakika içinde yayından kalkar")
    :esc(rid||"—")+(pub.finished_at?(" · "+dgCf("yayın")+" "+String(pub.finished_at).slice(0,10)):"")+doiNote;
  }else if(retPend){
   stt="retracting";rid=DG_PUB_ID.test(String(retPend.report_id||""))?String(retPend.report_id):"";
   note="🗑 "+esc(rid||dgCf("rapor"))+" "+dgCf("geri çekme kuyruğunda");
  }else if(retPark){
   stt="retracted";
   note="🗑 "+esc(DG_PUB_ID.test(String(retPark.report_id||""))?String(retPark.report_id):dgCf("rapor"))+" "+dgCf("geri çekildi")+
    (retPark.finished_at?(" · "+String(retPark.finished_at).slice(0,10)):"")+
    (retPark.reason?(" · "+esc(String(retPark.reason).slice(0,60))):"");
  }else if(last){
   const s=dgPubStatus(last);
   stt=s.key;rid=s.reportId||"";
   note=(s.key==="failed"?"⚠ ":"")+esc(String(s.note||"").slice(0,140));
  }
  const badge=stt==="published"?'<span class="badge on">Yayınlandı</span>'
   :stt==="pending"?'<span class="badge admin">Beklemede</span>'
   :stt==="retracting"?'<span class="badge admin">Geri çekiliyor</span>'
   :stt==="retracted"?'<span class="badge off">Geri çekildi</span>'
   :stt==="failed"?'<span class="badge off">Başarısız</span>'
   :stt==="cancelled"?'<span class="badge off">Vazgeçildi</span>'
   :'<span class="badge off">Yayın yok</span>';
  const url=dgPubUrl(rid);

  const act=[];
  if(stt==="pending"){
   act.push('<button class="btn sm red" onclick="dgPublishCancel(\''+esc(req.id)+'\')" title="Bekleyen isteği iptal et">✖ Vazgeç</button>');
  }else{
   if(url){
    act.push('<button class="btn sm blue" onclick="dgReportOpen(\''+rid+'\')" title="Raporu yeni sekmede aç">🔗 Aç</button>');
    act.push('<button class="btn sm" onclick="dgReportShare(\''+rid+'\')" title="Bağlantıyı paylaş / panoya kopyala">📤 Paylaş</button>');
    if(pub&&DG_PUB_DOI.test(String(pub.doi||"")))act.push('<a class="btn sm ghost" href="https://doi.org/'+esc(pub.doi)+'" target="_blank" rel="noopener" title="Zenodo DOI kaydını aç">DOI</a>');
   }
   if(stt==="published"){
    act.push('<button class="btn sm red" onclick="dgReportRetract(\''+rid+'\','+Number(p.park_id)+')" title="Yayını geri çek: veri dosyaları kaldırılır, adresinde gerekçeli bildirim kalır; kimlik yeniden kullanılmaz">🗑 Geri çek</button>');
   }
   if(!retPend){
    act.push('<button class="btn sm amber" onclick="dgPublishReport('+Number(p.park_id)+')" title="'+
     (stt==="published"?"Yeni sürüm yayınla: eski rapor değişmez, yeni DGR kimliği alır":"Bilimsel raporu yayınla")+'">'+
     (stt==="published"?"📄 Yeni sürüm":"📄 Yayınla")+"</button>");
   }
  }

  return "<tr>"+
   '<td data-label="Park"><b>'+esc(p.park_name)+"</b>"+
    '<div class="dg-tree-meta">'+esc(p.city||"—")+" · "+Number(p.species_n||0)+" "+dgCf("tür")+" · "+Number(p.contributors||0)+" "+dgCf("katkı")+"</div></td>"+
   '<td data-label="Kayıt" class="mono">'+Number(p.records||0)+"</td>"+
   '<td data-label="Karbon">'+(Number(p.carbon_kg||0)/1000).toFixed(2)+" t</td>"+
   '<td data-label="Alan">'+(typeof dgFmtHa==="function"?dgFmtHa(p.area_m2):"—")+"</td>"+
   '<td data-label="Yayın durumu">'+badge+'<div class="dg-tree-meta">'+note+"</div></td>"+
   '<td data-label="İşlem"><div class="dg-act">'+act.join("")+"</div></td>"+
  "</tr>";
 }).join("");

 const retSet=dgPubRetractedIds(st.queue);
 const hist=((st.queue&&st.queue.entries)||[]).slice(-6).reverse().map(e=>{
  const ok=e.status==="Yayınlandı";
  const ret=e.status==="Geri çekildi";
  if(ret){
   const ridR=DG_PUB_ID.test(String(e.report_id||""))?e.report_id:"—";
   return '<div class="admin-publish-log-item">'+
    "🗑 <b>"+esc(ridR)+"</b> "+dgCf("geri çekildi")+" · "+esc(e.park_name||("park #"+e.park_id))+
    (e.reason?(" · gerekçe: "+esc(String(e.reason).slice(0,80))):"")+
    '<div class="dg-tree-meta">istek '+esc(String(e.retraction_id||"").slice(0,8))+" · "+esc(String(e.finished_at||"").slice(0,16).replace("T"," "))+"</div></div>";
  }
  /* Geri çekilen raporun eski "Yayınlandı" satırı bağlantı TAŞIMAZ: veri
   * dosyaları kaldırıldı, ölü bağlantı çizmek dürüstlük ilkesine aykırı. */
  const u=(ok&&!retSet[String(e.report_id)])?dgPubUrl(e.report_id):"";
  /* Günlük Pages'te herkese açık: biçimi bozuk bir kimlik EKRANA DA yazılmaz
   * (bağlantı zaten kurulmaz) — yerine "—" basılır. */
  const rid=DG_PUB_ID.test(String(e.report_id||""))?e.report_id:"—";
  return '<div class="admin-publish-log-item">'+
   (ok?"✅ ":"❌ ")+"<b>"+esc(rid)+"</b> · "+esc(e.park_name||("park #"+e.park_id))+
   (ok?(" · n="+Number(e.n||0)+" · "+esc(e.carbon_txt||"")):(" · "+esc(String(e.message||"").slice(0,120))))+
   (u?(' · <a href="'+esc(u)+'" target="_blank" rel="noopener">bağlantı</a>'):"")+
   '<div class="dg-tree-meta">istek '+esc(String(e.request_id||"").slice(0,8))+" · "+esc(String(e.finished_at||"").slice(0,16).replace("T"," "))+"</div></div>";
 }).join("");

 const queueEntries=(st.queue&&st.queue.entries)||[];
 const pending=st.requests.filter(r=>{
  if(r.status!=="Beklemede")return false;
  const e=dgPubEntryFor(r.id);
  return !e||e.status==="Başarısız";
 }).length;
 const activePublished=Object.values(pubByPark);
 const doiCount=activePublished.filter(e=>DG_PUB_DOI.test(String(e.doi||""))).length;
 const latestByRequest=new Map();
 for(const e of queueEntries)if(e.request_id)latestByRequest.set(String(e.request_id),e);
 const unresolvedFails=[...latestByRequest.values()].filter(e=>e.status==="Başarısız");
 const failedCount=unresolvedFails.length;
 const latestFail=unresolvedFails.at(-1);
 const failBanner=latestFail?'<div class="alert err admin-publish-error"><b>Son yayın denemesi başarısız.</b> '+esc(latestFail.park_name||("park #"+latestFail.park_id))+' · '+esc(String(latestFail.message||"üretim hatası").slice(0,180))+'<small>istek '+esc(String(latestFail.request_id||"").slice(0,8))+' · sistem otomatik yeniden dener</small></div>':"";
 box.innerHTML=
  '<div class="admin-publish-summary">'+
   '<div class="admin-publish-metric"><span>Aktif yayın</span><strong>'+activePublished.length+'</strong></div>'+
   '<div class="admin-publish-metric"><span>Kuyrukta</span><strong>'+pending+'</strong></div>'+
   '<div class="admin-publish-metric"><span>DOI kayıtlı</span><strong>'+doiCount+'</strong></div>'+
   '<div class="admin-publish-metric"><span>Hata günlüğü</span><strong>'+failedCount+'</strong></div>'+
  '</div>'+
  (st.error?'<div class="alert err">⚠ '+esc(st.error)+"</div>":"")+
  (st.queue===null?'<div class="alert info">ℹ Yayın günlüğü okunamadı (çevrimdışı ya da dosya henüz yayınlanmadı). İstek gönderimi çalışır; durum alanı boş kalır.</div>':"")+
  failBanner+
  (pending>0?'<div class="alert info">⏳ <b>'+pending+" "+dgCf("istek kuyrukta.")+"</b> "+dgCf("Başarısız üretimler en fazla 3 kez otomatik yeniden denenir. Başarılı rapor üretildikten sonra Zenodo DOI kaydı otomatik başlatılır.")+"</div>":"")+
  '<div class="tblwrap admin-publish-table"><table class="dg-cards">'+
  "<thead><tr><th scope='col'>Park</th><th scope='col'>Kayıt</th><th scope='col'>Karbon</th><th scope='col'>Alan</th><th scope='col'>Yayın durumu</th><th scope='col'>İşlem</th></tr></thead><tbody>"+
  (rows||'<tr><td colspan=6>Onaylı ölçümü olan park yok — önce ölçüm onaylayın.</td></tr>')+
  "</tbody></table></div>"+
  '<details class="admin-publish-log"><summary><span>📜 Yayın günlüğü</span><small>son 6 işlem</small></summary><div class="admin-publish-log-list">'+
  (hist||'<div class="dg-tree-meta">Henüz işlenmiş istek yok. Günlük: <span class="mono">rapor/yayin-kuyrugu.json</span></div>')+
  '</div></details>'+
  '<details class="admin-publish-help"><summary>Yayın akışı ve değişmezlik kuralları</summary><div class="admin-publish-help-body">📄 Yayınla isteği kuyruğa yazar; rapor üretildiğinde DGR kimliği ve içerik hash\'i dondurulur. Aktif üretim raporu için Zenodo DOI kaydı otomatik yürür. Eski rapor değiştirilmez; yeni çözümleme yeni DGR kimliği alır. 🗑 Geri çekme veri dosyalarını kaldırır ve kimliği yeniden kullandırmaz.</div></details>';
}

/* ---------- yazma (ortak çekirdek: yönetici kartı + kullanıcı paneli) ---------- */
/* RLS-safe insert (trackVisit ile aynı desen): "Prefer: return=minimal" —
 * return=representation olsaydı RETURNING satırı politikaya takılıp istek
 * sessizce ölebilirdi. Oturum anahtarı şart: anon istek açamaz. */
async function dgPubInsertRequest(parkId,lulc,note){
 let token=SB_KEY;
 try{const{data}=await sb.auth.getSession();if(data&&data.session&&data.session.access_token)token=data.session.access_token;}catch(e){}
 try{
  const r=await fetch(SB_URL+"/rest/v1/report_requests",{
   method:"POST",
   headers:{"apikey":SB_KEY,"Authorization":"Bearer "+token,"Content-Type":"application/json","Prefer":"return=minimal"},
   body:JSON.stringify([{park_id:Number(parkId),with_lulc:lulc!==false,status:"Beklemede",
    requested_by:(typeof USER!=="undefined"&&USER&&USER.id)||null,note:note||"uygulama içi yayın"}])
  });
  const ok=r.status===201||r.status===200;
  const txt=ok?"":((await r.text().catch(()=> ""))||"");
  return{ok:ok,status:r.status,txt:txt};
 }catch(e){return{ok:false,status:0,txt:"NETWORK "+((e&&e.message)||e)};}
}

/* Hata metni eşleme: PostgREST, RLS reddini ve tetikleyici hatalarını gövdede
 * taşır (REPORT_QUOTA / REPORT_NOT_YOUR_PARK / REPORT_NO_OWN_DATA / …). */
function dgPubInsertError(r){
 return window.DG_PUBLICATION_REQUEST_ERROR.message(r,dgCf);
}

async function dgPublishReport(parkId){
 if(typeof dgPresenceAct==="function"){try{dgPresenceAct("publish","park #"+parkId);}catch(e){}}
 if(!dgPubAdmin())return toast("Rapor yayını yalnız yönetici içindir.","err","📄");
 const lulc=$("dgPubLulc")?$("dgPubLulc").checked!==false:true;
 return window.DG_REQUEST_PUBLICATION.execute(parkId,lulc,{
  collect:dgReportCollectRequest,
  onSuccess:async()=>{
   toast("📄 Yayın isteği kuyruğa alındı — rapor birkaç dakika içinde burada bağlanacak.","ok","📄");
   DG_PUB_STATE.pollCount=0;
   await dgLoadPublishQueue();
   dgPubSchedulePoll();
  },
  onFailure:r=>{
   const msg=dgPubInsertError(r);
   if(/0008_report_publish/.test(msg))DG_PUB_STATE.error="SCHEMA";
   toast(msg,"err","📄");
   dgPubRender();
  }
 });
}

async function dgPublishCancel(id){
 return window.DG_CANCEL_PUBLICATION_REQUEST.execute({
  canCancel:dgPubAdmin,
  onDenied:()=>toast("Yalnız yönetici iptal edebilir.","err","📄"),
  confirm:()=>confirm(dgCf("Bekleyen yayın isteği iptal edilsin mi?")),
  cancel:()=>window.DG_REPORT_PUBLICATION_CANCEL_STORE.cancel(sb,id,new Date().toISOString()),
  onFailure:error=>toast(dgCf("İptal edilemedi: ")+esc(error.message),"err","📄"),
  onSuccess:async()=>{toast("İstek iptal edildi.","ok","📄");await dgLoadPublishQueue();}
 });
}

/* ---------- GERİ ÇEKME (0010): yayımlanmış rapor yayından kaldırılır ----------
 * Bilimsel teamül: SESSİZ SİLME YOK — istek kuyruğa yazılır, Actions işi
 * veri dosyalarını kaldırır, adresinde gerekçeli bildirim bırakır, günlük
 * 'Geri çekildi' kaydı alır. DGR kimliği yeniden kullanılmaz.
 * YETKİ SUNUCUDA: yönetici herhangi bir raporu; kullanıcı YALNIZ kendi
 * projesinin parkının raporunu geri çekebilir (RLS + tg_report_retraction_gate).
 * report_id ↔ park_id eşleşmesini Actions günlükle ayrıca doğrular. */
async function dgRetractInsert(reportId,parkId,reason){
 return window.DG_REPORT_RETRACTION_INSERT_STORE.insert(sb,{
  fetch,supabaseUrl:SB_URL,anonKey:SB_KEY,reportId,parkId,reason,
  userId:(typeof USER!=="undefined"&&USER&&USER.id)||null
 });
}

function dgRetractError(r){
 return window.DG_RETRACTION_REQUEST_ERROR.message(r);
}

async function dgReportRetract(reportId,parkId){
 if(!DG_PUB_ID.test(String(reportId||"")))return toast("Rapor kimliği geçersiz.","err","🗑");
 if(typeof USER==="undefined"||!USER)return toast("Önce giriş yap.","err","🗑");
 if(!confirm(reportId+" yayından geri çekilsin mi?\n\nRaporun veri dosyaları kaldırılır; adresinde gerekçeli geri çekme bildirimi kalır. DGR kimliği yeniden kullanılmaz; işlem günlüğe ve git geçmişine yazılır."))return;
 let reason="";
 try{reason=window.prompt("Gerekçe (bildirim sayfasında ve günlükte yayımlanır; boş bırakılabilir):","yanlışlıkla yayınlandı")||"";}catch(e){reason="";}
 const r=await dgRetractInsert(reportId,parkId,String(reason).slice(0,400));
 if(r.ok){
  toast("🗑 Geri çekme isteği kuyruğa alındı — rapor birkaç dakika içinde yayından kalkar.","ok","🗑");
  DG_PUB_STATE.pollCount=0;DG_USER_PUB.polls=0;
  if($("dgPubBox"))await dgLoadPublishQueue({silent:true});
  if(DG_USER_PUB.parkId)await dgUserPubRefresh();
  return;
 }
 toast(dgRetractError(r),"err","🗑");
}

/* ---------- KULLANICI TARAFI (0009): 📁 Projeler → 📄 Park Raporu ----------
 * Parkı için projesi olan kullanıcı rapor isteğini KENDİSİ açar; sonuç aynı
 * kuyruktan döner (rapor-yayin.yml → yayin-kuyrugu.json → kalıcı bağlantı).
 * Yetki kararı SUNUCUDA (RLS + tg_report_request_gate): mülkiyet, kendi
 * onaylı ölçümü, 24 saatte 3 istek, requested_by = auth.uid(). İstemci
 * kapıları yalnız UX'tir — yetki sınırı DEĞİL. Yeni CSS yok: yönetici
 * kartıyla aynı card/shead/badge/btn/alert/dg-tree-meta/mono aileleri.
 * Panel durumu yönetici kartından AYRI tutulur (DG_USER_PUB): iki arayüz
 * birbirinin verisini ezmez. */
let DG_USER_PUB={projectId:0,parkId:0,parkName:"",requests:[],retracts:[],queue:null,ownApproved:null,error:"",timer:0,polls:0};

/* Saf okuma yardımcıları (günlük dosyası parametrik: yönetici kartı kendi
 * durumunu, kullanıcı paneli kendi durumunu verir). Kimlik biçimi DOĞRULANMADAN
 * hiçbir girdi "yayınlandı" sayılmaz — oynanmış günlük dış bağlantı sokamaz. */
function dgPubEntryIn(queue,reqId){
 if((queue?.archived_request_ids||[]).includes(String(reqId)))return {request_id:reqId,status:"Test arşivi"};
 const es=(queue&&queue.entries)||[];
 for(let i=es.length-1;i>=0;i--)if(String(es[i].request_id)===String(reqId))return es[i];
 return null;
}
function dgPubPublishedInPark(queue,parkId){
 const ret=dgPubRetractedIds(queue);
 const es=(queue&&queue.entries)||[];
 for(let i=es.length-1;i>=0;i--){
  const e=es[i];
  if(e.status==="Yayınlandı"&&String(e.park_id)===String(parkId)&&DG_PUB_ID.test(String(e.report_id||""))&&!ret[String(e.report_id)])return e;
 }
 return null;
}

async function dgUserPubOpen(projectId){
 const list=(typeof PROJ_LIST!=="undefined"&&Array.isArray(PROJ_LIST))?PROJ_LIST:[];
 return window.DG_OPEN_USER_PUBLICATION_PANEL.execute(projectId,{
  getBox:()=>$('dgUserPubBox'),
  isAuthenticated:()=>typeof USER!=="undefined"&&!!USER,
  findProject:id=>list.find(x=>Number(x.id)===Number(id)),
  onUnauthenticated:()=>toast("Önce giriş yap.","err","📄"),
  onMissingProject:()=>toast("Proje bulunamadı — listeden yeniden dene.","err","📄"),
  onUnlinkedProject:()=>toast("Bu proje bir parka bağlı değil — rapor park kimliği ister.","err","🌳"),
  stopPolling:()=>{if(DG_USER_PUB.timer){clearInterval(DG_USER_PUB.timer);DG_USER_PUB.timer=0;}},
  selectProject:p=>{
   DG_USER_PUB.projectId=Number(p.id);
   DG_USER_PUB.parkId=Number(p.park_id);
   DG_USER_PUB.parkName=(p.parks&&p.parks.name)||p.park_name||("park #"+p.park_id);
   DG_USER_PUB.requests=[];DG_USER_PUB.retracts=[];DG_USER_PUB.error="";DG_USER_PUB.ownApproved=null;DG_USER_PUB.polls=0;
  },
  refresh:dgUserPubRefresh
 });
}

async function dgUserPubRefresh(){
 return window.DG_LOAD_USER_PUBLICATION.execute(DG_USER_PUB,{
  loadRequests:parkId=>window.DG_USER_PUBLICATION_REQUEST_STORE.load(sb,parkId),
  requestError:(error,transport)=>transport
   ?("İstekler okunamadı: "+((error&&error.message)||error))
   :((error.code==="42P01"||/report_requests/i.test(error.message||""))
    ?"SCHEMA"
    :("İstekler okunamadı: "+(error.message||error.code||"bilinmeyen hata"))),
  loadQueue:dgPubFetchQueue,
  loadOwnApproved:dgUserOwnApproved,
  loadRetractions:dgUserFetchRetractions,
  render:dgUserPubRender,
  schedulePoll:dgUserPubSchedulePoll
 });
}

/* Bu projedeki kendi onaylı ölçüm sayısı (yalnız BİLGİ: yayın kararını
 * sunucu verir — aynı parktaki başka projenin onaylı verisi de yeter). */
async function dgUserOwnApproved(){
 if(typeof USER==="undefined"||!USER||!DG_USER_PUB.projectId)return null;
 try{return await window.DG_OWN_APPROVED_MEASUREMENTS_STORE.count(sb,DG_USER_PUB.projectId,USER.id);}
 catch(e){return null;}
}

/* Bu parkın geri çekme istekleri (0010): tablo yoksa sessizce boş — panel
 * yayın durumunu göstermeye devam eder, 🗑 sunucuda zaten reddedilir. */
async function dgUserFetchRetractions(){
 if(!DG_USER_PUB.parkId)return[];
 return window.DG_USER_RETRACTION_STORE.load(sb,DG_USER_PUB.parkId);
}

function dgUserPubRender(){
 const box=$("dgUserPubBox");if(!box)return;
 const st=DG_USER_PUB;
 const close='<button class="btn sm ghost" onclick="dgUserPubClose()" title="Paneli kapat">✖ Kapat</button>';
 if(st.error==="SCHEMA"){
  box.innerHTML='<div class="shead" style="margin-bottom:10px"><span class="no">📄</span><h2 style="font-size:1.15rem">Park Raporu</h2><span class="rule"></span>'+close+'</div>'+
   '<div class="alert warn">⚠ <b>Yayın kuyruğu veritabanında kurulu değil.</b> Yönetici Supabase → SQL Editor\'da '+
   '<span class="mono">0008_report_publish.sql</span> ve <span class="mono">0009_user_report_publish.sql</span> dosyalarını çalıştırmalı.</div>';
  return;
 }
 const mine=(typeof USER!=="undefined"&&USER&&USER.id)||"";
 const pend=st.requests.find(r=>r.status==="Beklemede"&&!dgPubEntryIn(st.queue,r.id));
 const pendOwn=!!(pend&&String(pend.requested_by||"")===String(mine));
 const pub=dgPubPublishedInPark(st.queue,st.parkId);
 const retPend=(st.retracts||[]).find(x=>x.status==="Beklemede"&&!dgPubRetractDone(st.queue,x.id));
 const retPark=dgPubRetractedInPark(st.queue,st.parkId);
 const last=st.requests.find(r=>!(st.queue?.archived_request_ids||[]).includes(String(r.id)))||null;

 let badge,note="";
 if(pend){
  const dk=Math.max(0,Math.round((Date.now()-new Date(pend.created_at||Date.now()).getTime())/60000));
  badge='<span class="badge admin">Beklemede</span>';
  note=(dk<1?dgCf("az önce"):dk+" "+dgCf("dk önce"))+" "+dgCf("kuyruğa alındı")+" · "+dgCf("yayın işi 5 dakikada bir çalışır")+(pendOwn?"":" · "+dgCf("isteği başka bir katkıda bulunan açtı"));
 }else if(retPend){
  badge='<span class="badge admin">Geri çekiliyor</span>';
  note="🗑 "+esc(DG_PUB_ID.test(String(retPend.report_id||""))?String(retPend.report_id):"rapor")+" geri çekme kuyruğunda — birkaç dakika içinde yayından kalkar";
 }else if(pub){
  badge='<span class="badge on">Yayınlandı</span>';
 }else if(retPark){
  badge='<span class="badge off">Geri çekildi</span>';
  note="🗑 "+esc(DG_PUB_ID.test(String(retPark.report_id||""))?String(retPark.report_id):dgCf("rapor"))+" "+dgCf("geri çekildi")+
   (retPark.finished_at?(" · "+String(retPark.finished_at).slice(0,10)):"")+
   (retPark.reason?(" · "+esc(String(retPark.reason).slice(0,60))):"");
 }else if(last){
  const e=dgPubEntryIn(st.queue,last.id);
  if(e&&e.status==="Başarısız"){badge='<span class="badge off">Başarısız</span>';note="⚠ "+String(e.message||"üretim hatası").slice(0,140);}
  else if(last.status==="Vazgeçildi"){badge='<span class="badge off">Vazgeçildi</span>';}
  else{badge='<span class="badge off">Yayın yok</span>';}
 }else{
  badge='<span class="badge off">Yayın yok</span>';
 }

 const rid=(pub&&DG_PUB_ID.test(String(pub.report_id||"")))?String(pub.report_id):"";
 const url=dgPubUrl(rid);
 const act=[];
 if(url){
  act.push('<button class="btn sm blue" onclick="dgReportOpen(\''+rid+'\')" title="Raporu yeni sekmede aç">🔗 Aç</button>');
  act.push('<button class="btn sm" onclick="dgReportShare(\''+rid+'\')" title="Bağlantıyı paylaş / panoya kopyala">📤 Paylaş</button>');
 }
 if(pub&&!retPend)act.push('<button class="btn sm red" onclick="dgReportRetract(\''+rid+'\','+st.parkId+')" title="Yayını geri çek: veri dosyaları kaldırılır, adresinde gerekçeli bildirim kalır (kendi parkın olmalı)">🗑 Geri çek</button>');
 if(pend&&pendOwn)act.push('<button class="btn sm red" onclick="dgUserCancel(\''+esc(pend.id)+'\')" title="Bekleyen isteği iptal et">✖ Vazgeç</button>');
 if(!pend&&!retPend)act.push('<button class="btn sm amber" onclick="dgUserPublish('+st.parkId+')" title="'+(url?"Yeni sürüm yayınla: eski rapor değişmez, yeni DGR kimliği alır":"Parkın bilimsel raporunu yayınla")+'">'+(url?"📄 Yeni sürüm":"📄 Yayınla")+"</button>");
 const lulc=(!pend&&!retPend)?'<label style="font-size:.78rem;color:var(--mut);display:inline-flex;gap:6px;align-items:center"><input type="checkbox" class="dg-switch" id="dgUserPubLulc" checked> 🛰 Arazi örtüsü bölümü (§5) dahil — önerilir</label>':"";

 const own=st.ownApproved===0
  ? '<div class="alert warn" style="margin-top:10px">⚠ Bu projede <b>onaylı ölçümün görünmüyor</b>. Yayın isteği, parkta onaylı ölçümün varsa açılır — ölçülerin yönetici onayından geçince 📄 düğmesi çalışır.</div>'
  : (st.ownApproved>0?'<div class="dg-tree-meta" style="margin-top:8px">✓ Bu projede '+Number(st.ownApproved)+" onaylı ölçümün var.</div>":"");

 box.innerHTML=
  (st.error?'<div class="alert err">⚠ '+esc(st.error)+"</div>":"")+
  '<div class="shead" style="margin-bottom:10px"><span class="no">📄</span><h2 style="font-size:1.15rem">Park Raporu — '+esc(st.parkName)+'</h2><span class="rule"></span>'+close+"</div>"+
  '<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap">'+badge+(note?'<span class="dg-tree-meta">'+esc(note)+"</span>":"")+"</div>"+
  (url?'<div class="dg-tree-meta" style="margin-top:8px">Kalıcı bağlantı: <span class="mono">'+esc(url)+"</span>"+((pub&&pub.finished_at)?(" · yayın "+String(pub.finished_at).slice(0,10)):"")+"</div>":"")+
  '<div class="dg-act" style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+act.join("")+lulc+"</div>"+
  own+
  (st.queue===null?'<div class="dg-tree-meta" style="margin-top:8px">ℹ Yayın günlüğü okunamadı (çevrimdışı ya da dosya henüz yayınlanmadı) — istek gönderimi çalışır, durum alanı eksik kalabilir.</div>':"")+
  '<div class="dg-parkadmin-note" style="margin-top:10px">Rapor <b>park düzeyindedir</b>: yalnız bu projeyi değil, parktaki <b>tüm onaylı ölçümleri</b> kapsar. '+
  "Yayın kalıcıdır — içerik hash'i ile dondurulur, eski rapor DEĞİŞMEZ; yeni çözümleme yeni DGR kimliği alır. "+
  "Üretim birkaç dakika sürer (kuyruk işi 5 dakikada bir çalışır); bağlantı bu panelde belirir. Yönetici olmayan kullanıcı 24 saatte en fazla 3 istek açabilir. "+
  "🗑 Geri çek = yanlışlıkla yayımlanan rapor yayından kaldırılır: adresinde gerekçeli bildirim kalır, kimlik yeniden kullanılmaz, işlem günlüğe yazılır.</div>";
}

async function dgUserPublish(parkId){
 if(typeof USER==="undefined"||!USER)return toast("Önce giriş yap.","err","📄");
 const lulc=$("dgUserPubLulc")?$("dgUserPubLulc").checked!==false:true;
 return window.DG_REQUEST_PUBLICATION.execute(parkId,lulc,{
  collect:dgReportCollectRequest,
  onSuccess:async()=>{
   toast("📄 Yayın isteği kuyruğa alındı — rapor birkaç dakika içinde burada bağlanacak.","ok","📄");
   DG_USER_PUB.polls=0;
   await dgUserPubRefresh();
  },
  onFailure:r=>{
   const msg=dgPubInsertError(r);
   if(/0008_report_publish/.test(msg))DG_USER_PUB.error="SCHEMA";
   toast(msg,"err","📄");
   dgUserPubRender();
  }
 });
}

async function dgUserCancel(id){
 const mine=(typeof USER!=="undefined"&&USER&&USER.id)||"";
 const row=DG_USER_PUB.requests.find(r=>String(r.id)===String(id));
 const own=!!(row&&String(row.requested_by||"")===String(mine));
 return window.DG_CANCEL_PUBLICATION_REQUEST.execute({
  canCancel:()=>own||dgPubAdmin(),
  onDenied:()=>toast("Yalnız kendi bekleyen isteğini iptal edebilirsin.","err","📄"),
  confirm:()=>confirm(dgCf("Bekleyen yayın isteği iptal edilsin mi?")),
  cancel:()=>window.DG_REPORT_PUBLICATION_CANCEL_STORE.cancel(sb,id,new Date().toISOString()),
  onFailure:error=>toast(dgCf("İptal edilemedi: ")+esc(error.message),"err","📄"),
  onSuccess:async()=>{toast("İstek iptal edildi.","ok","📄");await dgUserPubRefresh();}
 });
}

/* Kendi bekleyen isteği varken ve panel görünürken 25 sn'de bir sessiz tazeleme
 * (yönetici kartındaki dgPubSchedulePoll ile aynı desen ve sınırlar). */
function dgUserPubSchedulePoll(){
 return window.DG_SCHEDULE_USER_PUBLICATION_POLL.execute(DG_USER_PUB,{
  clearTimer:clearInterval,
  userId:()=>typeof USER!=="undefined"&&USER&&USER.id,
  entryFor:dgPubEntryIn,
  retractionDone:dgPubRetractDone,
  maxPolls:DG_PUB_POLL_MAX,
  setInterval,
  intervalMs:DG_PUB_POLL_MS,
  isProjectsTabActive:()=>{const tab=$("v-projects");return !tab||tab.classList.contains("on");},
  isDocumentHidden:()=>document.hidden,
  isPanelVisible:()=>{const box=$("dgUserPubBox");return !!box&&box.style.display!=="none";},
  refresh:dgUserPubRefresh
 });
}

function dgUserPubClose(){
 return window.DG_CLOSE_USER_PUBLICATION_PANEL.execute(DG_USER_PUB,{clearTimer:clearInterval,getBox:()=>$('dgUserPubBox')});
}

/* loadProjects() her çizimde çağırır: paneli açık proje listeden silindiyse
 * (proje silindi) panel kapanır — hayalet durum gösterilmez. */
function dgUserPubSync(list){
 return window.DG_SYNC_USER_PUBLICATION_PANEL.execute(DG_USER_PUB,list,dgUserPubClose);
}

/* ---------- paylaş ---------- */
async function dgReportShare(reportId,parkName){
 return window.DG_SHARE_REPORT_LINK.share(reportId,{
  parkName,
  url:dgPubUrl,
  share:navigator.share?navigator.share.bind(navigator):null,
  copy:url=>navigator.clipboard.writeText(url),
  copied:url=>toast(dgCf("🔗 Bağlantı kopyalandı: ")+url,"ok","📄"),
  prompt:url=>window.prompt("Bağlantıyı kopyalayın (Ctrl+C):",url),
  invalidLink:()=>toast("Bağlantı kurulamadı: rapor kimliği geçersiz.","err","📄")
 });
}

function dgReportOpen(reportId){
 return window.DG_SHARE_REPORT_LINK.open(reportId,{
  url:dgPubUrl,
  open:url=>window.open(url,"_blank","noopener"),
  invalidLink:()=>toast("Bağlantı kurulamadı: rapor kimliği geçersiz.","err","📄")
 });
}

/* ---------- yükleme + kendiliğinden tazeleme ---------- */
async function dgLoadPublishQueue(opts){
 if(!$("dgPubBox"))return;
 if(DG_PUB_STATE.loading)return;
 DG_PUB_STATE.loading=true;
 if(!(opts&&opts.silent))$("dgPubBox").innerHTML='<div class="dg-tree-meta">⏳ Kuyruk yükleniyor…</div>';
 try{
  const [parks,requests,queue,retracts]=await Promise.all([dgPubFetchParks(),dgPubFetchRequests(),dgPubFetchQueue(),dgPubFetchRetractions()]);
  DG_PUB_STATE.parks=parks;
  DG_PUB_STATE.requests=requests;
  DG_PUB_STATE.retractions=retracts;
  if(queue)DG_PUB_STATE.queue=queue;
  DG_PUB_STATE.queueAt=Date.now();
 }catch(e){
  DG_PUB_STATE.error="Kuyruk yüklenemedi: "+((e&&e.message)||e);
 }finally{DG_PUB_STATE.loading=false;}
 dgPubRender();
 dgPubSchedulePoll();
}

/* Bekleyen istek varken ve yönetici sekmesi görünürken 25 sn'de bir sessiz
 * tazeleme → kullanıcı F5'e basmadan bağlantının belirdiğini görür. */
function dgPubSchedulePoll(){
 if(DG_PUB_STATE.pollTimer){clearInterval(DG_PUB_STATE.pollTimer);DG_PUB_STATE.pollTimer=0;}
 const waiting=DG_PUB_STATE.requests.some(r=>r.status==="Beklemede"&&!dgPubEntryFor(r.id))
  ||(DG_PUB_STATE.retractions||[]).some(x=>x.status==="Beklemede"&&!dgPubRetractDone(DG_PUB_STATE.queue,x.id));
 if(!waiting||DG_PUB_STATE.pollCount>=DG_PUB_POLL_MAX)return;
 DG_PUB_STATE.pollTimer=setInterval(async()=>{
  DG_PUB_STATE.pollCount++;
  const adminView=$("v-admin");
  if(adminView&&!adminView.classList.contains("on"))return;   /* sekme kapalı: ağ isteği atma */
  if(document.hidden)return;                                   /* arka plan sekmesi: bekle */
  await dgLoadPublishQueue({silent:true});
 },DG_PUB_POLL_MS);
}

window.dgLoadPublishQueue=dgLoadPublishQueue;
window.dgPublishReport=dgPublishReport;
window.dgPublishCancel=dgPublishCancel;
window.dgReportShare=dgReportShare;
window.dgReportOpen=dgReportOpen;
window.dgUserPubOpen=dgUserPubOpen;
window.dgUserPubClose=dgUserPubClose;
window.dgUserPublish=dgUserPublish;
window.dgUserCancel=dgUserCancel;
window.dgUserPubSync=dgUserPubSync;
window.dgReportRetract=dgReportRetract;

