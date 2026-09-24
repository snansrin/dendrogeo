"use strict";
/* DendroGeo · services/data-requests.js — VERİ TALEP AKIŞI (Faz 6)
 * admin.js'ten birebir taşındı: kullanıcı tarafı talep formu
 * (sendDataRequest/loadMyRequests/loadRequestOptions/req*Changed) ve
 * yönetici tarafı talep kuyruğu (loadRequests/rejectRequest/fulfillRequest).
 * REQ_ROWS/REQ_PROJECTS state'i admin.js (çekirdek) içindedir — çağrı anında
 * global lexical kapsamdan çözülür (admin.js bu dosyadan SONRA yüklenir ama
 * tüm çağrılar boot sonrasında olur). */

/* ============ VERİ TALEBİ (kullanıcı → yönetici) ============ */
async function sendDataRequest(){
 if(!USER)return;
 const country=$("reqCountry").value.trim()||null;
 const city=$("reqCity").value.trim()||null;
 const project_name=$("reqProject").value.trim()||null;
 const note=$("reqNote").value.trim()||null;
 const m=$("reqMsg");
 try{
  const{data:pending}=await sb.from("data_requests")
   .select("country,city,project_name,status")
   .eq("user_id",USER.id)
   .in("status",["Beklemede","İşleme Alındı"]);
  const norm=v=>(v||"").toString().trim().toLowerCase();
  const dup=(pending||[]).find(f=>norm(f.country)===norm(country)&&norm(f.city)===norm(city)&&norm(f.project_name)===norm(project_name));
  if(dup){
   toast("⚠️ Bu veri talebiniz zaten alındı — yönetici onayı bekleniyor","warn","✉️");
   m.style.color="var(--amber)";
   m.textContent="⚠ Aynı filtreyle bir talebiniz zaten "+(dup.status==="Beklemede"?"beklemede":"işleme alındı")+". Yönetici yanıt verene kadar yeni talep oluşturulamaz.";
   return;
  }
 }catch(e){console.log("Dup kontrolü:",e);}
 const body={user_id:USER.id,email:PROFILE?.email||USER.email,country,city,project_name,note,status:"Beklemede"};
 const{error}=await sb.from("data_requests").insert(body);
 if(error){m.style.color="var(--red)";m.textContent="Hata: "+error.message;return;}
 toast("✓ Talep gönderildi — yönetici yanıtı bekleniyor","ok","✉️");
 m.style.color="var(--green-dk)";m.textContent="✓ Talebiniz yönetime iletildi, hazır olduğunda e‑postanıza gönderilecek.";
 $("reqCountry").value="";$("reqCity").value="";$("reqProject").value="";$("reqNote").value="";
 loadMyRequests();
}

async function loadMyRequests(){
 if(!USER)return;
 const{data}=await sb.from("data_requests").select("*").eq("user_id",USER.id).order("created_at",{ascending:false});
 const el=$("myRequests");if(!el)return;
 el.innerHTML=(data&&data.length)?"<div class='lbl' style='margin:10px 0 6px'>Taleplerim</div>"+data.map(r=>{
  const filt=[esc(r.country),esc(r.city),esc(r.project_name)].filter(Boolean).join(" / ")||"Tüm Veri";
  const bc=r.status==="Tamamlandı"?"on":(r.status==="İşleme Alındı"?"admin":"off");
  return `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:.82rem"><span>${esc(filt)}</span><span class="badge ${bc}">${r.status}</span></div>`;
 }).join(""):"";
}

/* --- Kullanıcı talep formu --- */
async function loadRequestOptions(){
 try{
  const [m,p]=await Promise.all([
   sb.from("measurements").select("country,city",{count:"exact"}).eq("status","Onaylı").limit(5000),
   sb.from("projects").select("id,name,country,city").order("name")
  ]);
  REQ_ROWS=m.data||[];REQ_PROJECTS=p.data||[];
  /* Ülke/şehir seçenek listeleri kesilmişse talep formunda eksik seçenek görünür. */
  dgWarnIfTruncated(m.data,5000,"Talep formu seçenekleri",m.count);
  fillSelect($("reqCountry"),listCountries(REQ_ROWS,REQ_PROJECTS));
  reqCountryChanged();
 }catch(e){}
}

function reqCountryChanged(){
 fillSelect($("reqCity"),listCities(REQ_ROWS,REQ_PROJECTS,$("reqCountry").value));
 reqCityChanged();
}

function reqCityChanged(){
 fillSelect($("reqProject"),listProjects(REQ_PROJECTS,$("reqCountry").value,$("reqCity").value,false));
}

/* ============ YÖNETİCİ: KULLANICI VERİ TALEPLERİ ============ */
async function loadRequests(){
 const{data}=await sb.from("data_requests").select("*,profiles(full_name)").order("created_at",{ascending:false});
 const reqs=data||[];
 const pending=reqs.filter(r=>r.status!=="Tamamlandı"&&r.status!=="Reddedildi");
 const closed=reqs.filter(r=>r.status==="Tamamlandı"||r.status==="Reddedildi");
 
 $("aReqPending").textContent=pending.length;
 $("aReqPendingMini").textContent=pending.length;
 $("aReqClosed").textContent=closed.length;
 
 // AKTİF TALEPLER TABLOSU
 $("aReqT").innerHTML=pending.length?pending.map(r=>{
  const filt=[esc(r.country),esc(r.city),esc(r.project_name)].filter(Boolean).join(" / ")||"Tüm Veri";
  const hasNote=r.note&&r.note.trim().length>0;
  return `<tr>
   <td>${esc(r.profiles?.full_name)||"—"}</td>
   <td>${esc(r.email)||"—"}</td>
   <td><b>${esc(filt)}</b></td>
   <td>${new Date(r.created_at).toLocaleDateString("tr-TR")}</td>
   <td><span class="badge admin">${r.status}</span></td>
   <td style="display:flex;gap:4px;flex-wrap:wrap">
    <button class="btn sm blue" onclick="fulfillRequest(${r.id})">📥✉️ İndir ve Yanıtla</button>
    <button class="btn sm red" onclick="rejectRequest(${r.id})">🚫 Reddet</button>
   </td>
  </tr>${hasNote?`<tr><td colspan="6" style="background:var(--tint);font-size:.78rem;color:var(--mut);white-space:normal;padding:8px 12px;line-height:1.5"><b style="color:var(--green-dk)">📝 Not:</b> ${esc(r.note)}</td></tr>`:""}`;
 }).join(""):"<tr><td colspan=6 style='text-align:center;color:var(--mut)'>Bekleyen talep yok</td></tr>";
 
 // TAMAMLANAN/REDDEDİLENLER (COLLAPSIBLE)
 const closedWrap=$("closedRequestsWrap");
 if(closed.length>0){
  closedWrap.style.display="block";
  $("aReqClosed").textContent=closed.length;
  $("closedReqT").innerHTML=closed.map(r=>{
   const filt=[esc(r.country),esc(r.city),esc(r.project_name)].filter(Boolean).join(" / ")||"Tüm Veri";
   const bc=r.status==="Tamamlandı"?"on":"off";
   const hasNote=r.note&&r.note.trim().length>0;
   const closedDate=r.fulfilled_at?new Date(r.fulfilled_at).toLocaleDateString("tr-TR"):"";
   return `<tr>
    <td>${esc(r.profiles?.full_name)||"—"}</td>
    <td>${esc(r.email)||"—"}</td>
    <td>${esc(filt)}</td>
    <td>${new Date(r.created_at).toLocaleDateString("tr-TR")}</td>
    <td>${closedDate}</td>
    <td><span class="badge ${bc}">${r.status}</span></td>
   </tr>${hasNote?`<tr><td colspan="6" style="background:var(--tint);font-size:.78rem;color:var(--mut);white-space:normal;padding:8px 12px;line-height:1.5"><b style="color:var(--green-dk)">📝 Not:</b> ${esc(r.note)}</td></tr>`:""}`;
  }).join("");
 }else{
  closedWrap.style.display="none";
 }
}

async function rejectRequest(id){
 if(!confirm("Bu talebi reddetmek istediğinizden emin misiniz? Kullanıcıya yanıt gönderilmez, talep arşive kaldırılır."))return;
 const{error}=await sb.from("data_requests").update({status:"Reddedildi",fulfilled_at:new Date().toISOString()}).eq("id",id);
 if(error){toast("Hata: "+error.message,"err");return;}
 toast("✓ Talep reddedildi","warn","🚫");
 loadRequests();
}

async function fulfillRequest(id){
   const {data:req} = await sb.from("data_requests").select("*,profiles(full_name)").eq("id",id).single();
    if(!req) return;
    
    let projIds = null;
    if(req.project_name){
        const {data:projs} = await sb.from("projects").select("id").ilike("name","%"+req.project_name+"%");
        projIds = (projs||[]).map(p=>p.id);
    }
    
    let q = sb.from("measurements").select("*").eq("status","Onaylı");
    if(req.country)  q = q.eq("country", req.country);
    if(req.city)     q = q.eq("city",    req.city);
    if(projIds)      q = q.in("project_id", projIds.length ? projIds : [-1]);
    
    const {data} = await q;
    const rows = data || [];
    const n = rows.length;
    const totalC = rows.reduce((a,r) => a + (r.carbon_kg||0), 0);
    const countries = new Set(rows.map(r=>r.country).filter(Boolean));
    const cities    = new Set(rows.map(r=>r.city).filter(Boolean));
    
    if(n === 0){
        if(!confirm("Bu filtreye uyan onaylı kayıt bulunamadı. Yine de kullanıcıya bilgilendirme maili göndermek ister misiniz?")) return;
    } else {
        dl(fullCSV(rows), "dendrogeo_talep_" + id + ".csv");
    }
    
    // 📧 Profesyonel & detaylı e-posta metni
    const bugun = new Date().toLocaleDateString("tr-TR", { day:'numeric', month:'long', year:'numeric' });
    
    const bodyLines = [
        "Merhaba " + (req.profiles?.full_name || "Değerli Kullanıcımız") + ",",
        "",
        "DendroGeo'daki veri talebiniz başarıyla hazırlandı. 🌲",
        "",
        "📊 TALEP ÖZETİ",
        "─────────────────────────",
        "• Ülke      : " + (req.country || "Tümü"),
        "• Şehir     : " + (req.city    || "Tümü"),
        "• Proje/Park: " + (req.project_name || "Tümü"),
       (req.note ? "• Notunuz   : " + req.note : null),
        "",
        "📈 VERİ SETİ İÇERİĞİ",
        "─────────────────────────",
        "• Toplam kayıt     : " + n + " ağaç ölçümü",
        "• Toplam karbon    : " + (totalC/1000).toFixed(2) + " ton C",
        "• Kapsanan ülke    : " + countries.size,
        "• Kapsanan şehir   : " + cities.size,
        "• Hazırlanma tarihi: " + bugun,
        "",
        "📎 EKTE YER ALAN DOSYA",
        "─────────────────────────",
        "Veri seti CSV formatında hazırlanmıştır.",
        "",
        "CSV sütunları: POINT_ID, LATITUDE, LONGITUDE, TREE_GROUP, TREE_SPECIES, DBH_CM, HEIGHT_M, AGB_KG, BHB_KG, TOTAL_BIOMASS_KG, CARBON_KG, PHOTO_FILE ve daha fazlasını içerir.",
        "",
        "🗺 QGIS'DE NASIL AÇILIR?",
        "─────────────────────────",
        "1. QGIS → Layer → Add Layer → Add Delimited Text Layer",
        "2. X = LONGITUDE, Y = LATITUDE, CRS = EPSG:4326",
        "3. Fotoğraf balonu için katman özelliklerinde Map Tip özelliğini kullanabilirsiniz.",
        "   Detaylı rehber: https://dendrogeo.org/ → Dışa Aktar bölümü",
        "",
        "📜 VERİ LİSANSI",
        "─────────────────────────",
        "Bu veri CC BY-NC 4.0 lisansı altındadır. Ticari olmayan amaçlarla, kaynak gösterilerek serbestçe kullanılabilir.",
        "",
        "Atıf önerisi:",
"ŞİRİN, S. & ŞİRİN, N. (2026). DendroGeo: Global Tree Inventory & Carbon Data System (Version 1.0.0) [Dataset]. Zenodo. https://doi.org/10.5281/zenodo.22646300",
"",
        "Herhangi bir sorunuz olursa bu e-postayı yanıtlayarak bize ulaşabilirsiniz.",
        "",
       "İyi çalışmalar dileriz,",
	"DendroGeo Ekibi",
	"Nagihan ŞİRİN — Doktora Öğrencisi · Sinan ŞİRİN — Sistem Geliştirici",
	"Küresel Ağaç Envanteri ve Karbon Veri Sistemi",
	"https://dendrogeo.org · DOI: 10.5281/zenodo.22646300",
    ];
    
    const bodyTxt = bodyLines.filter(l => l !== null).join("\n");
    const subject = encodeURIComponent("✅ DendroGeo Veri Talebiniz Hazırlandı — " + n + " kayıt, " + (totalC/1000).toFixed(2) + " t C");
    
    window.open(
        "mailto:" + (req.email || "") +
        "?subject=" + subject +
        "&body=" + encodeURIComponent(bodyTxt),
        "_blank"
    );
    
    await sb.from("data_requests").update({
        status: "Tamamlandı",
        fulfilled_at: new Date().toISOString()
    }).eq("id", id);
    
    toast("✓ Mail hazırlandı — CSV'yi ekleyip gönderin", "ok", "📧");
    loadRequests();
}
