"use strict";
/* DendroGeo · services/backup.js — TAM YEDEK + HATIRLATICI (Faz 6)
 * admin.js'ten birebir taşındı: fetchAllRows (sayfalı tam döküm),
 * fullBackup (JSON indirme), checkBackupReminder (7 gün uyarısı). */

/* ============ TAM YEDEK (JSON) — Tez verisi sigortası ============ */
async function fetchAllRows(table, orderCol){
  let out=[], from=0, step=1000;
  for(;;){
    const {data,error}=await sb.from(table).select("*").order(orderCol).range(from, from+step-1);
    if(error) throw new Error(table+": "+error.message);
    out=out.concat(data||[]);
    if(!data||data.length<step) break;
    from+=step;
  }
  return out;
}

async function fullBackup(){
  if(!PROFILE||(PROFILE.role!=="admin"&&PROFILE.role!=="owner")) return toast("Yetki yok.","err");
  toast("Yedek hazırlanıyor…","info","💾");
  try{
    const meas = await fetchAllRows("measurements","created_at");
    const projs = await fetchAllRows("projects","id");
    const wps = await fetchAllRows("waypoints","id");
    let reqs = [];
    try{ reqs = await fetchAllRows("data_requests","created_at"); }catch(e){ reqs = []; }
    const backup={
      app:"DendroGeo",
      schema_version:"1.0.0",
      doi:"10.5281/zenodo.22948643",
      exported_at:new Date().toISOString(),
      exported_by:(PROFILE&&PROFILE.full_name)||"",
      counts:{measurements:meas.length,projects:projs.length,waypoints:wps.length,data_requests:reqs.length},
      measurements:meas,
      projects:projs,
      waypoints:wps,
      data_requests:reqs
    };
    const name="dendrogeo_yedek_"+new Date().toISOString().slice(0,10)+".json";
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
    a.download=name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    localStorage.setItem("dg_lastBackup", new Date().toISOString());
    toast((typeof dgTfs==="function"?dgTfs("✓ Yedek indirildi: {f} ({n} ölçüm)",{f:name,n:meas.length}):("✓ Yedek indirildi: "+name+" ("+meas.length+" ölçüm)")),"ok","💾");
  }catch(e){
    toast(dgCf("Yedek hatası: ")+e.message,"err","❌");
  }
}

function checkBackupReminder(){
  const last=localStorage.getItem("dg_lastBackup");
  const days=last?(Date.now()-new Date(last).getTime())/86400000:999;
  if(days>7) toast(dgTfs("⚠ Son tam yedeğin üzerinden {n} gün geçti — bugünkü yedeği alın",{n:Math.floor(days)}),"warn","💾");
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
 if(v===null||v===undefined)return "NULL";
 if(typeof v==="number")return Number.isFinite(v)?String(v):"NULL";
 if(typeof v==="boolean")return v?"true":"false";
 return "'"+String(v).replace(/'/g,"''")+"'";
}
function dgRestoreSQL(bk){
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
