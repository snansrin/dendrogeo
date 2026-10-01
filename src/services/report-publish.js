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
 * GÖRÜNÜM: yeni CSS YOK — mevcut kart/tablo/buton aileleri (card, shead,
 * tblwrap, dg-cards, dg-act, btn sm …, badge, alert, dg-tree-meta). Kart
 * yalnız v-admin içindedir; başka sekmenin düzenine dokunmaz.
 */

/* Modül durumu (üst düzey let: module-registry global ad çakışmasını kilitler). */
let DG_PUB_STATE={parks:[],requests:[],retractions:[],queue:null,queueAt:0,error:"",loading:false,pollTimer:0,pollCount:0};

const DG_PUB_QUEUE_URL="/rapor/yayin-kuyrugu.json";
const DG_PUB_ORIGIN="https://dendrogeo.org";
/* DGR-YYYY-NNNN: yayın kimliğinin TEK kabul edilen biçimi. */
const DG_PUB_ID=/^DGR-\d{4}-\d{4}$/;
const DG_PUB_POLL_MS=25000;      /* bekleyen istek varken tazeleme aralığı */
const DG_PUB_POLL_MAX=80;        /* ~33 dk; sonra elle 🔄 Yenile */

function dgPubAdmin(){return !!(typeof PROFILE!=="undefined"&&PROFILE&&(PROFILE.role==="admin"||PROFILE.role==="owner"));}
function dgPubUrl(reportId){return DG_PUB_ID.test(String(reportId||""))?DG_PUB_ORIGIN+"/rapor/"+reportId+"/":"";}

/* ---------- okuma ---------- */
async function dgPubFetchQueue(){
 try{
  /* ?_=… : sw.js aynı-köken JSON'u stale-while-revalidate ile sunar; sorgu
   * anahtarı her çağrıda değiştiği için durum HER zaman ağdan gelir. */
  const r=await fetch(DG_PUB_QUEUE_URL+"?_="+Date.now(),{cache:"no-store"});
  if(!r.ok)return null;
  const j=await r.json();
  return (j&&Array.isArray(j.entries))?j:null;
 }catch(e){return null;}
}

async function dgPubFetchRequests(){
 const{data,error}=await sb.from("report_requests")
  .select("id,park_id,with_lulc,status,note,created_at,cancelled_at")
  .order("created_at",{ascending:false}).limit(50);
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
 const{data,error}=await sb.from("v_park_compare").select("*").order("carbon_kg",{ascending:false});
 if(error||!data)return [];
 /* park_pending / park_id=0 satırları OSM kimliği olmayan proje kümeleridir:
  * rapor park poligonu ister, bu yüzden listede gösterilmezler. */
 return data.filter(r=>Number(r.park_id)>0&&!r.park_pending&&Number(r.records)>0);
}

/* Geri çekme istekleri (0010): tablo yoksa (0010 uygulanmamış) SESSİZCE boş
 * liste — yayın akışı bundan etkilenmez, 🗑 isteği sunucuda zaten reddedilir. */
async function dgPubFetchRetractions(){
 try{
  const{data,error}=await sb.from("report_retractions")
   .select("id,report_id,park_id,reason,status,requested_by,created_at")
   .order("created_at",{ascending:false}).limit(50);
  if(error)return[];
  return data||[];
 }catch(e){return[];}
}

/* ---------- durum birleştirme: istek (DB) + sonuç (repo günlüğü) ---------- */
function dgPubEntryFor(reqId){
 const es=(DG_PUB_STATE.queue&&DG_PUB_STATE.queue.entries)||[];
 for(let i=es.length-1;i>=0;i--)if(String(es[i].request_id)===String(reqId))return es[i];
 return null;
}
/* GERİ ÇEKME FİLTRESİ (0010): günlükte 'Geri çekildi' kaydı olan rapor artık
 * "yayınlandı" sayılmaz — bağlantısı kurulmaz, listeden düşer, yerine durum
 * rozeti geçer. Kimlik biçimi burada da DOĞRULANIR (dgPubUrl tek kapı). */
function dgPubRetractedIds(queue){
 const out={};
 for(const e of ((queue&&queue.entries)||[]))
  if(e.status==="Geri çekildi"&&DG_PUB_ID.test(String(e.report_id||"")))out[String(e.report_id)]=e;
 return out;
}
function dgPubRetractDone(queue,retId){
 for(const e of ((queue&&queue.entries)||[]))
  if(e.status==="Geri çekildi"&&String(e.retraction_id)===String(retId))return e;
 return null;
}
function dgPubRetractedInPark(queue,parkId){
 const es=(queue&&queue.entries)||[];
 for(let i=es.length-1;i>=0;i--){
  const e=es[i];
  if(e.status==="Geri çekildi"&&String(e.park_id)===String(parkId))return e;
 }
 return null;
}
function dgPubPublishedByPark(){
 const ret=dgPubRetractedIds(DG_PUB_STATE.queue);
 const out={};
 for(const e of ((DG_PUB_STATE.queue&&DG_PUB_STATE.queue.entries)||[])){
  if(e.status==="Yayınlandı"&&DG_PUB_ID.test(String(e.report_id||""))&&!ret[String(e.report_id)])out[String(e.park_id)]=e;
 }
 return out;
}
function dgPubStatus(req){
 const e=dgPubEntryFor(req.id);
 /* Günlük herkese açık: kimlik biçimi doğrulanmadan ekrana/bağlantıya geçmez. */
 if(e&&e.status==="Yayınlandı")return{key:"published",label:"Yayınlandı",reportId:DG_PUB_ID.test(String(e.report_id||""))?e.report_id:"",note:"yayın "+String(e.finished_at||"").slice(0,10),entry:e};
 if(e&&e.status==="Başarısız")return{key:"failed",label:"Başarısız",reportId:"",note:String(e.message||"üretim hatası"),entry:e};
 if(req.status==="Vazgeçildi")return{key:"cancelled",label:"Vazgeçildi",reportId:"",note:"iptal "+String(req.cancelled_at||"").slice(0,10),entry:null};
 const dk=Math.max(0,Math.round((Date.now()-new Date(req.created_at||Date.now()).getTime())/60000));
 return{key:"pending",label:"Beklemede",reportId:"",
  note:(dk<1?"az önce kuyruğa alındı":dk+" dk önce kuyruğa alındı"),entry:null};
}

/* ---------- çizim ---------- */
function dgPubRender(){
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
  /* Bekleyen istek = DB'de 'Beklemede' VE günlükte sonucu henüz yok. */
  const req=st.requests.find(r=>String(r.park_id)===pid&&r.status==="Beklemede"&&!dgPubEntryFor(r.id));
  const last=st.requests.find(r=>String(r.park_id)===pid);
  const pub=pubByPark[pid];
  const retPend=(st.retractions||[]).find(x=>String(x.park_id)===pid&&x.status==="Beklemede"&&!dgPubRetractDone(st.queue,x.id));
  const retPark=dgPubRetractedInPark(st.queue,pid);
  let stt="none",rid="",note="";
  if(req){
   stt="pending";
   const s=dgPubStatus(req);
   note=esc(s.note)+" · yayın işi 5 dakikada bir çalışır";
  }else if(pub){
   stt=retPend?"retracting":"published";rid=pub.report_id;
   note=retPend?dgCf("🗑 geri çekme isteği kuyrukta — birkaç dakika içinde yayından kalkar")
    :esc(rid||"—")+(pub.finished_at?(" · "+dgCf("yayın")+" "+String(pub.finished_at).slice(0,10)):"");
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
   return '<div style="padding:5px 0;border-bottom:1px solid var(--line);font-size:.78rem">'+
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
  return '<div style="padding:5px 0;border-bottom:1px solid var(--line);font-size:.78rem">'+
   (ok?"✅ ":"❌ ")+"<b>"+esc(rid)+"</b> · "+esc(e.park_name||("park #"+e.park_id))+
   (ok?(" · n="+Number(e.n||0)+" · "+esc(e.carbon_txt||"")):(" · "+esc(String(e.message||"").slice(0,120))))+
   (u?(' · <a href="'+esc(u)+'" target="_blank" rel="noopener">bağlantı</a>'):"")+
   '<div class="dg-tree-meta">istek '+esc(String(e.request_id||"").slice(0,8))+" · "+esc(String(e.finished_at||"").slice(0,16).replace("T"," "))+"</div></div>";
 }).join("");

 const pending=st.requests.filter(r=>r.status==="Beklemede"&&!dgPubEntryFor(r.id)).length;
 box.innerHTML=
  (st.error?'<div class="alert err">⚠ '+esc(st.error)+"</div>":"")+
  (st.queue===null?'<div class="alert info">ℹ Yayın günlüğü okunamadı (çevrimdışı ya da dosya henüz yayınlanmadı). İstek gönderimi çalışır; durum alanı boş kalır.</div>':"")+
  (pending>0?'<div class="alert info">⏳ <b>'+pending+" "+dgCf("istek kuyrukta.")+"</b> "+dgCf("Yayın işi 5 dakikada bir çalışır (GitHub yoğunluğunda 15 dakikayı bulabilir); bu kart kendini 25 saniyede bir tazeler, bağlantı burada görünür. Sekmeyi kapatmanız işi durdurmaz.")+"</div>":"")+
  '<div class="tblwrap"><table class="dg-cards">'+
  "<thead><tr><th scope='col'>Park</th><th scope='col'>Kayıt</th><th scope='col'>Karbon</th><th scope='col'>Alan</th><th scope='col'>Yayın durumu</th><th scope='col'>İşlem</th></tr></thead><tbody>"+
  (rows||'<tr><td colspan=6>Onaylı ölçümü olan park yok — önce ölçüm onaylayın.</td></tr>')+
  "</tbody></table></div>"+
  '<div class="lbl" style="margin:14px 0 4px">📜 Yayın günlüğü (son işler)</div>'+
  (hist||'<div class="dg-tree-meta">Henüz işlenmiş istek yok. Günlük: <span class="mono">rapor/yayin-kuyrugu.json</span></div>')+
  '<div class="dg-parkadmin-note" style="margin-top:10px">📄 Yayınla = istek kuyruğa yazılır; rapor tez biçiminde üretilir, içerik hash\'i ile dondurulur ve <span class="mono">/rapor/DGR-…/</span> altında kalıcı bağlantı alır. '+
  'Eski raporlar DEĞİŞMEZ: yeni çözümleme yeni kimlik demektir. 🛰 kutusu işaretliyken §5 arazi örtüsü sonuçları da üretilir (birkaç dakika sürer). '+
  '🗑 Geri çek = yanlışlıkla yayımlanan rapor yayından kaldırılır: veri dosyaları silinir, adresinde gerekçeli bildirim kalır, DGR kimliği yeniden KULLANILMAZ; işlem günlüğe ve git geçmişine yazılır.</div>';
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
 const txt=String(r.txt||"");
 if(!r.status||/^NETWORK/.test(txt))return"Ağ hatası: "+txt.replace(/^NETWORK\s*/,"").slice(0,160);
 if(/does not exist|42P01/i.test(txt)||r.status===404)return"0008_report_publish.sql çalıştırılmalı (report_requests tablosu yok).";
 if(/duplicate key|23505/i.test(txt))return dgCf("Bu park için bekleyen bir istek zaten var — kuyruktaki iş bitsin.");
 if(/REPORT_QUOTA|DG0QT/i.test(txt))return"Günlük yayın isteği sınırına ulaştın (24 saatte 3) — sonra yeniden dene.";
 if(/REPORT_NOT_YOUR_PARK|DG0NP/i.test(txt))return"Bu park senin projene bağlı değil — yalnız kendi parkının raporunu yayınlayabilirsin.";
 if(/REPORT_NO_OWN_DATA|DG0ND/i.test(txt))return"Bu parkta onaylı ölçümün yok — ölçümlerin onaylanınca yayın isteyebilirsin.";
 if(/REPORT_NOT_SELF|DG0NS/i.test(txt))return"Yayın isteği yalnız kendi adına açılabilir.";
 if(/REPORT_NO_DATA|DGR0RD|22023/i.test(txt))return"Bu parkta onaylı ölçüm yok; rapor üretilemez.";
 if(/42501|401|403|row-level|permission/i.test(txt))return"Yetki yok: bu park için yayın isteği açamazsın.";
 return"İstek yazılamadı (HTTP "+r.status+"): "+txt.slice(0,160);
}

async function dgPublishReport(parkId){
 if(!dgPubAdmin())return toast("Rapor yayını yalnız yönetici içindir.","err","📄");
 const lulc=$("dgPubLulc")?$("dgPubLulc").checked!==false:true;
 const r=await dgPubInsertRequest(parkId,lulc,"uygulama içi yayın");
 if(r.ok){
  toast("📄 Yayın isteği kuyruğa alındı — rapor birkaç dakika içinde burada bağlanacak.","ok","📄");
  DG_PUB_STATE.pollCount=0;
  await dgLoadPublishQueue();
  dgPubSchedulePoll();
  return;
 }
 const msg=dgPubInsertError(r);
 if(/0008_report_publish/.test(msg))DG_PUB_STATE.error="SCHEMA";
 toast(msg,"err","📄");
 dgPubRender();
}

async function dgPublishCancel(id){
 if(!dgPubAdmin())return toast("Yalnız yönetici iptal edebilir.","err","📄");
 if(!confirm(dgCf("Bekleyen yayın isteği iptal edilsin mi?")))return;
 const{error}=await sb.from("report_requests").update({status:"Vazgeçildi",cancelled_at:new Date().toISOString()}).eq("id",id);
 if(error)return toast(dgCf("İptal edilemedi: ")+esc(error.message),"err","📄");
 toast("İstek iptal edildi.","ok","📄");
 await dgLoadPublishQueue();
}

/* ---------- GERİ ÇEKME (0010): yayımlanmış rapor yayından kaldırılır ----------
 * Bilimsel teamül: SESSİZ SİLME YOK — istek kuyruğa yazılır, Actions işi
 * veri dosyalarını kaldırır, adresinde gerekçeli bildirim bırakır, günlük
 * 'Geri çekildi' kaydı alır. DGR kimliği yeniden kullanılmaz.
 * YETKİ SUNUCUDA: yönetici herhangi bir raporu; kullanıcı YALNIZ kendi
 * projesinin parkının raporunu geri çekebilir (RLS + tg_report_retraction_gate).
 * report_id ↔ park_id eşleşmesini Actions günlükle ayrıca doğrular. */
async function dgRetractInsert(reportId,parkId,reason){
 let token=SB_KEY;
 try{const{data}=await sb.auth.getSession();if(data&&data.session&&data.session.access_token)token=data.session.access_token;}catch(e){}
 try{
  const r=await fetch(SB_URL+"/rest/v1/report_retractions",{
   method:"POST",
   headers:{"apikey":SB_KEY,"Authorization":"Bearer "+token,"Content-Type":"application/json","Prefer":"return=minimal"},
   body:JSON.stringify([{report_id:String(reportId),park_id:Number(parkId),reason:reason||null,status:"Beklemede",
    requested_by:(typeof USER!=="undefined"&&USER&&USER.id)||null}])
  });
  const ok=r.status===201||r.status===200;
  const txt=ok?"":((await r.text().catch(()=> ""))||"");
  return{ok:ok,status:r.status,txt:txt};
 }catch(e){return{ok:false,status:0,txt:"NETWORK "+((e&&e.message)||e)};}
}

function dgRetractError(r){
 const txt=String(r.txt||"");
 if(!r.status||/^NETWORK/.test(txt))return "Ağ hatası: "+txt.replace(/^NETWORK\s*/,"").slice(0,160);
 if(/does not exist|42P01/i.test(txt)||r.status===404)return "Geri çekme kuyruğu kurulu değil: Supabase SQL Editor'da 0010_report_retraction.sql çalıştırılmalı.";
 if(/RETRACT_BAD_ID|DG0RF/i.test(txt))return "Rapor kimliği geçersiz (DGR-YYYY-NNNN bekleniyor).";
 if(/RETRACT_DUPLICATE|DG0RD|duplicate key|23505/i.test(txt))return "Bu rapor için bekleyen bir geri çekme isteği zaten var.";
 if(/RETRACT_QUOTA|DG0RQ/i.test(txt))return "Günlük geri çekme sınırına ulaştın (24 saatte 3) — sonra yeniden dene.";
 if(/RETRACT_NOT_YOUR_PARK|DG0RP/i.test(txt))return "Bu park senin projene bağlı değil — yalnız kendi parkının yayınını geri çekebilirsin.";
 if(/RETRACT_NOT_SELF|DG0RN/i.test(txt))return "Geri çekme isteği yalnız kendi adına açılabilir.";
 if(/RETRACT_INACTIVE|DG0RI/i.test(txt))return "Hesabın etkin değil.";
 if(/42501|401|403|row-level|permission/i.test(txt))return "Yetki yok: bu rapor için geri çekme isteği açamazsın.";
 return "İstek yazılamadı (HTTP "+r.status+"): "+txt.slice(0,160);
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
 const box=$("dgUserPubBox");if(!box)return;
 if(typeof USER==="undefined"||!USER)return toast("Önce giriş yap.","err","📄");
 const list=(typeof PROJ_LIST!=="undefined"&&Array.isArray(PROJ_LIST))?PROJ_LIST:[];
 const p=list.find(x=>Number(x.id)===Number(projectId));
 if(!p)return toast("Proje bulunamadı — listeden yeniden dene.","err","📄");
 if(!p.park_id)return toast("Bu proje bir parka bağlı değil — rapor park kimliği ister.","err","🌳");
 if(DG_USER_PUB.timer){clearInterval(DG_USER_PUB.timer);DG_USER_PUB.timer=0;}
 DG_USER_PUB.projectId=Number(p.id);
 DG_USER_PUB.parkId=Number(p.park_id);
 DG_USER_PUB.parkName=(p.parks&&p.parks.name)||p.park_name||("park #"+p.park_id);
 DG_USER_PUB.requests=[];DG_USER_PUB.retracts=[];DG_USER_PUB.error="";DG_USER_PUB.ownApproved=null;DG_USER_PUB.polls=0;
 box.style.display="";
 box.innerHTML='<div class="dg-tree-meta">⏳ Rapor durumu yükleniyor…</div>';
 if(box.scrollIntoView)box.scrollIntoView({behavior:"smooth",block:"nearest"});
 await dgUserPubRefresh();
}

async function dgUserPubRefresh(){
 const st=DG_USER_PUB;if(!st.parkId)return;
 try{
  const{data,error}=await sb.from("report_requests")
   .select("id,park_id,with_lulc,status,requested_by,created_at,cancelled_at")
   .eq("park_id",st.parkId).order("created_at",{ascending:false}).limit(10);
  if(error){
   st.error=(error.code==="42P01"||/report_requests/i.test(error.message||""))
    ?"SCHEMA"
    :("İstekler okunamadı: "+(error.message||error.code||"bilinmeyen hata"));
   st.requests=[];
  }else{st.error="";st.requests=data||[];}
 }catch(e){st.error="İstekler okunamadı: "+((e&&e.message)||e);st.requests=[];}
 const[q,cnt,rets]=await Promise.all([dgPubFetchQueue(),dgUserOwnApproved(),dgUserFetchRetractions()]);
 if(q)st.queue=q;
 st.ownApproved=cnt;
 st.retracts=rets||[];
 dgUserPubRender();
 dgUserPubSchedulePoll();
}

/* Bu projedeki kendi onaylı ölçüm sayısı (yalnız BİLGİ: yayın kararını
 * sunucu verir — aynı parktaki başka projenin onaylı verisi de yeter). */
async function dgUserOwnApproved(){
 if(typeof USER==="undefined"||!USER||!DG_USER_PUB.projectId)return null;
 try{
  const{count}=await sb.from("measurements").select("*",{count:"exact",head:true})
   .eq("project_id",DG_USER_PUB.projectId).eq("owner",USER.id).eq("status","Onaylı").is("deleted_at",null);
  return Number(count||0);
 }catch(e){return null;}
}

/* Bu parkın geri çekme istekleri (0010): tablo yoksa sessizce boş — panel
 * yayın durumunu göstermeye devam eder, 🗑 sunucuda zaten reddedilir. */
async function dgUserFetchRetractions(){
 if(!DG_USER_PUB.parkId)return[];
 try{
  const{data,error}=await sb.from("report_retractions")
   .select("id,report_id,park_id,reason,status,requested_by,created_at")
   .eq("park_id",DG_USER_PUB.parkId).order("created_at",{ascending:false}).limit(10);
  if(error)return[];
  return data||[];
 }catch(e){return[];}
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
 const last=st.requests[0]||null;

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
 const lulc=(!pend&&!retPend)?'<label style="font-size:.78rem;color:var(--mut);display:inline-flex;gap:6px;align-items:center"><input type="checkbox" id="dgUserPubLulc" checked> 🛰 Arazi örtüsü bölümü (§5) dahil — önerilir</label>':"";

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
 const r=await dgPubInsertRequest(parkId,lulc,"kullanıcı yayını (proje #"+(DG_USER_PUB.projectId||0)+")");
 if(r.ok){
  toast("📄 Yayın isteği kuyruğa alındı — rapor birkaç dakika içinde burada bağlanacak.","ok","📄");
  DG_USER_PUB.polls=0;
  await dgUserPubRefresh();
  return;
 }
 const msg=dgPubInsertError(r);
 if(/0008_report_publish/.test(msg))DG_USER_PUB.error="SCHEMA";
 toast(msg,"err","📄");
 dgUserPubRender();
}

async function dgUserCancel(id){
 const mine=(typeof USER!=="undefined"&&USER&&USER.id)||"";
 const row=DG_USER_PUB.requests.find(r=>String(r.id)===String(id));
 const own=!!(row&&String(row.requested_by||"")===String(mine));
 if(!own&&!dgPubAdmin())return toast("Yalnız kendi bekleyen isteğini iptal edebilirsin.","err","📄");
 if(!confirm(dgCf("Bekleyen yayın isteği iptal edilsin mi?")))return;
 const{error}=await sb.from("report_requests").update({status:"Vazgeçildi",cancelled_at:new Date().toISOString()}).eq("id",id);
 if(error)return toast(dgCf("İptal edilemedi: ")+esc(error.message),"err","📄");
 toast("İstek iptal edildi.","ok","📄");
 await dgUserPubRefresh();
}

/* Kendi bekleyen isteği varken ve panel görünürken 25 sn'de bir sessiz tazeleme
 * (yönetici kartındaki dgPubSchedulePoll ile aynı desen ve sınırlar). */
function dgUserPubSchedulePoll(){
 if(DG_USER_PUB.timer){clearInterval(DG_USER_PUB.timer);DG_USER_PUB.timer=0;}
 const mine=(typeof USER!=="undefined"&&USER&&USER.id)||"";
 const waiting=DG_USER_PUB.requests.some(r=>r.status==="Beklemede"&&String(r.requested_by||"")===String(mine)&&!dgPubEntryIn(DG_USER_PUB.queue,r.id))
  ||(DG_USER_PUB.retracts||[]).some(x=>x.status==="Beklemede"&&String(x.requested_by||"")===String(mine)&&!dgPubRetractDone(DG_USER_PUB.queue,x.id));
 if(!waiting||DG_USER_PUB.polls>=DG_PUB_POLL_MAX)return;
 DG_USER_PUB.timer=setInterval(async()=>{
  DG_USER_PUB.polls++;
  const v=$("v-projects");
  if(v&&!v.classList.contains("on"))return;      /* sekme kapalı: ağ isteği atma */
  if(document.hidden)return;                       /* arka plan sekmesi: bekle */
  const box=$("dgUserPubBox");
  if(!box||box.style.display==="none")return;      /* panel kapalı: bekle */
  await dgUserPubRefresh();
 },DG_PUB_POLL_MS);
}

function dgUserPubClose(){
 if(DG_USER_PUB.timer){clearInterval(DG_USER_PUB.timer);DG_USER_PUB.timer=0;}
 DG_USER_PUB.projectId=0;DG_USER_PUB.parkId=0;
 const box=$("dgUserPubBox");
 if(box){box.style.display="none";box.innerHTML="";}
}

/* loadProjects() her çizimde çağırır: paneli açık proje listeden silindiyse
 * (proje silindi) panel kapanır — hayalet durum gösterilmez. */
function dgUserPubSync(list){
 if(!DG_USER_PUB.projectId)return;
 const arr=Array.isArray(list)?list:[];
 if(!arr.some(p=>Number(p.id)===DG_USER_PUB.projectId))dgUserPubClose();
}

/* ---------- paylaş ---------- */
async function dgReportShare(reportId,parkName){
 const url=dgPubUrl(reportId);
 if(!url)return toast("Bağlantı kurulamadı: rapor kimliği geçersiz.","err","📄");
 const title=(parkName?parkName+" — ":"")+"DendroGeo bilimsel rapor "+reportId;
 const text=title+" · karbon stoku, belirsizlik aralığı ve doğrulama izleri";
 try{
  if(navigator.share){await navigator.share({title:title,text:text,url:url});return;}
 }catch(e){/* kullanıcı vazgeçti ya da API yok → pano yedeği */}
 try{
  await navigator.clipboard.writeText(url);
  toast(dgCf("🔗 Bağlantı kopyalandı: ")+url,"ok","📄");
 }catch(e){window.prompt("Bağlantıyı kopyalayın (Ctrl+C):",url);}
}

function dgReportOpen(reportId){
 const url=dgPubUrl(reportId);
 if(!url)return toast("Bağlantı kurulamadı: rapor kimliği geçersiz.","err","📄");
 window.open(url,"_blank","noopener");
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
