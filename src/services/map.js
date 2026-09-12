"use strict";
/* ===== DendroGeo v2 · src/services/map.js =====
Harita init, marker yönetimi, waypoint CRUD, navigasyon çizimi */

// 1. Marker HTML üretici
function popupHtml(r){
 return `<div style="min-width:140px"><b>P${r.point_id}</b> · ${esc(r.species)}<br><span style="font-size:.75rem;color:#68766e">Çap: ${r.dbh_cm||"—"} cm · Boy: ${r.height_m||"—"} m<br>Karbon: ${(r.carbon_kg||0).toFixed(1)} kg</span>`+(r.photo_url?`<br><img src="${esc(r.photo_url)}" style="width:160px;border-radius:8px;margin-top:6px">`:"")+`</div>`;
}
// 2. Marker yükleme (chunked)
function addMarkersChunked(m,rows,chunk=150){
 let i=0;
 if(!m._cluster){
  m._cluster=L.markerClusterGroup({
   maxClusterRadius:80,
   spiderfyOnMaxZoom:true,
   showCoverageOnHover:false,
   disableClusteringAtZoom:15,
   iconCreateFunction:c=>{
    const n=c.getChildCount();
    const cls=n<10?"small":n<50?"medium":"large";
    return L.divIcon({html:`<div>${n}</div>`,className:`marker-cluster marker-cluster-${cls}`,iconSize:[40,40]});
   }
  });
  m.addLayer(m._cluster);
 }
 (function step(){
  const end=Math.min(i+chunk,rows.length);
  for(;i<end;i++){
   const r=rows[i];
   const mk=L.marker([r.lat,r.lon],{
    icon:L.divIcon({
     className:'tree-marker',
     html:`<div style="width:14px;height:14px;border-radius:50%;background:#1e6f4b;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
     iconSize:[18,18],
     iconAnchor:[9,9]
    })
   });
   mk.bindPopup(popupHtml(r));
   m._cluster.addLayer(mk);
  }
  if(i<rows.length)setTimeout(step,16);
 })();
}
// 3. Onaylı marker'ları getir
async function loadApprovedMarkers(m,limit,done){
 try{
  const{data}=await sb.from("measurements")
   .select("lat,lon,point_id,species,dbh_cm,height_m,carbon_kg,photo_url,grp")
   .eq("status","Onaylı").limit(limit);
  const rows=(data||[]).filter(r=>Number.isFinite(+r.lat)&&Number.isFinite(+r.lon));
  addMarkersChunked(m,rows);
  done&&done(rows.length,rows);
 }catch(e){done&&done(0,[]);}
}
// 4. Canlı harita
async function loadLiveMap(){
 const el=$("mapLoad");
 await loadApprovedMarkers(map,3000,(n,rows)=>{
  el.textContent="✓ "+n+" onaylı kayıt yüklendi · noktaya dokun → bilgi + fotoğraf.";
  el.className="alert ok";setTimeout(()=>el.style.display="none",3000);
  renderAnalysis(rows,"liveAnalysis");
 });
}
// 5. Harita başlatma
function initMaps(){
 if(!map){map=L.map("map").setView([39.99,32.65],12);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);}
 if(!navMap){navMap=L.map("navMap").setView([39.992,32.6498],15);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(navMap);}
 if(!worldMap){worldMap=L.map("worldMap").setView([39,35],3);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(worldMap);}
}
// 6. Waypoint CRUD
async function uploadWpCsv(){
 const pid=+$("nProject").value;if(!pid)return toast("Proje seç");
 const f=$("nCsv").files[0];if(!f)return toast("CSV seç");
 const lines=(await f.text()).split(/\r?\n/);let n=0;
 for(let i=1;i<lines.length;i++){const c=lines[i].split(",");if(c.length<3)continue;const id=parseInt((c[2]||"").replace(/"/g,""));const lon=+c[0],lat=+c[1];if(!id||!lat||!lon)continue;await sb.from("waypoints").upsert({owner:USER.id,project_id:pid,wp_id:id,lat,lon},{onConflict:"project_id,wp_id"});n++;}
 toast("✓ "+n+" waypoint yüklendi ve projeye kalıcı kaydedildi.");
 loadWaypoints();
}
async function loadWaypoints(){
 const pid=+$("nProject").value;
 if(!pid){$("wpListTable").innerHTML="<tr><td colspan=5 style='text-align:center;color:var(--mut)'>Önce proje seçin.</td></tr>";return;}
 const{data}=await sb.from("waypoints").select("*").eq("project_id",pid).order("wp_id",{ascending:true});
 WP=data||[];
 if(navTarget&&navTarget.project_id!==pid)navTarget=null;
 drawNav();
 $("dWp").textContent=WP.length;$("dVisit").textContent=WP.filter(w=>w.visited).length;
 const done=WP.filter(w=>w.visited).length;
 $("navInfo").innerHTML=`📌 <b>${WP.length}</b> waypoint kayıtlı · <b>${done}</b> yapıldı · <b>${WP.length-done}</b> bekliyor. Liste kalıcıdır.`;
 $("wpListTable").innerHTML=WP.length?WP.map(w=>`<tr class="${w.visited?'done':''}"><td><b>P${w.wp_id}</b></td><td>${w.lat.toFixed(6)}</td><td>${w.lon.toFixed(6)}</td><td>${w.visited?'<span class="badge on">✓ Yapıldı</span>':'<span class="badge admin">Bekliyor</span>'}</td><td>${w.visited?'':`<button class="btn sm blue" onclick="selectWaypoint(${w.id})">🎯 Hedef</button>`}</td></tr>`).join(""):"<tr><td colspan=5 style='text-align:center;color:var(--mut)'>Bu projede waypoint yok. CSV yükleyin.</td></tr>";
}
async function deleteAllWaypoints(){
 const pid=+$("nProject").value;
 if(!pid)return toast("Proje seç");
 if(!confirm("⚠ Bu projedeki TÜM waypoint'ler kalıcı olarak silinsin mi? Yanlış liste ise sonra yeniden yükleyebilirsiniz."))return;
 const{error}=await sb.from("waypoints").delete().eq("project_id",pid);
 if(error)return toast("Hata: "+error.message,"err");
 navTarget=null;WP=[];
 toast("✓ Liste tamamen silindi. Yeni CSV yükleyebilirsiniz.");
 loadWaypoints();
}
async function selectWaypoint(id){
 const w=WP.find(x=>x.id===id);if(!w)return;
 navTarget=w;
 if(!manualPoint)$("mPoint").value=w.wp_id;
 drawNav();
}
// 7. Navigasyon çizimi
function drawNav(){
 if(!navMap)return;
 navMap.eachLayer(l=>{if(l._wp)navMap.removeLayer(l);});
 WP.forEach(w=>{
  const icon=L.divIcon({className:"",html:`<div class="wp-badge" style="background:${w.visited?"#16a34a":"#e11d48"}">${w.wp_id}</div>`,iconSize:[26,26],iconAnchor:[13,13]});
  const m=L.marker([w.lat,w.lon],{icon}).addTo(navMap);m._wp=1;
  m.bindPopup(w.visited?"<s>P"+w.wp_id+"</s> ✓ Yapıldı":"P"+w.wp_id+" · Hedef yapmak için tıkla");
  m.on("click",()=>{selectWaypoint(w.id);});
 });
 if(GPS){const me=L.circleMarker([GPS.latitude,GPS.longitude],{radius:8,color:"#2b6cb0",weight:3,fillOpacity:.9}).addTo(navMap);me._wp=1;
  if(!navTarget){const ts=WP.filter(w=>!w.visited);if(ts.length)navTarget=ts.sort((a,b)=>hav(GPS.latitude,GPS.longitude,a.lat,a.lon)-hav(GPS.latitude,GPS.longitude,b.lat,b.lon))[0];}
  if(navTarget&&!navTarget.visited){const d=hav(GPS.latitude,GPS.longitude,navTarget.lat,navTarget.lon),b=brg(GPS.latitude,GPS.longitude,navTarget.lat,navTarget.lon);
   $("navDist").textContent=Math.round(d)+" m";$("navTarget").textContent="Hedef: P"+navTarget.wp_id+" · "+Math.round(b)+"°";
   $("navArrow").style.transform="rotate("+b+"deg)";
   const ln=L.polyline([[GPS.latitude,GPS.longitude],[navTarget.lat,navTarget.lon]],{color:"#c2452d",dashArray:"5,8",weight:2}).addTo(navMap);ln._wp=1;
  }else{$("navDist").textContent="—";$("navTarget").textContent="Hedef seç / tamamlandı";$("navArrow").style.transform="rotate(0)";}
 }
}
// 8. Waypoint'e varış
async function arriveWp(){
 if(!navTarget)return toast("Hedef yok");
 if(!manualPoint)$("mPoint").value=navTarget.wp_id;
 await sb.from("waypoints").update({visited:true}).eq("id",navTarget.id);
 await loadWaypoints();
 go("measure");
}
