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
 *   · İstek yazma YALNIZ yönetici (RLS + tg_report_request_gate); arayüz de
 *     yönetici sekmesinde durur, ayrıca istemcide dgPubAdmin() kapısı var.
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
let DG_PUB_STATE={parks:[],requests:[],queue:null,queueAt:0,error:"",loading:false,pollTimer:0,pollCount:0};

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

/* ---------- durum birleştirme: istek (DB) + sonuç (repo günlüğü) ---------- */
function dgPubEntryFor(reqId){
 const es=(DG_PUB_STATE.queue&&DG_PUB_STATE.queue.entries)||[];
 for(let i=es.length-1;i>=0;i--)if(String(es[i].request_id)===String(reqId))return es[i];
 return null;
}
function dgPubPublishedByPark(){
 const out={};
 for(const e of ((DG_PUB_STATE.queue&&DG_PUB_STATE.queue.entries)||[])){
  if(e.status==="Yayınlandı"&&DG_PUB_ID.test(String(e.report_id||"")))out[String(e.park_id)]=e;
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
 if(clock)clock.textContent=st.queueAt?("son kontrol "+new Date(st.queueAt).toLocaleTimeString("tr-TR")):"—";

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
  let stt="none",rid="",note="";
  if(req){
   stt="pending";
   const s=dgPubStatus(req);
   note=esc(s.note)+" · yayın işi 5 dakikada bir çalışır";
  }else if(pub){
   stt="published";rid=pub.report_id;
   note=esc(rid||"—")+(pub.finished_at?(" · yayın "+String(pub.finished_at).slice(0,10)):"");
  }else if(last){
   const s=dgPubStatus(last);
   stt=s.key;rid=s.reportId||"";
   note=(s.key==="failed"?"⚠ ":"")+esc(String(s.note||"").slice(0,140));
  }
  const badge=stt==="published"?'<span class="badge on">Yayınlandı</span>'
   :stt==="pending"?'<span class="badge admin">Beklemede</span>'
   :stt==="failed"?'<span class="badge off">Başarısız</span>'
   :stt==="cancelled"?'<span class="badge off">Vazgeçildi</span>'
   :'<span class="badge off">Yayın yok</span>';
  const url=dgPubUrl(rid);

  const act=[];
  if(url){
   act.push('<button class="btn sm blue" onclick="dgReportOpen(\''+rid+'\')" title="Raporu yeni sekmede aç">🔗 Aç</button>');
   act.push('<button class="btn sm" onclick="dgReportShare(\''+rid+'\')" title="Bağlantıyı paylaş / panoya kopyala">📤 Paylaş</button>');
  }
  if(stt==="pending"){
   act.push('<button class="btn sm red" onclick="dgPublishCancel(\''+esc(req.id)+'\')" title="Bekleyen isteği iptal et">✖ Vazgeç</button>');
  }else{
   act.push('<button class="btn sm amber" onclick="dgPublishReport('+Number(p.park_id)+')" title="'+
    (stt==="published"?"Yeni sürüm yayınla: eski rapor değişmez, yeni DGR kimliği alır":"Bilimsel raporu yayınla")+'">'+
    (stt==="published"?"📄 Yeni sürüm":"📄 Yayınla")+"</button>");
  }

  return "<tr>"+
   '<td data-label="Park"><b>'+esc(p.park_name)+"</b>"+
    '<div class="dg-tree-meta">'+esc(p.city||"—")+" · "+Number(p.species_n||0)+" tür · "+Number(p.contributors||0)+" katkı</div></td>"+
   '<td data-label="Kayıt" class="mono">'+Number(p.records||0)+"</td>"+
   '<td data-label="Karbon">'+(Number(p.carbon_kg||0)/1000).toFixed(2)+" t</td>"+
   '<td data-label="Alan">'+(typeof dgFmtHa==="function"?dgFmtHa(p.area_m2):"—")+"</td>"+
   '<td data-label="Yayın durumu">'+badge+'<div class="dg-tree-meta">'+note+"</div></td>"+
   '<td data-label="İşlem"><div class="dg-act">'+act.join("")+"</div></td>"+
  "</tr>";
 }).join("");

 const hist=((st.queue&&st.queue.entries)||[]).slice(-6).reverse().map(e=>{
  const ok=e.status==="Yayınlandı";
  const u=dgPubUrl(e.report_id);
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
  (pending>0?'<div class="alert info">⏳ <b>'+pending+" istek kuyrukta.</b> Yayın işi 5 dakikada bir çalışır (GitHub yoğunluğunda 15 dakikayı bulabilir); bu kart kendini 25 saniyede bir tazeler, bağlantı burada görünür. Sekmeyi kapatmanız işi durdurmaz.</div>":"")+
  '<div class="tblwrap"><table class="dg-cards">'+
  "<thead><tr><th>Park</th><th>Kayıt</th><th>Karbon</th><th>Alan</th><th>Yayın durumu</th><th>İşlem</th></tr></thead><tbody>"+
  (rows||'<tr><td colspan=6>Onaylı ölçümü olan park yok — önce ölçüm onaylayın.</td></tr>')+
  "</tbody></table></div>"+
  '<div class="lbl" style="margin:14px 0 4px">📜 Yayın günlüğü (son işler)</div>'+
  (hist||'<div class="dg-tree-meta">Henüz işlenmiş istek yok. Günlük: <span class="mono">rapor/yayin-kuyrugu.json</span></div>')+
  '<div class="dg-parkadmin-note" style="margin-top:10px">📄 Yayınla = istek kuyruğa yazılır; rapor tez biçiminde üretilir, içerik hash\'i ile dondurulur ve <span class="mono">/rapor/DGR-…/</span> altında kalıcı bağlantı alır. '+
  'Eski raporlar DEĞİŞMEZ: yeni çözümleme yeni kimlik demektir. 🛰 kutusu işaretliyken §4 arazi örtüsü bağlamı da üretilir (birkaç dakika sürer).</div>';
}

/* ---------- yazma ---------- */
async function dgPublishReport(parkId){
 if(!dgPubAdmin())return toast("Rapor yayını yalnız yönetici içindir.","err","📄");
 const lulc=$("dgPubLulc")?$("dgPubLulc").checked!==false:true;
 /* RLS-safe insert (trackVisit ile aynı desen): "Prefer: return=minimal" —
  * return=representation olsaydı RETURNING satırı politikaya takılıp istek
  * sessizce ölebilirdi. Oturum anahtarı şart: anon istek açamaz. */
 let token=SB_KEY;
 try{const{data}=await sb.auth.getSession();if(data&&data.session&&data.session.access_token)token=data.session.access_token;}catch(e){}
 let r=null;
 try{
  r=await fetch(SB_URL+"/rest/v1/report_requests",{
   method:"POST",
   headers:{"apikey":SB_KEY,"Authorization":"Bearer "+token,"Content-Type":"application/json","Prefer":"return=minimal"},
   body:JSON.stringify([{park_id:Number(parkId),with_lulc:lulc,status:"Beklemede",
    requested_by:(typeof USER!=="undefined"&&USER&&USER.id)||null,note:"uygulama içi yayın"}])
  });
 }catch(e){return toast("Ağ hatası: "+esc(e.message),"err","📄");}
 if(r.status===201||r.status===200){
  toast("📄 Yayın isteği kuyruğa alındı — rapor birkaç dakika içinde burada bağlanacak.","ok","📄");
  DG_PUB_STATE.pollCount=0;
  await dgLoadPublishQueue();
  dgPubSchedulePoll();
  return;
 }
 const txt=(await r.text().catch(()=>""))||"";
 const msg=(/does not exist|42P01/i.test(txt)||r.status===404)
  ? "0008_report_publish.sql çalıştırılmalı (report_requests tablosu yok)."
  : /duplicate key|23505/i.test(txt)
  ? "Bu park için bekleyen bir istek zaten var — kuyruktaki iş bitsin."
  : /22023|REPORT_NO_DATA/i.test(txt)
  ? "Bu parkta onaylı ölçüm yok; rapor üretilemez."
  : /42501|401|403|row-level|permission/i.test(txt)
  ? "Yetki yok: yayın isteğini yalnız yönetici açabilir."
  : ("İstek yazılamadı (HTTP "+r.status+"): "+txt.slice(0,160));
 if(/0008_report_publish/.test(msg))DG_PUB_STATE.error="SCHEMA";
 toast(msg,"err","📄");
 dgPubRender();
}

async function dgPublishCancel(id){
 if(!dgPubAdmin())return toast("Yalnız yönetici iptal edebilir.","err","📄");
 if(!confirm("Bekleyen yayın isteği iptal edilsin mi?"))return;
 const{error}=await sb.from("report_requests").update({status:"Vazgeçildi",cancelled_at:new Date().toISOString()}).eq("id",id);
 if(error)return toast("İptal edilemedi: "+esc(error.message),"err","📄");
 toast("İstek iptal edildi.","ok","📄");
 await dgLoadPublishQueue();
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
  toast("🔗 Bağlantı kopyalandı: "+url,"ok","📄");
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
  const [parks,requests,queue]=await Promise.all([dgPubFetchParks(),dgPubFetchRequests(),dgPubFetchQueue()]);
  DG_PUB_STATE.parks=parks;
  DG_PUB_STATE.requests=requests;
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
 const waiting=DG_PUB_STATE.requests.some(r=>r.status==="Beklemede"&&!dgPubEntryFor(r.id));
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
