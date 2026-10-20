"use strict";
/* DendroGeo · services/backup.js — TAM YEDEK + HATIRLATICI (Faz 6)
 * admin.js'ten birebir taşındı: fetchAllRows (sayfalı tam döküm),
 * fullBackup (JSON indirme), checkBackupReminder (7 gün uyarısı). */

// Lazily mounted presentation only. No public archive routes or background reads.
import('/src/ui/photo-admin-controls.mjs').catch(()=>{});

/* ============ TAM YEDEK (JSON) — Tez verisi sigortası ============ */
async function fetchAllRows(table,orderCol){return await window.DG_BACKUP_PAGED_STORE.load(sb,table,orderCol);}

let DG_PHOTO_BACKUP_BUSY=false;
async function fullBackup(){
 if(DG_PHOTO_BACKUP_BUSY)return;
 if(!PROFILE||PROFILE.role!=='owner'){
  toast('Fotoğraflı Tam Veri Arşivi yalnız hesap sahibi (owner) yönetici yetkisinde açılır.','err','🔐');
  return;
 }
 DG_PHOTO_BACKUP_BUSY=true;
 window.DG_PHOTO_ARCHIVE_UI?.busy(true);
 const progress=message=>window.DG_PHOTO_ARCHIVE_UI?.status(message);
 try{
  progress('Veriler yetkili yönetici oturumundan okunuyor…');
  const {makeOwnerArchive}=await import('/src/application/backup/photo-full-workflow.mjs');
  const archive=await makeOwnerArchive(sb,{progress});
  window.DG_PHOTO_ARCHIVE_ZIP.saveBlob(window,archive.blob,archive.filename);
  try{localStorage.setItem('dg_lastBackup',archive.exportedAt);}catch{}
  progress('✓ 13 tablo, '+archive.photos+' fotoğraf, '+archive.counts.measurements+' ölçüm · ZIP indirildi.');
  toast('✓ Fotoğraflı Tam Veri Arşivi doğrulandı: '+archive.photos+' fotoğraf, 13 tablo.','ok','💾');
 }catch(error){
  progress('❌ Arşiv tamamlanamadı: '+(error?.message||error));
  toast('Fotoğraflı arşiv hatası: '+(error?.message||error),'err','❌');
 }finally{
  DG_PHOTO_BACKUP_BUSY=false;
  window.DG_PHOTO_ARCHIVE_UI?.busy(false);
 }
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
 if(!PROFILE||(PROFILE.role!=='admin'&&PROFILE.role!=='owner')){
  toast('Yedekten geri yükleme yalnız yönetici panelinde yapılabilir.','err','🔐');return;
 }
 if(/\.zip$/i.test(f.name||'')){
  if(PROFILE.role!=='owner'){
   toast('Fotoğraflı arşiv geri yüklemesi yalnız hesap sahibine açıktır.','err','🔐');return;
  }
  window.DG_PHOTO_ARCHIVE_UI?.busy(true);
  try{
   window.DG_PHOTO_ARCHIVE_UI?.status('ZIP, 13 tablo ve fotoğraf SHA-256 doğrulanıyor…');
   const {inspectOwnerArchive}=await import('/src/application/backup/photo-full-workflow.mjs');
   const result=await inspectOwnerArchive(sb,f);
   const ok=confirm('Fotoğraflı arşiv doğrulandı: '+result.measurements+' ölçüm, '+result.photos+
    ' gerçek fotoğraf, 13 tablo. Yalnız kurtarma SQL dosyası indirilsin mi? Bu işlem canlı veritabanına veya Storage dosyalarına yazmaz.');
   if(!ok)return;
   const filename='dendrogeo_fotografli_tam_veri_geri_yukleme_'+new Date().toISOString().slice(0,10)+'.sql';
   window.DG_BACKUP_RESTORE_SQL_DOWNLOAD.download(window,result.sql,filename);
   window.DG_PHOTO_ARCHIVE_UI?.status('✓ ZIP doğrulandı; SQL hazır. Fotoğraf aktarım yönergeleri ZIP içindedir.');
   toast('✓ 13 tablo ve '+result.photos+' fotoğraf doğrulandı. SQL kurtarma dosyası indirildi.','ok','📥');
  }catch(error){
   window.DG_PHOTO_ARCHIVE_UI?.status('❌ Arşiv doğrulanamadı: '+(error?.message||error));
   toast('Geri yükleme doğrulama hatası: '+(error?.message||error),'err','❌');
  }finally{window.DG_PHOTO_ARCHIVE_UI?.busy(false);}
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
