"use strict";
(function(root){
 function build(backup,serialize){
  const tables=[["parks",backup.parks],["projects",backup.projects],["measurements",backup.measurements],["waypoints",backup.waypoints],["data_requests",backup.data_requests],["surface_reviews",backup.surface_reviews]];
  let sql="-- DendroGeo tam geri yukleme (0036 · Yedekten Yukle araci uretti)\n"+
   "-- Yedek tarihi: "+String(backup.exported_at||"?").replace(/[\r\n]/g," ")+" · disa aktaran: "+String(backup.exported_by||"?").replace(/[\r\n]/g," ")+"\n"+
   "-- Kapsam: yalniz dosyadaki veri satirlari. Auth, Storage dosyalari, yerel kuyruk ve sema DAHIL DEGILDIR.\n"+
   "-- Kullanim: once izole kurtarma veritabaninda dogrulayin. Idempotenttir:\n"+
   "-- kimlikler (id/owner) korunur, mevcut satirlar ON CONFLICT DO NOTHING ile atlanir.\nBEGIN;\n";
  let count=0;
  for(const[table,rows]of tables){
   if(!Array.isArray(rows)||!rows.length)continue;
   sql+="\n-- "+table+" ("+rows.length+" satir)\n";
   for(const row of rows){
    if(!row||typeof row!=="object")continue;
    const columns=Object.keys(row);
    if(!columns.length)continue;
    sql+="INSERT INTO public."+table+" ("+columns.map(column=>'"'+String(column).replace(/"/g,'""')+'"').join(", ")+") OVERRIDING SYSTEM VALUE VALUES ("+columns.map(column=>serialize(row[column])).join(", ")+") ON CONFLICT DO NOTHING;\n";
    count++;
   }
  }
  return{sql:sql+"\nCOMMIT;\n",count};
 }
 function buildComplete(backup,serialize){
  if(!backup||backup.app!=="DendroGeo"||backup.schema_version!=="2.0.0")throw new Error("Fotoğraflı Tam Veri Arşivi şeması geçersiz.");
  const order=["profiles","parks","projects","measurements","waypoints","data_requests","surface_reviews","report_requests","report_retractions","park_invites","park_collaborators","site_metric_daily","site_visits"];
  for(const table of order){
   const rows=backup[table];
   if(!Array.isArray(rows))throw new Error("Eksik arşiv tablosu: "+table);
   if(backup.counts?.[table]!==rows.length)throw new Error("Arşiv tablosu sayımı uyuşmuyor: "+table);
   for(const row of rows)if(!row||typeof row!=="object"||Array.isArray(row)||!Object.keys(row).length)throw new Error("Bozuk tablo satırı: "+table);
  }
  const safeComment=v=>String(v||"?").replace(/[\r\n\u0000-\u001f]/g," ").slice(0,160);
  let sql="-- DendroGeo Fotograflı Tam Veri Arsivi · SQL geri yukleme (13 public tablosu)\n"+
    "-- Yedek: "+safeComment(backup.exported_at)+" · aktaran: "+safeComment(backup.exported_by)+"\n"+
    "-- Bu dosya SQL Editor'da postgres yetkisiyle ONCE, tercihen BOS/IZOLE test DB'sinde uygulanir.\n"+
    "-- ON CONFLICT DO NOTHING mevcut satirlari ASLA degistirmez; onceki kayit kaybi var ise geri getirmez.\n"+
    "-- Supabase Auth kullanicilari, tum RLS/migration semasi ve GitHub DOI yayinlari pakette yoktur.\n"+
    "-- NOT: SQL fotoğrafları olusturmaz. Once archive ZIP icindeki Storage dosyalarini\n"+
    "-- dendro-photos bucket'ina AYNI path ile yukleyip dogrulayin. Fotograf baglantilari ayni\n"+
    "-- Supabase project origin'ini kullanir; farkli projede URL'ler uyarlanmalidir.\n"+
    "-- FK kullanici kimlikleri auth.users tablosunda yoksa ISLEM HATA VERIR; veri yazilmaz.\n"+
    "BEGIN;\n";
  let count=0;
  for(const table of order){
   const rows=backup[table];
   sql+="\n-- "+table+" ("+rows.length+" satir)\n";
   for(const row of rows){
    const columns=Object.keys(row);
    sql+="INSERT INTO public."+table+" ("+columns.map(name=>'"'+name.replace(/"/g,'""')+'"').join(", ")+
      ") OVERRIDING SYSTEM VALUE VALUES ("+columns.map(name=>serialize(row[name])).join(", ")+") ON CONFLICT DO NOTHING;\n";
    count++;
   }
  }
  // Reconcile identity sequences after preserving original GENERATED ALWAYS ids.
  // Never change the frozen schema or any existing rows.
  for(const table of ["parks","projects","measurements","waypoints","data_requests","site_visits"]){
   sql+="SELECT setval(pg_get_serial_sequence('public."+table+"','id'),"+
    "GREATEST(COALESCE((SELECT max(id) FROM public."+table+"),0),1),"+
    "(SELECT count(*)>0 FROM public."+table+"));\n";
  }
  sql+="\nCOMMIT;\n";
  return{sql,count,tables:order.length};
 }
 root.DG_PHOTO_ARCHIVE_RESTORE_SQL=Object.freeze({build,buildComplete});
})(window);
