async function downloadParkImage(){
 if(!PARK_POLY||!PARK_POLY.length)return toast("Önce park seç","warn");
 const bg=$("pngBg")?$("pngBg").value:"vector";
 const incGrid=($("chkPngGrid")?$("chkPngGrid").checked:true)&&GRID_CELLS.length>0;
 const incWp=($("chkPngWp")?$("chkPngWp").checked:true);
 const incCover=($("chkPngCover")?$("chkPngCover").checked:true);
 const wpRows=(LAST_WP_ROWS.length?LAST_WP_ROWS:WP).filter(w=>pointInPark(w.lat,w.lon,PARK_POLY));
 const showWp=incWp&&wpRows.length>0;

 const W=1600,H=1200;
 const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext("2d");
 const mapC=document.createElement("canvas");mapC.width=W;mapC.height=H;
 const mctx=mapC.getContext("2d");
 mctx.fillStyle="#ffffff";mctx.fillRect(0,0,W,H);

 let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
 PARK_POLY.forEach(r=>r.forEach(p=>{
  if(p[0]<minLat)minLat=p[0];if(p[0]>maxLat)maxLat=p[0];
  if(p[1]<minLon)minLon=p[1];if(p[1]>maxLon)maxLon=p[1];
 }));
 const pad=0.0004;minLat-=pad;maxLat+=pad;minLon-=pad;maxLon+=pad;
 const dLat=maxLat-minLat,dLon=maxLon-minLon;
 const scale=Math.min((W-140)/dLon,(H-200)/dLat);
 const ox=(W-dLon*scale)/2,oy=(H-dLat*scale)/2+30;
 const toXY=(lat,lon)=>[ox+(lon-minLon)*scale, oy+(maxLat-lat)*scale];

 if(bg!=="vector"){
  const ok=await drawTiles(mctx,bg,minLat,minLon,maxLat,maxLon,scale,ox,oy);
  if(!ok){mctx.fillStyle="#ffffff";mctx.fillRect(0,0,W,H);toast("⚠ Tile yüklenemedi → vektör","warn");}
 }
 if(incCover){
  IMP_RINGS.forEach(r=>{
   if(!r||r.length<3)return;
   mctx.fillStyle="#9ca3af55";mctx.strokeStyle="#6b7280";mctx.lineWidth=1;
   mctx.beginPath();
   r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?mctx.moveTo(xy[0],xy[1]):mctx.lineTo(xy[0],xy[1]);});
   mctx.closePath();mctx.fill();mctx.stroke();
  });
  IMP_LINES.forEach(l=>{
   mctx.strokeStyle="#6b728088";mctx.lineWidth=Math.max(1.5,l.w*scale/55660);
   mctx.beginPath();
   l.pts.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?mctx.moveTo(xy[0],xy[1]):mctx.lineTo(xy[0],xy[1]);});
   mctx.stroke();
  });
  WATER_RINGS.forEach(r=>{
   if(!r||r.length<3)return;
   mctx.fillStyle="#60a5fa99";mctx.strokeStyle="#2563eb";mctx.lineWidth=1.5;
   mctx.beginPath();
   r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?mctx.moveTo(xy[0],xy[1]):mctx.lineTo(xy[0],xy[1]);});
   mctx.closePath();mctx.fill();mctx.stroke();
  });
 }
 if(incGrid){
  GRID_CELLS.forEach(c=>{
   const a=toXY(c.s0,c.w0),b=toXY(c.s1,c.w1);
   const col=c.n===0?"#e11d48":"#16a34a";
   mctx.fillStyle=col+"66";mctx.strokeStyle=col;mctx.lineWidth=1;
   mctx.fillRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
   mctx.strokeRect(a[0],a[1],b[0]-a[0],b[1]-a[1]);
  });
 }

 /* MASKE: sadece park şekli kalır */
 mctx.globalCompositeOperation="destination-in";
 mctx.beginPath();
 PARK_POLY.forEach(r=>{
  r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?mctx.moveTo(xy[0],xy[1]):mctx.lineTo(xy[0],xy[1]);});
  mctx.closePath();
 });
 mctx.fill();
 mctx.globalCompositeOperation="source-over";

 ctx.fillStyle="#ffffff";ctx.fillRect(0,0,W,H);
 ctx.drawImage(mapC,0,0);

 /* Sınır + waypoint maskeden sonra (keskin) */
 ctx.strokeStyle="#2b6cb0";ctx.lineWidth=3;ctx.setLineDash([12,8]);
 PARK_POLY.forEach(r=>{
  ctx.beginPath();
  r.forEach((p,i)=>{const xy=toXY(p[0],p[1]);i===0?ctx.moveTo(xy[0],xy[1]):ctx.lineTo(xy[0],xy[1]);});
  ctx.closePath();ctx.stroke();
 });
 ctx.setLineDash([]);
 if(showWp){
  wpRows.forEach(w=>{
   const xy=toXY(w.lat,w.lon);
   ctx.fillStyle="#e11d48";ctx.beginPath();ctx.arc(xy[0],xy[1],5,0,Math.PI*2);ctx.fill();
   ctx.strokeStyle="#fff";ctx.lineWidth=1.5;ctx.stroke();
  });
 }

 const name=(PARK_CANDS[0]&&PARK_CANDS[0].name)||"İsimsiz Park";
 const haTotal=(polyArea(PARK_POLY)/10000).toFixed(1);
 ctx.fillStyle="#14532d";ctx.fillRect(0,0,W,64);
 ctx.fillStyle="#fff";ctx.font="bold 24px system-ui";
 ctx.fillText("🌳 "+name+" — Saha Raporu",24,40);

 const lines=[
  "DendroGeo · Park Raporu",
  "Park: "+name,
  "Toplam alan: "+haTotal+" ha (geodezik)",
  ...(PARK_REF_HA?["Referans: "+PARK_REF_HA+" ha (sapma %"+Math.abs(((polyArea(PARK_POLY)/10000-PARK_REF_HA)/PARK_REF_HA)*100).toFixed(1)+")"]:[]),
  incGrid?("Grid: "+GRID_CELLS.length+" hücre ("+($("gridSize")?.value||20)+"×"+($("gridSize")?.value||20)+" m)"):"Grid: —",
  showWp?("Waypoint: "+wpRows.length):"Waypoint: —",
  "Altlık: "+(bg==="vector"?"Vektör":(bg==="osm"?"OSM":(bg==="sat"?"Uydu":"Topo")))+" · "+new Date().toLocaleDateString("tr-TR")
 ];
 const bw=380,bh=lines.length*24+20;
 ctx.fillStyle="rgba(255,255,255,.95)";ctx.strokeStyle="#94a3b8";ctx.lineWidth=1;
 ctx.fillRect(W-bw-24,H-bh-24,bw,bh);ctx.strokeRect(W-bw-24,H-bh-24,bw,bh);
 ctx.fillStyle="#1f2937";ctx.font="13px system-ui";
 lines.forEach((t,i)=>ctx.fillText(t,W-bw-8,H-bh-4+24*(i+1)));

 const lg=[];
 if(incGrid){lg.push(["#16a34a","Ölçülmüş"],["#e11d48","Boş"]);}
 if(showWp)lg.push(["#e11d48","Waypoint"]);
 if(incCover){lg.push(["#60a5fa","Su"],["#9ca3af","Sert zemin"]);}
 lg.push(["#2b6cb0","Park sınırı"]);
 ctx.font="13px system-ui";
 lg.forEach((e,i)=>{
  const y=90+i*22;
  ctx.fillStyle=e[0];ctx.fillRect(W-190,y,16,14);
  ctx.strokeStyle="#333";ctx.strokeRect(W-190,y,16,14);
  ctx.fillStyle="#1f2937";ctx.fillText(e[1],W-168,y+12);
 });

 const mPerDeg=111320*Math.cos(((minLat+maxLat)/2)*Math.PI/180);
 const barPx=200*scale/mPerDeg;
 ctx.fillStyle="#1f2937";ctx.fillRect(24,H-36,barPx,8);
 ctx.font="bold 12px system-ui";ctx.fillText("200 m",24+barPx+8,H-28);

 canvas.toBlob(b=>{
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");
  a.href=u;a.download="dendrogeo_"+name.replace(/[^a-z0-9_]/gi,"_")+"_rapor.png";a.click();
  setTimeout(()=>URL.revokeObjectURL(u),1000);
  toast("✓ Rapor PNG indirildi (yalnızca park alanı)","ok","🖼️");
 },"image/png");
}
