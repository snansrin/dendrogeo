"use strict";
/* Independent, deliberate local archive/restore page. Does not touch the
 * frozen DendroGeo main app, scientific engine, GIS tools or user records. */
(()=>{
 const $=id=>document.getElementById(id);
 const download=$("dgArchiveDownload"),picker=$("dgArchiveFile");
 let busy=false;
 function status(message,isError=false){
  $("dgArchiveStatus").textContent=message;
  $("dgArchiveStatus").dataset.state=isError?"error":"info";
 }
 function freeze(value){
  busy=value;download.disabled=value;
  $("dgArchiveRestorePick").disabled=value;
 }
 async function adminSession(){
  if(typeof sb==="undefined")throw new Error("Supabase bağlantısı bulunamadı.");
  const {data,error}=await sb.auth.getUser();
  if(error||!data?.user)throw new Error("Önce DendroGeo ana sayfasından giriş yapın.");
  const user=data.user;
  const profile=await sb.from("profiles").select("role,full_name").eq("id",user.id).single();
  if(profile.error||!profile.data||!["owner","admin"].includes(profile.data.role))
   throw new Error("Tam veri arşivi yalnız yetkili yönetici hesabıyla oluşturulabilir.");
  return profile.data;
 }
 const plan=[
  ["measurements",["created_at","id"]],["projects",["id"]],["waypoints",["id"]],
  ["data_requests",["id"]],["parks",["id"]],["surface_reviews",["park_id","owner"]],
  ["profiles",["id"]],["report_requests",["id"]],["report_retractions",["id"]],
  ["park_invites",["id"]],["park_collaborators",["park_id","user_id"]],
  ["site_metric_daily",["day","event","page","source","device","country"]],["site_visits",["id"]]
 ];
 async function makeArchive(){
  if(busy)return;
  freeze(true);
  try{
   status("Yönetici oturumu doğrulanıyor…");
   const profile=await adminSession();
   const rows={};
   for(let i=0;i<plan.length;i++){
    const [table,order]=plan[i];
    status("13 tablo okunuyor ("+(i+1)+"/13): "+table);
    rows[table]=await window.DG_BACKUP_PAGED_STORE.loadComplete(sb,table,order);
   }
   status("Storage fotoğraf envanteri doğrulanıyor…");
   const storage=await window.DG_BACKUP_PAGED_STORE.archivePhotos(sb,"dendro-photos",rows.measurements,{
    maxBytes:536870912,
    onProgress:(n,total)=>status("Gerçek fotoğraf dosyaları indiriliyor: "+n+"/"+total)
   });
   if(rows.measurements.some(row=>row.photo_url)&&storage.referencedCount===0)
    throw new Error("Ölçümler fotoğraf içeriyor ancak dosya eşleştirmesi yapılmadı.");
   const when=new Date().toISOString();
   const snapshot=window.DG_BACKUP_SNAPSHOT.buildComplete({...rows,requests:rows.data_requests},{
    exportedAt:when,exportedBy:profile.full_name||""
   });
   const sql=window.DG_BUILD_RESTORE_SQL.buildComplete(snapshot,window.DG_BACKUP_SQL_VALUE.serialize);
   if(sql.tables!==13)throw new Error("13 tablo geri yükleme planı oluşturulamadı.");
   status("ZIP hazırlanıyor: 13 tablo, "+storage.photos.length+" fotoğraf ve SHA-256…");
   const name="dendrogeo_fotografli_tam_veri_arsivi_"+when.slice(0,10)+".zip";
   const result=await window.DG_BACKUP_JSON_DOWNLOAD.downloadComplete(window,snapshot,storage,name,sql.sql);
   localStorage.setItem("dg_lastPhotoArchive",when);
   status("✓ "+name+" · 13 tablo · "+storage.photos.length+" fotoğraf · "+rows.measurements.length+" ölçüm · "+result.files+" ZIP dosyası");
  }catch(error){
   status("❌ Arşiv oluşturulamadı: "+(error?.message||String(error))+" · Eksik arşiv başarı olarak işaretlenmedi.",true);
  }finally{freeze(false);}
 }
 async function recoverArchive(){
  if(busy)return;
  picker.value="";
  picker.click();
 }
 async function inspectSelected(){
  const file=picker.files?.[0];
  if(!file||busy)return;
  freeze(true);
  try{
   status("ZIP merkez dizini, CRC32, SHA-256 ve fotoğraflar doğrulanıyor…");
   const scanned=await window.DG_BACKUP_JSON_DOWNLOAD.readComplete(window,file);
   const built=window.DG_BUILD_RESTORE_SQL.buildComplete(scanned.backup,window.DG_BACKUP_SQL_VALUE.serialize);
   if(built.sql!==scanned.restoreSql)throw new Error("ZIP'deki SQL satırları arşiv verisiyle uyuşmuyor.");
   const message="Arşiv doğrulandı: "+scanned.backup.counts.measurements+" ölçüm, "+scanned.photos.length+
    " fotoğraf, 13 tablo. SQL Editor kurtarma dosyasını indirebilirsiniz. Bu işlem "+
    "CANLI VERİTABANINI DEĞİŞTİRMEZ. Fotoğraflar için ZIP içindeki restore/restore_photos.py "+
    "aracını güvenilir bilgisayarınızda önce dry-run, sonra açık --apply seçeneğiyle çalıştırmanız gerekir. "+
    "SQL dosyası şimdi indirilsin mi?";
   if(!confirm(message)){status("✓ ZIP tamamen doğrulandı; indirme iptal edildi.");return;}
   const name="dendrogeo_fotografli_tam_veri_geri_yukleme_"+new Date().toISOString().slice(0,10)+".sql";
   const downloader=window.DG_BACKUP_RESTORE_SQL_DOWNLOAD;
   // Keep ZIP self-contained: if the site's legacy SQL adapter is absent,
   // use the browser's local-only Blob URL, never an upload endpoint.
   if(downloader?.download)downloader.download(window,built.sql,name);
   else{
    const url=URL.createObjectURL(new Blob([built.sql],{type:"application/sql"})),a=document.createElement("a");
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
   }
   status("✓ ZIP doğrulandı · "+scanned.photos.length+" fotoğraf eksiksiz · SQL hazırlandı. Fotoğrafları geri yüklemek için ZIP içindeki yönergeleri uygulayın.");
  }catch(error){status("❌ Arşiv geri yüklemeye uygun değil: "+(error?.message||String(error))+" · Herhangi bir kayıt değiştirilmedi.",true);}
  finally{picker.value="";freeze(false);}
 }
 download.addEventListener("click",makeArchive);
 $("dgArchiveRestorePick").addEventListener("click",recoverArchive);
 picker.addEventListener("change",inspectSelected);
})();
