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
 root.DG_BUILD_RESTORE_SQL=Object.freeze({build});
})(window);
