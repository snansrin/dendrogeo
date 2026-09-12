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
async function startGps(){
 const gpsMsg=(t,e)=>{const g=$("gpsState");g.textContent=t;g.className="alert "+(e?"err":"info");};
 if(!navigator.geolocation)return gpsMsg("Tarayıcı konum desteklemiyor.",1);
 if(/iPhone|iPad|iPod/.test(navigator.userAgent))$("iosHint").style.display="block";
 try{if(navigator.permissions&&navigator.permissions.query){const p=await navigator.permissions.query({name:"geolocation"});if(p.state==="denied")return gpsMsg("Konum izni reddedildi. Ayarlar→Safari→Konum.",1);}}catch(e){}
 gpsMsg("Konum alınıyor…",0);
 const opts={enableHighAccuracy:true,timeout:15000,maximumAge:0};
 const onOk=p=>{GPS=p.coords;updGps();navigator.geolocation.watchPosition(p2=>{GPS=p2.coords;updGps();},()=>{},{...opts,maximumAge:1000});};
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
async function loadProjects(){
 if(!USER)return;
 const{data}=await sb.from("projects").select("*").eq("owner",USER.id);
 PROJ_LIST=data||[];
 const opts=PROJ_LIST.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
 $("mProject").innerHTML=opts||"<option value=''>Önce proje oluşturun</option>";
 $("nProject").innerHTML=opts||"<option value=''>Önce proje oluşturun</option>";
 $("projTable").innerHTML=PROJ_LIST.map(p=>`<tr><td>${p.id}</td><td>${esc(p.name)}</td><td>${esc(p.country||"—")}</td><td>${esc(p.city||"—")}</td><td>${new Date(p.created_at).toLocaleDateString("tr-TR")}</td><td style="display:flex;gap:4px"><button class="btn sm blue" onclick="editProject(${p.id})">✏️</button><button class="btn sm red" onclick="deleteProject(${p.id})">🗑</button></td></tr>`).join("")||"<tr><td colspan=6>Proje yok</td></tr>";
}
function editProject(id){
 const p=PROJ_LIST.find(x=>x.id===id);if(!p)return;
 EDIT_PROJ=id;$("pName").value=p.name;$("pCountry").value=p.country||"";$("pCity").value=p.city||"";
 $("projSaveBtn").textContent="💾 Projeyi Güncelle";$("projCancelBtn").style.display="inline-block";
}
function cancelProjectEdit(){EDIT_PROJ=null;$("pName").value="";$("projSaveBtn").textContent="+ Proje Oluştur";$("projCancelBtn").style.display="none";}
async function createProject(){
 const n=$("pName").value;if(!n)return toast("Proje adı gerekli","err");
 if(EDIT_PROJ){
  await sb.from("projects").update({name:n,country:$("pCountry").value,city:$("pCity").value}).eq("id",EDIT_PROJ);
  cancelProjectEdit();
 }else{
  await sb.from("projects").insert({owner:USER.id,name:n,country:$("pCountry").value,city:$("pCity").value});
 }
 loadProjects();
}
async function deleteProject(id){
 const{count}=await sb.from("measurements").select("*",{count:"exact",head:true}).eq("project_id",id);
 if(!confirm("Proje silinsin mi? Bağlı "+(count||0)+" ölçüm ve waypoint'ler de silinebilir."))return;
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
function cancelEdit(){EDIT_ID=null;manualPoint=false;$("editBanner").style.display="none";$("saveBtn").textContent="💾 Hesapla ve Kaydet";}
async function editRec(id){
 const{data}=await sb.from("measurements").select("*").eq("id",id).single();
 if(!data)return;
 EDIT_ID=id;
 $("mProject").value=data.project_id;
 $("mPoint").value=data.point_id;$("mNo").value=data.measurement_no||1;
 $("mGroup").value=data.grp||"";fillSpecies();$("mSpecies").value=data.species;showLatin();
 $("mDbh").value=data.dbh_cm;$("mHeight").value=data.height_m;
 $("editBanner").style.display="block";$("saveBtn").textContent="💾 Kaydı Güncelle";
 liveCalc();go("measure");
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
