"use strict";
/* DendroGeo · services/backup.js — TAM YEDEK + HATIRLATICI (Faz 6)
 * admin.js'ten birebir taşındı: fetchAllRows (sayfalı tam döküm),
 * fullBackup (JSON indirme), checkBackupReminder (7 gün uyarısı). */

/* ============ TAM YEDEK (JSON) — Tez verisi sigortası ============ */
async function fetchAllRows(table,orderCol){return await window.DG_BACKUP_PAGED_STORE.load(sb,table,orderCol);}

async function fullBackup(){
 return await window.DG_CREATE_FULL_BACKUP.execute(PROFILE,{
  load:(table,orderCol)=>fetchAllRows(table,orderCol),
  build:data=>window.DG_BACKUP_SNAPSHOT.build(data,{exportedAt:new Date().toISOString(),exportedBy:(PROFILE&&PROFILE.full_name)||""}),
  name:()=>"dendrogeo_yedek_"+new Date().toISOString().slice(0,10)+".json",
  download:(backup,name)=>window.DG_BACKUP_JSON_DOWNLOAD.download(window,backup,name),
  remember:()=>localStorage.setItem("dg_lastBackup",new Date().toISOString()),
  onDenied:()=>toast("Yetki yok.","err"),
  onStart:()=>toast("Yedek hazırlanıyor…","info","💾"),
  onSuccess:(name,count)=>toast((typeof dgTfs==="function"?dgTfs("✓ Veri yedeği indirildi: {f} ({n} ölçüm). Fotoğraf dosyaları ve cihazdaki kuyruk ayrı yedeklenir.",{f:name,n:count}):("✓ Yedek indirildi: "+name+" ("+count+" ölçüm)")),"ok","💾"),
  onFailure:error=>toast(dgCf("Yedek hatası: ")+error.message,"err","❌")
 });
}

function checkBackupReminder(){
  const last=localStorage.getItem("dg_lastBackup");
  const state=window.DG_BACKUP_REMINDER_STATE.evaluate(last,Date.now());
  if(state.overdue) toast(dgTfs("⚠ Son veri yedeğinin üzerinden {n} gün geçti — bugünkü yedeği alın",{n:state.elapsedDays}),"warn","💾");
}

/* ═══════════ 0036 (T3) · YEDEKTEN YÜKLE ═══════════
 * Kullanıcı isteği: "💾 Tam Yedek İndir'in yanına yedekten yükle — veriler
 * giderse geri yükleyebilelim."
 * RLS gerçeği: meas_insert owner=auth.uid() → istemci BAŞKASININ satırını
 * YAZAMAZ; measurements.id GENERATED ALWAYS → istemci özgün id de yazamaz.
 * Bu yüzden geri yükleme TEK kanaldan, TAM SADAKATLE yapılır: Supabase SQL
 * Editor (postgres rolü RLS'i atlar — migration'ların uygulandığı kanal).
 * Bu araç yedeği doğrular, özetler ve OVERRIDING SYSTEM VALUE + ON CONFLICT
 * DO NOTHING ile idempotent bir .sql dosyası üretir (kimlikler/sahipler korunur,
 * mevcut satırlar ezilmez). Migration/şema/RLS DEĞİŞMEZ (kırmızı çizgi). */
async function dgRestorePick(ev){
 const f=(ev&&ev.target&&ev.target.files&&ev.target.files[0])||null;
 try{if(ev&&ev.target)ev.target.value="";}catch(e){}
 if(!f){toast(dgCf("Yedek dosyası okunamadı."),"err","📥");return;}

 // ZIP geri yüklemesi hiçbir canlı DB kaydını otomatik değiştirmez.
 // Önce tüm fotoğraflar + 13 tablo + SHA-256 doğrulanır, sonra SQL hazırlanır.
 if(/\.zip$/i.test(f.name||"")){
  try{
   if(!PROFILE||(PROFILE.role!=="owner"&&PROFILE.role!=="admin"))throw new Error("Yönetici oturumu gerekli.");
   const parsed=await window.DG_BACKUP_JSON_DOWNLOAD.readComplete(window,f);
   const built=window.DG_BUILD_RESTORE_SQL.buildComplete(parsed.backup,v=>window.DG_BACKUP_SQL_VALUE.serialize(v));
   if(built.sql!==parsed.restoreSql)throw new Error("Arşiv SQL dosyası kayıtlarla eşleşmiyor.");
   const text="Fotoğraflı Tam Veri Arşivi doğrulandı: "+parsed.backup.counts.measurements+
    " ölçüm · "+parsed.photos.length+" fotoğraf · "+built.tables+" tablo. "+
    "Bu aşama canlı veritabanına YAZMAZ. Mevcut kayıtlar üzerine yazılmayan "+
    "SQL kurtarma dosyası indirilsin mi? Fotoğraflar ZIP içinde bulunur ve "+
    "Supabase Storage'a yetkili yerel kurtarma işlemiyle ayrıca aktarılmalıdır.";
   if(!confirm(text))return;
   const name="dendrogeo_fotografli_tam_veri_geri_yukleme_"+new Date().toISOString().slice(0,10)+".sql";
   window.DG_BACKUP_RESTORE_SQL_DOWNLOAD.download(window,built.sql,name);
   toast("✓ ZIP doğrulandı ("+parsed.photos.length+" fotoğraf, 13 tablo). Geri yükleme SQL'i indirildi; fotoğraf aktarımı için ZIP yönergelerini uygulayın.","ok","📥");
  }catch(error){toast("Fotoğraflı Tam Veri Arşivi doğrulanamadı: "+(error?.message||error),"err","❌");}
  return;
 }
 const rd=new FileReader();
 rd.onload=()=>{
  let bk=null;try{bk=JSON.parse(String(rd.result));}catch(e){bk=null;}
  if(!bk||bk.app!=="DendroGeo"||!bk.counts){toast(dgCf("Bu dosya bir DendroGeo yedeği değil."),"err","📥");return;}
  dgRestoreSQL(bk);
 };
 rd.onerror=()=>toast(dgCf("Yedek dosyası okunamadı."),"err","📥");
 rd.readAsText(f);
}
function dgSqlVal(v){
 if(window.DG_BACKUP_SQL_VALUE)return window.DG_BACKUP_SQL_VALUE.serialize(v);
 if(v===null||v===undefined)return "NULL";
 if(typeof v==="number")return Number.isFinite(v)?String(v):"NULL";
 if(typeof v==="boolean")return v?"true":"false";
 return "'"+String(v).replace(/'/g,"''")+"'";
}
function dgRestoreSQL(bk){
 if(window.DG_RESTORE_BACKUP_APPLICATION){
  return window.DG_RESTORE_BACKUP_APPLICATION.execute(bk,{
   confirm:message=>confirm(message),
   prompt:backup=>window.DG_RESTORE_BACKUP_PROMPT.build(backup,dgTfs),
   build:backup=>window.DG_BUILD_RESTORE_SQL.build(backup,dgSqlVal),
   filename:()=>"dendrogeo_geri_yukleme_"+new Date().toISOString().slice(0,10)+".sql",
   download:(sql,name)=>window.DG_BACKUP_RESTORE_SQL_DOWNLOAD.download(window,sql,name),
   onInvalid:()=>toast(dgCf("Yedek dosyası okunamadı."),"err","📥"),
   onSuccess:()=>toast(dgCf("✓ Geri yükleme SQL'i indirildi — Supabase → SQL Editor'da çalıştırın. Satırlar korunur, çakışanlar atlanır."),"ok","📥"),
   onFailure:error=>toast(dgCf("Geri yükleme hazırlanamadı: ")+(error&&error.message||error),"err","📥")
  });
 }
 try{
  const c=bk.counts||{};
  const msg=dgTfs("{m} ölçüm · {p} proje · {w} waypoint · {r} talep içeriyor (dışa aktarma: {d}). Tam geri yükleme SQL dosyası indirilsin mi? (Supabase → SQL Editor'da çalıştırılır; kimlikler ve sahipler korunur, çakışan satırlar atlanır.)",
   {m:c.measurements||0,p:c.projects||0,w:c.waypoints||0,r:c.data_requests||0,d:String(bk.exported_at||"").slice(0,10)});
  if(!confirm(msg))return;
  const tabs=[["projects",bk.projects],["measurements",bk.measurements],["waypoints",bk.waypoints],["data_requests",bk.data_requests]];
  let sql="-- DendroGeo tam geri yukleme (0036 · Yedekten Yukle araci uretti)\n"+
          "-- Yedek tarihi: "+String(bk.exported_at||"?").replace(/[\r\n]/g," ")+" · disa aktaran: "+String(bk.exported_by||"?").replace(/[\r\n]/g," ")+"\n"+
          "-- Kullanim: Supabase → SQL Editor'a yapistir → Run. Idempotenttir:\n"+
          "-- kimlikler (id/owner) korunur, mevcut satirlar ON CONFLICT DO NOTHING ile atlanir.\nBEGIN;\n";
  let n=0;
  for(const pair of tabs){
   const tab=pair[0],rows=pair[1];
   if(!Array.isArray(rows)||!rows.length)continue;
   sql+="\n-- "+tab+" ("+rows.length+" satir)\n";
   for(const r of rows){
    if(!r||typeof r!=="object")continue;
    const cols=Object.keys(r);
    if(!cols.length)continue;
    sql+="INSERT INTO public."+tab+" ("+cols.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(", ")+") OVERRIDING SYSTEM VALUE VALUES ("+cols.map(x=>dgSqlVal(r[x])).join(", ")+") ON CONFLICT DO NOTHING;\n";
    n++;
   }
  }
  sql+="\nCOMMIT;\n";
  if(!n){toast(dgCf("Yedek dosyası okunamadı."),"err","📥");return;}
  window.DG_BACKUP_RESTORE_SQL_DOWNLOAD.download(window,sql,"dendrogeo_geri_yukleme_"+new Date().toISOString().slice(0,10)+".sql");
  toast(dgCf("✓ Geri yükleme SQL'i indirildi — Supabase → SQL Editor'da çalıştırın. Satırlar korunur, çakışanlar atlanır."),"ok","📥");
 }catch(e){toast(dgCf("Geri yükleme hazırlanamadı: ")+(e&&e.message||e),"err","📥");}
}


/* ══════ Fotoğraflı Tam Veri Arşivi (13 tablo + gerçek Storage fotoğrafları)
 * Yalnız yönetici açıkça düğmeye bastığında çalışır; arka plan sorgusu yok.
 * Bilimsel/harita motorlarını, SQL şemasını ve kayıtları değiştirmez. ══════ */
let _dgPhotoArchiveBusy=false;
async function dgPhotoFullArchive(){
 if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner")){toast("Fotoğraflı arşivi yalnız yetkili yönetici oluşturabilir.","err","💾");return;}
 if(_dgPhotoArchiveBusy)return;
 _dgPhotoArchiveBusy=true;
 if(window.DG_RESTORE_BACKUP_PROMPT?.busy)window.DG_RESTORE_BACKUP_PROMPT.busy(true);
 const stage=message=>window.DG_RESTORE_BACKUP_PROMPT?.status?.(message);
 try{
  stage("13 tablo sayfalı olarak okunuyor…");
  const plan=[
   ["measurements",["created_at","id"]],["projects",["id"]],["waypoints",["id"]],
   ["data_requests",["id"]],["parks",["id"]],["surface_reviews",["park_id","owner"]],
   ["profiles",["id"]],["report_requests",["id"]],["report_retractions",["id"]],
   ["park_invites",["id"]],["park_collaborators",["park_id","user_id"]],
   ["site_metric_daily",["day","event","page","source","device","country"]],["site_visits",["id"]]
  ];
  const rows={};
  for(let i=0;i<plan.length;i++){
   const [table,columns]=plan[i];
   stage("Veriler okunuyor ("+(i+1)+"/13): "+table);
   rows[table]=await window.DG_BACKUP_PAGED_STORE.loadComplete(sb,table,columns);
  }
  const photos=await window.DG_BACKUP_PAGED_STORE.archivePhotos(sb,"dendro-photos",rows.measurements,{
   onProgress:(n,total)=>stage("Fotoğraflar indiriliyor: "+n+"/"+total+" · Tam veri arşivi hazırlanıyor…")
  });
  if(rows.measurements.some(m=>m.photo_url)&&photos.referencedCount===0)throw new Error("Ölçümlerde fotoğraf var ancak hiçbir dosya eşleştirilemedi.");
  stage("Fotoğraflar doğrulanıyor ve ZIP oluşturuluyor…");
  const when=new Date().toISOString(),backup=window.DG_BACKUP_SNAPSHOT.buildComplete({
   ...rows,requests:rows.data_requests
  },{exportedAt:when,exportedBy:(PROFILE&&PROFILE.full_name)||""});
  const generated=window.DG_BUILD_RESTORE_SQL.buildComplete(backup,v=>window.DG_BACKUP_SQL_VALUE.serialize(v));
  const date=when.slice(0,10),name="dendrogeo_fotografli_tam_veri_arsivi_"+date+".zip";
  const result=await window.DG_BACKUP_JSON_DOWNLOAD.downloadComplete(window,backup,photos,name,generated.sql);
  localStorage.setItem("dg_lastPhotoArchive",when);
  localStorage.setItem("dg_lastBackup",when);
  stage("✓ "+rows.measurements.length+" ölçüm, "+photos.photos.length+" fotoğraf · "+name);
  toast("✓ Fotoğraflı Tam Veri Arşivi indirildi: "+name+" ("+photos.photos.length+" gerçek fotoğraf, 13 tablo).","ok","💾");
  return result;
 }catch(error){
  stage("❌ Arşiv tamamlanamadı; eksik dosya indirilmedi.");
  toast("Fotoğraflı Tam Veri Arşivi hatası: "+(error?.message||error),"err","❌");
  return{ok:false,error};
 }finally{_dgPhotoArchiveBusy=false;window.DG_RESTORE_BACKUP_PROMPT?.busy?.(false);}
}
