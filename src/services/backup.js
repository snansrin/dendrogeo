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
  onSuccess:(name,count)=>toast((typeof dgTfs==="function"?dgTfs("✓ Yedek indirildi: {f} ({n} ölçüm)",{f:name,n:count}):("✓ Yedek indirildi: "+name+" ("+count+" ölçüm)")),"ok","💾"),
  onFailure:error=>toast(dgCf("Yedek hatası: ")+error.message,"err","❌")
 });
}

function checkBackupReminder(){
  const last=localStorage.getItem("dg_lastBackup");
  const state=window.DG_BACKUP_REMINDER_STATE.evaluate(last,Date.now());
  if(state.overdue) toast(dgTfs("⚠ Son tam yedeğin üzerinden {n} gün geçti — bugünkü yedeği alın",{n:state.elapsedDays}),"warn","💾");
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
function dgRestorePick(ev){
 const f=(ev&&ev.target&&ev.target.files&&ev.target.files[0])||null;
 try{if(ev&&ev.target)ev.target.value="";}catch(e){}
 if(!f){toast(dgCf("Yedek dosyası okunamadı."),"err","📥");return;}
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
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([sql],{type:"application/sql"}));
  a.download="dendrogeo_geri_yukleme_"+new Date().toISOString().slice(0,10)+".sql";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  toast(dgCf("✓ Geri yükleme SQL'i indirildi — Supabase → SQL Editor'da çalıştırın. Satırlar korunur, çakışanlar atlanır."),"ok","📥");
 }catch(e){toast(dgCf("Geri yükleme hazırlanamadı: ")+(e&&e.message||e),"err","📥");}
}
