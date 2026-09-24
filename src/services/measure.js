"use strict";
/* ============ KONUMDAN İL/ÜLKE ALGILAMA ============ */
/* TÜRKİYE'de il adı "state" alanındadır (admin_level=4); ilçe "city/town"a düşer.
   TR için KESİN çözüm: önce state oku → ilçe asla gelmez. */
async function reverseGeocode(lat,lon){
 try{
  const r=await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat="+lat+"&lon="+lon+"&accept-language=tr",{headers:{Accept:"application/json"}});
  if(!r.ok)return null;
  const j=await r.json();const a=j.address||{};
  const cc=(a.country_code||"").toLowerCase();
  const city=cc==="tr"
   ?(a.state||a.province||a.city||null)
   :(a.city||a.town||a.village||a.municipality||a.state||null);
  const country=a.country||null;
  if(!city&&!country)return null;
  return{city:city||"Bilinmiyor",country:country||"Bilinmiyor"};
 }catch(e){return null;}
}
/* --- 2. FOTOĞRAF DENETİMİ --- */
function loadImg(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file);const i=new Image();i.onload=()=>res({i,u});i.onerror=rej;i.src=u;});}
async function checkPhoto(e){
 const f=e.target.files[0],box=$("photoCheck");
 if(!f){photoOk=false;box.style.display="none";return;}
 if(!f.type.startsWith("image/")){photoOk=false;box.className="alert err";box.style.display="block";box.innerHTML="⚠ Yalnızca görsel dosyası yükleyin.";return;}
 box.style.display="block";box.className="alert info";box.innerHTML="⏳ Fotoğraf denetleniyor…";
 try{
  const{i,u}=await loadImg(f);
  const S=120,c=document.createElement("canvas");c.width=S;c.height=S;
  const x=c.getContext("2d");x.drawImage(i,0,0,S,S);URL.revokeObjectURL(u);
  const d=x.getImageData(0,0,S,S).data;
  let veg=0,br=0,edge=0;
  for(let p=0;p<d.length;p+=4){const R=d[p],G=d[p+1],B=d[p+2];if(2*G-R-B>20&&G>50)veg++;br+=(R+G+B)/3;}
  const n=d.length/4;const vegR=veg/n;br/=n;
  for(let y=1;y<S-1;y+=2)for(let xx=1;xx<S-1;xx+=2){const a=(y*S+xx)*4,b2=(y*S+xx+1)*4;edge+=Math.abs(d[a]-d[b2]);}
  const ok=vegR>=0.25&&br>25&&br<245;
  photoOk=ok;
  if(ok){box.className="alert ok";box.innerHTML=`✓ <b>Fotoğraf uygun</b> · Bitki örtüsü: %${(vegR*100).toFixed(1)} · Pozlama: ${br.toFixed(0)}/255`;}
  else{box.className="alert err";box.innerHTML=`⚠ <b>Fotoğraf uygun değil</b> · Bitki örtüsü: %${(vegR*100).toFixed(1)} (min %25) · Pozlama: ${br.toFixed(0)}.<br>Ağacı/net bitki örtüsünü gösteren, karanlık olmayan bir çekim yapın.`;}
 }catch(err){photoOk=false;box.className="alert err";box.innerHTML="⚠ Fotoğraf okunamadı, tekrar deneyin.";}
}
/* --- 3. GPS --- */
/* Ekran kilidi: saha ölçümü sırasında ekranın kararmasını engeller.
 * iOS Safari ekran kilitlendiğinde konum izlemeyi kestiği için bu, ölçümün
 * yarıda kalmasını önler. Sekme arka plana alınıp geri dönüldüğünde kilit
 * kendiliğinden bırakıldığı için visibilitychange ile yeniden alınır.
 * Desteklemeyen tarayıcılarda sessizce yok sayılır; ölçüm akışını etkilemez. */
let WAKE_LOCK=null;
async function acquireWakeLock(){
 if(!("wakeLock" in navigator))return;
 try{
  if(WAKE_LOCK)return;
  WAKE_LOCK=await navigator.wakeLock.request("screen");
  WAKE_LOCK.addEventListener("release",()=>{WAKE_LOCK=null;});
 }catch(e){WAKE_LOCK=null;}
}
if(!window._wakeLockHooked){
 window._wakeLockHooked=true;
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&GPS)acquireWakeLock();
 });
}

async function startGps(){
 const gpsMsg=(t,e)=>{const g=$("gpsState");g.textContent=t;g.className="alert "+(e?"err":"info");};
 if(!navigator.geolocation)return gpsMsg("Tarayıcı konum desteklemiyor.",1);
 if(/iPhone|iPad|iPod/.test(navigator.userAgent))$("iosHint").style.display="block";
 try{if(navigator.permissions&&navigator.permissions.query){const p=await navigator.permissions.query({name:"geolocation"});if(p.state==="denied")return gpsMsg("Konum izni reddedildi. Ayarlar→Safari→Konum.",1);}}catch(e){}
 gpsMsg("Konum alınıyor…",0);
 const opts={enableHighAccuracy:true,timeout:15000,maximumAge:0};
 const onOk=p=>{GPS=p.coords;updGps();acquireWakeLock();navigator.geolocation.watchPosition(p2=>{GPS=p2.coords;updGps();},()=>{},{...opts,maximumAge:1000});};
 const onErr=e=>{
  if(e.code===1)return gpsMsg("İzin reddedildi. iPhone: Ayarlar→Safari→Konum→Kullanırken İzin Ver.",1);
  if(e.code===3){try{navigator.geolocation.getCurrentPosition(onOk,()=>gpsMsg("GPS başarısız: dışarıda tekrar deneyin.",1),opts);}catch(err){gpsMsg("GPS hatası.",1);}return;}
  gpsMsg("GPS hatası: "+e.message,1);
 };
 try{navigator.geolocation.getCurrentPosition(onOk,onErr,opts);}catch(e){gpsMsg("Konum başlatılamadı.",1);}
}
function updGps(){
 const a=GPS.accuracy;
 $("gpsAcc").textContent=a.toFixed(0);$("gLat").textContent=GPS.latitude.toFixed(6);$("gLon").textContent=GPS.longitude.toFixed(6);
 $("gAlt").textContent=(GPS.altitude||0).toFixed(0)+" m";
 const q=a<10?"ÇOK İYİ":a<20?"İYİ":a<40?"ORTA":"ZAYIF";
 $("gQ").textContent=q;
 $("gpsRing").className="gpsring "+(a<10?"good":a<30?"mid":"bad");
 $("gpsState").textContent="🛰 GPS aktif · ±"+a.toFixed(1)+" m · "+q;$("gpsState").className="alert ok";
 if(map&&GPS){if(window._me)map.removeLayer(window._me);window._me=L.circleMarker([GPS.latitude,GPS.longitude],{radius:7,color:"#2b6cb0",weight:3,fillOpacity:.9}).addTo(map).bindPopup("Konumun");}
 drawNav();autoFillPointId();
}
/* --- 4. FORM YARDIMCILARI --- */
function fillSpecies(){
 const g=$("mGroup").value,s=$("mSpecies");
 if(!g){s.disabled=true;s.innerHTML="";$("latinName").textContent="";return;}
 s.disabled=false;
 s.innerHTML='<option value="">Seç</option>'+(SPECIES_DATA[g]||[]).map(x=>`<option value="${x.tr}">${x.tr}${x.lat && x.lat!=="—"?" · "+x.lat:""}</option>`).join("");
 $("latinName").textContent="";
}
function showLatin(){
 const sp=$("mSpecies").value;
 $("latinName").textContent=(LATIN[sp]&&LATIN[sp]!=="—")?("🔬 "+LATIN[sp]):"";
}
function liveCalc(){const d=+$("mDbh").value,h=+$("mHeight").value,sp=$("mSpecies").value,grp=$("mGroup").value,box=$("liveCalc");if(!d||!h||!sp){box.style.display="none";return;}const c=calc(d,h,sp,grp);box.style.display="block";box.innerHTML=`Karbon: <b>${c.total_carbon.toFixed(1)} kg</b> · AGB: ${c.agb.toFixed(1)} · BHB: ${c.bhb.toFixed(1)} · Hacim: ${c.vol.toFixed(2)} m³`;}
/* --- 5. PROJE CRUD --- */
/* PROJE = PARK + ETİKET (2026-09-24).
 * Proje adı artık serbest metin değil: park algılanır, kullanıcı bir etiket
 * verir ("deneme") ve ad "Göksu Parkı - deneme" olur. Adı DB tarafında
 * trg_compose_project_name kurar; istemci dgProjectName() ile AYNI string'i
 * önizler. Park algılanmadan proje de ölçüm de açılamaz
 * (sunucu kapısı: trg_enforce_park_link → PARK_REQUIRED). */
let EDIT_PROJ_PARK=null;

async function loadProjects(){
 if(!USER)return;
 /* parks gömüsü: projenin park kimliği + alanı (kapı kartı ve tablo için).
  * Şema eskiyse (0004 uygulanmamış) PostgREST ilişkiyi bulamaz ve hata döner;
  * o zaman düz select'e düşülür ki proje listesi tamamen boş kalmasın. */
 let{data,error}=await sb.from("projects").select("*,parks(id,name,city,country,area_m2)").eq("owner",USER.id);
 if(error){
  dgParkSchemaMissing("projects↔parks: "+error.message);
  const fb=await sb.from("projects").select("*").eq("owner",USER.id);
  data=fb.data||[];
 }
 PROJ_LIST=data||[];
 const opts=PROJ_LIST.map(p=>`<option value="${p.id}">${esc(dgProjectOptionLabel(p))}</option>`).join("");
 const empty="<option value=''>Önce park algıla → proje oluştur</option>";
 $("mProject").innerHTML=opts||empty;
 $("nProject").innerHTML=opts||empty;
 $("projTable").innerHTML=PROJ_LIST.map(p=>{
  const park=p.parks&&p.parks.name?p.parks.name:(p.park_name||"");
  const parkCell=p.park_id
   ? `🌳 ${esc(park)}${p.parks&&p.parks.area_m2?`<br><span class="mono" style="font-size:.68rem;color:var(--mut)">${dgFmtHa(p.parks.area_m2)}</span>`:""}`
   : `<span class="badge off">⛔ park yok</span><br><button class="btn sm blue" style="margin-top:4px" onclick="startParkScan({projectId:${p.id},returnTo:'projects'})">🌳 Bağla</button>`;
  return `<tr><td>${p.id}</td><td>${parkCell}</td><td>${esc(p.name)}</td><td>${esc(p.country||"—")}</td><td>${esc(p.city||"—")}</td><td>${new Date(p.created_at).toLocaleDateString("tr-TR")}</td><td style="display:flex;gap:4px"><button class="btn sm blue" onclick="editProject(${p.id})">✏️</button><button class="btn sm red" onclick="deleteProject(${p.id})">🗑</button></td></tr>`;
 }).join("")||"<tr><td colspan=7>Proje yok — önce park algıla</td></tr>";
 dgRenderProjectParkBox();
 dgParkGate();
}

/* Projeler sekmesindeki "park" kutusu: hangi park algılanmış, ad nasıl olacak. */
function dgRenderProjectParkBox(){
 const box=$("projParkBox");
 if(!box)return;
 const park=EDIT_PROJ?EDIT_PROJ_PARK:DG_PARK;
 if(park&&park.name){
  box.className="alert ok";
  box.innerHTML=`<b>🌳 Algılanan park: ${esc(park.name)}</b>${park.area_m2?" · "+dgFmtHa(park.area_m2):""}${park.osm_key?` · <span class="mono" style="font-size:.72rem">${esc(park.osm_key)}</span>`:""}`+
   `<br><span style="font-size:.8rem">Proje adı otomatik "<b>${esc(park.name)}</b> - <i>etiket</i>" olacak. Aynı parkı başkaları da algıladığında veriler karşılaştırmada tek satırda birleşir.</span>`;
  /* Park başka şehirdeyse ülke/şehir varsayılanlarını parkınkiyle tazele
   * (kayıttan önce elle değiştirilebilir). */
  if(park.city&&$("pCity")&&$("pCity").value==="Ankara")$("pCity").value=park.city;
  if(park.country&&$("pCountry")&&$("pCountry").value==="Türkiye")$("pCountry").value=park.country;
 }else{
  box.className="alert err";
  box.innerHTML=`<b>⛔ Park algılanmadı — proje oluşturulamaz.</b>`+
   `<br><span style="font-size:.8rem">Önce Canlı Harita → Park Algılama ekranında parkın içine tıkla. OSM'de park yoksa "elle oluştur" ile kimlik açabilirsin.</span>`+
   `<div style="margin-top:10px"><button class="btn sm blue" onclick="startParkScan({returnTo:'projects'})">🌳 Park Algılama Ekranına Git</button></div>`;
 }
 dgProjectNamePreview();
}

function dgProjectNamePreview(){
 const el=$("pNamePreview");
 if(!el)return;
 const park=EDIT_PROJ?EDIT_PROJ_PARK:DG_PARK;
 const label=($("pLabel")?$("pLabel").value:"").trim();
 if(!park||!park.name){el.textContent="— (önce park algıla)";el.style.color="var(--mut)";return;}
 el.textContent=dgProjectName(park.name,label);
 el.style.color="var(--ink)";
}

function editProject(id){
 const p=PROJ_LIST.find(x=>x.id===id);if(!p)return;
 EDIT_PROJ=id;
 EDIT_PROJ_PARK=p.park_id
  ? {id:p.park_id,name:(p.parks&&p.parks.name)||p.park_name||"",area_m2:(p.parks&&p.parks.area_m2)||null}
  : null;
 $("pLabel").value=p.label!=null?p.label:dgLabelFromLegacy(p.name,EDIT_PROJ_PARK?EDIT_PROJ_PARK.name:"");
 $("pCountry").value=p.country||"";$("pCity").value=p.city||"";
 $("projSaveBtn").textContent="💾 Projeyi Güncelle";$("projCancelBtn").style.display="inline-block";
 dgRenderProjectParkBox();
}
function cancelProjectEdit(){
 EDIT_PROJ=null;EDIT_PROJ_PARK=null;
 $("pLabel").value="";$("projSaveBtn").textContent="+ Proje Oluştur";$("projCancelBtn").style.display="none";
 dgRenderProjectParkBox();
}
async function createProject(){
 const label=($("pLabel").value||"").trim();

 if(EDIT_PROJ){
  if(!EDIT_PROJ_PARK){
   toast("Bu proje parka bağlı değil — önce park algıla.","err","🌳");
   startParkScan({projectId:EDIT_PROJ,returnTo:"projects"});
   return;
  }
  const{error}=await sb.from("projects").update({label,park_id:EDIT_PROJ_PARK.id,country:$("pCountry").value,city:$("pCity").value}).eq("id",EDIT_PROJ);
  if(error)return toast("Hata: "+error.message,"err");
  toast("✓ Proje güncellendi","ok","📁");
  cancelProjectEdit();
 }else{
  const park=DG_PARK;
  if(!park){
   toast("Önce park algıla — park olmadan proje açılamaz.","err","🌳");
   startParkScan({returnTo:"projects"});
   return;
  }
  const{error}=await sb.from("projects").insert({
   owner:USER.id,
   park_id:park.id,
   label,
   /* DB trigger'ı aynı adı kurar; istemci de gönderir ki eski şemada da ad tutarlı kalsın. */
   name:dgProjectName(park.name,label),
   country:$("pCountry").value||park.country||"",
   city:$("pCity").value||park.city||""
  });
  if(error)return toast("Hata: "+error.message,"err");
  toast("✓ Proje oluşturuldu: "+dgProjectName(park.name,label),"ok","📁");
  $("pLabel").value="";
 }
 loadProjects();
}
async function deleteProject(id){
 const{count}=await sb.from("measurements").select("*",{count:"exact",head:true}).eq("project_id",id);
 if(!confirm("Proje silinsin mi? Bağlı "+(count||0)+" ölçüm ve waypoint'ler de silinebilir.\n(Park kimliği silinmez — aynı parktaki diğer projelerin karşılaştırması devam eder.)"))return;
 await sb.from("waypoints").delete().eq("project_id",id);
 await sb.from("projects").delete().eq("id",id);
 loadProjects();
}
/* --- 6. NOKTA YÖNETİMİ --- */
let manualPoint=false;
async function autoFillPointId(){
if(manualPoint||EDIT_ID)return;
const pid=+$("mProject").value;
if(!pid)return;
if($("mPoint").value)return;
try{
// 1) GPS açık + ziyaret edilmemiş waypoint varsa → en yakın waypoint
if(GPS){
const{data}=await sb.from("waypoints").select("*").eq("project_id",pid).eq("visited",false);
if(data&&data.length){
const nearest=data.sort((a,b)=>hav(GPS.latitude,GPS.longitude,a.lat,a.lon)-hav(GPS.latitude,GPS.longitude,b.lat,b.lon))[0];
$("mPoint").value=nearest.wp_id;
return;
}
}
// 2) Waypoint yoksa → projedeki son point_id + 1 (proje boşsa 1)
const{data}=await sb.from("measurements").select("point_id").eq("project_id",pid).order("point_id",{ascending:false}).limit(1);
$("mPoint").value=(data&&data.length)?((data[0].point_id||0)+1):1;
}catch(e){}
}

async function queryPointId(){
 const pid=+$("mProject").value,pt=+$("mPoint").value,res=$("pointQueryResult");
 if(!pid||!pt){res.style.display="none";return;}
 const{data}=await sb.from("measurements").select("*").eq("project_id",pid).eq("point_id",pt).order("created_at",{ascending:false}).limit(1);
 if(data&&data.length>0){
  const r=data[0];
  res.style.display="block";res.className="alert info";
  res.innerHTML=`✓ <b>P${r.point_id}</b> · ${esc(r.species)} · Çap ${r.dbh_cm} cm · Boy ${r.height_m} m · Karbon ${(r.carbon_kg||0).toFixed(1)} kg · Durum: <b>${r.status||"Beklemede"}</b>`+
   (r.photo_url?`<br><img src="${esc(r.photo_url)}" style="width:140px;border-radius:8px;margin-top:6px">`:"")+
   `<br><button class="btn sm blue" onclick="editRec(${r.id})" style="margin-top:8px">✏️ Düzenle & Güncelle</button> <button class="btn sm red" onclick="delRec(${r.id})" style="margin-top:8px">🗑️ Tamamen Sil</button>`;
 }else{
  res.style.display="block";res.className="alert info";
  res.innerHTML=`ℹ P${pt} için kayıt yok · Yeni kayıt oluşturulacak.`;
 }
}
/* --- 7. KAYDET (EN BÜYÜK) --- */
async function saveMeas(){
    const pid=+$("mProject").value,pt=+$("mPoint").value,sp=$("mSpecies").value,d=+$("mDbh").value,h=+$("mHeight").value,grp=$("mGroup").value;
    if(!pid||!pt||!sp||!d||!h)return toast("Tüm alanları doldur","err");

    /* ⛔ PARK KAPISI: park algılanmamış projeye ölçüm girilemez. Düzenleme
     * (EDIT_ID) mevcut kaydı günceller, yeni ölçüm değildir → kapı uygulanmaz.
     * Aynı kural sunucuda trg_enforce_park_link ile de zorlanır (PARK_REQUIRED). */
    const gateProj=(PROJ_LIST||[]).find(p=>p.id===pid);
    if(DG_PARK_SCHEMA_OK&&!EDIT_ID&&(!gateProj||!gateProj.park_id)){
        toast("⛔ Bu projede park algılanmadı — ölçüm giremezsin. Park algılama ekranına yönlendiriliyorsun.","err","🌳");
        startParkScan({projectId:pid||null,returnTo:"measure"});
        return;
    }
    if(!EDIT_ID&&!GPS)return toast("Önce 📡 Konumu Etkinleştir butonuna basın","err");
    if(d>500||h>100)return toast("Çap ≤500 cm, boy ≤100 m olmalı","err");
    
    const f=$("mPhoto").files[0];
    if(f&&!photoOk)return toast("Fotoğraf denetimi başarısız — uygun bir çekim yapın","err");
    
    const wasEdit=!!EDIT_ID;
    const c=calc(d,h,sp,grp);
    
    // 1. Fotoğrafı sıkıştır (henüz upload etme, sadece Blob olarak hazırla)
    let photoBlob = null;
    let photoFile = null;
    if(f){
        photoBlob = await compress(f);
        photoFile = "P"+String(pt).padStart(3,"0")+"_M"+(+$("mNo").value||1)+".JPG";
    }
    
    // 2. base objesini oluştur
    const base={
        owner:USER.id,
        project_id:pid,
        /* Denormalize park kimliği: v_park_compare hem bunu hem projects.park_id'i
         * okur; dışa aktarımda park alanı/kimliği satır düzeyinde taşınır.
         * Şema eskiyse sütun hiç gönderilmez (yoksa insert 42703 ile patlar). */
        point_id:pt,
        measurement_no:+$("mNo").value||1,
        grp,species:sp,
        dbh_cm:d,
        height_m:h,
        volume_m3:c.vol,
        carbon_kg:c.total_carbon,
        slope_deg:0,
        shared:true,
        status:"Beklemede"
    };
    if(DG_PARK_SCHEMA_OK)base.park_id=(gateProj&&gateProj.park_id)||null;

    // 5. Supabase insert/update
// ⭐ EKLENEN: Her insert'te client_id ekle (duplicate koruması)
if (!base.client_id) base.client_id = uuidv4();
    if(!EDIT_ID){
        base.lat=GPS.latitude;
        base.lon=GPS.longitude;
        base.accuracy_m=GPS.accuracy;
        base.altitude_m=GPS.altitude;
        const geo=await reverseGeocode(GPS.latitude,GPS.longitude);
        base.country=geo?geo.country:"Bilinmiyor";
        base.city=geo?geo.city:"Bilinmiyor";
        if(geo)toast("📍 Konum algılandı: "+esc(geo.city)+" / "+esc(geo.country),"info","🗺️");
    }
    
     // 3. OFFLINE KONTROLÜ (Fotoğraf ve veriyi IndexedDB'ye kaydet)
    if(!navigator.onLine){
        if(photoBlob) base.photoBlob = photoBlob;
        if(photoFile) base.photo_file = photoFile;
        base.client_id = uuidv4(); // Benzersiz ID (duplicate önleme)
if(EDIT_ID) base._editId = EDIT_ID; // ✅ çevrimdışı düzenleme işareti
        
        await saveOfflineMeasurement(base);
        toast('Çevrimdışı kaydedildi — internet gelince senkronize','info','📴');
        
        // ✅ Background Sync register KALDIRILDI (artık ana thread yönetiyor)
        
        $('mPoint').value='';
        $('mDbh').value='';
        $('mHeight').value='';
        $('mPhoto').value='';
        $('photoCheck').style.display='none';
        photoOk=false;
        manualPoint=false;
        loadDash();
        loadRecords();
        return;
    }
    
    // 4. ONLINE: Fotoğrafı Supabase Storage'a yükle
    let photoUrl = null;
    if(photoBlob){
        const path = USER.id+"/"+Date.now()+".jpg";
        const {error} = await sb.storage.from("dendro-photos").upload(path, photoBlob, {contentType:"image/jpeg"});
        if(!error){
            photoUrl = sb.storage.from("dendro-photos").getPublicUrl(path).data.publicUrl;
        }
    }
    if(photoUrl){
        base.photo_url = photoUrl;
        base.photo_file = photoFile;
    }
    
    // 5. Supabase insert/update
    if(EDIT_ID){
        const{error}=await sb.from("measurements").update(base).eq("id",EDIT_ID);
        if(error)return toast("Hata: "+error.message,"err");
        toast("Kayıt güncellendi — onaya gönderildi","ok","✓");
        cancelEdit();
    }else{
        let{error}=await sb.from("measurements").insert(base);
        if(error){delete base.altitude_m;delete base.photo_file;({error}=await sb.from("measurements").insert(base));}
        if(error)return toast("Hata: "+error.message,"err");
        toast("Kaydedildi — "+c.total_carbon.toFixed(1)+" kg karbon","ok","🌱");
    }
    
    $("mPoint").value='';
    $("mDbh").value='';
    $("mHeight").value='';
    $("mPhoto").value='';
    $("photoCheck").style.display="none";
    $("pointQueryResult").style.display="none";
    photoOk=false;
    manualPoint=false;
    loadDash();
    loadRecords();
    loadWaypoints();
    if(!wasEdit)autoFillPointId();
}

/* --- 8. DÜZENLEME --- */
function cancelEdit(){EDIT_ID=null;manualPoint=false;$("editBanner").style.display="none";$("saveBtn").textContent="💾 Hesapla ve Kaydet";dgParkGate();}
async function editRec(id){
 const{data}=await sb.from("measurements").select("*").eq("id",id).single();
 if(!data)return;
 EDIT_ID=id;
 $("mProject").value=data.project_id;
 $("mPoint").value=data.point_id;$("mNo").value=data.measurement_no||1;
 $("mGroup").value=data.grp||"";fillSpecies();$("mSpecies").value=data.species;showLatin();
 $("mDbh").value=data.dbh_cm;$("mHeight").value=data.height_m;
 $("editBanner").style.display="block";$("saveBtn").textContent="💾 Kaydı Güncelle";
 liveCalc();go("measure");dgProjectChanged();
}
/* --- 9. FOTOĞRAF İŞLEME --- */
function compress(f){
return new Promise(res=>{
const i=new Image(),u=URL.createObjectURL(f);
i.onload=()=>{const m=1024,sc=Math.min(1,m/Math.max(i.width,i.height)),c=document.createElement("canvas");c.width=i.width*sc;c.height=i.height*sc;c.getContext("2d").drawImage(i,0,0,c.width,c.height);c.toBlob(b=>{URL.revokeObjectURL(u);res(b);},"image/jpeg",.7);};i.src=u;});}
async function removePhoto(url){
 if(!url)return;
 try{
  let p=url.split("/dendro-photos/")[1];
  if(p){await sb.storage.from("dendro-photos").remove([p]);}
 }catch(e){}
 try{
  const p2=decodeURIComponent(url.split("/dendro-photos/")[1]||"");
  if(p2)await sb.storage.from("dendro-photos").remove([p2]);
 }catch(e){}
}
