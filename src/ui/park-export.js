"use strict";
/* DendroGeo · ui/park-export.js — DIŞA AKTARIM + LULC KÖPRÜSÜ (Faz 4)
 * gridplan.js'ten birebir taşındı: GeoJSON/CSV/PNG indirmeleri (vektörel
 * PNG çizimi dgPx* ile), runLandCoverAnalysis köprüsü (window.DG_LANDCOVER
 * sözleşmesi) ve download* sarmalayıcıları.
 * NOT: downloadLandCoverClassCSV/CellsGeoJSON landcover.js'te de tanımlı;
 * eskiden gridplan.js SONRA yüklendiği için onun sürümü kazanırdı — aynı
 * göreli sıra korundu (bu dosya landcover zincirinden sonra yüklenir). */

/* =========================================================
   LINE UTILITIES
========================================================= */


function downloadBlob(
  name,
  mime,
  text
){
  const b=
    new Blob(
      [text],
      {
        type:mime
      }
    );

  const u=
    URL.createObjectURL(b);

  const a=
    document.createElement(
      "a"
    );

  a.href=u;
  a.download=name;
  a.click();

  setTimeout(
    ()=>URL.revokeObjectURL(u),
    1000
  );
}

function downloadGridGeoJSON(){
  if(!GRID_CELLS.length){
    return toast(
      "Önce grid"
    );
  }

  const fc={
    type:"FeatureCollection",

    features:
      GRID_CELLS.map(c=>({
        type:"Feature",

        properties:{
          id:c.id,
          olcum:c.n,
          durum:
            c.n===0
              ?"bos"
              :"olculmus"
        },

        geometry:{
          type:"Polygon",

          coordinates:[
            [
              [c.w0,c.s0],
              [c.w1,c.s0],
              [c.w1,c.s1],
              [c.w0,c.s1],
              [c.w0,c.s0]
            ]
          ]
        }
      }))
  };

  downloadBlob(
    "dendrogeo_grid.geojson",
    "application/geo+json",
    JSON.stringify(
      fc,
      null,
      2
    )
  );

  toast(
    "✓ Grid indirildi",
    "ok",
    "📥"
  );
}

function downloadWaypointsCSV(){
  const rows=
    LAST_WP_ROWS.length
      ?LAST_WP_ROWS
      :WP;

  if(
    !rows||
    !rows.length
  ){
    return toast(
      "WP yok"
    );
  }

  let csv=
    "wp_id,lat,lon,visited\n";

  rows.forEach(r=>{
    csv+=
      r.wp_id+
      ","+
      r.lat+
      ","+
      r.lon+
      ","+
      (r.visited?1:0)+
      "\n";
  });

  downloadBlob(
    "dendrogeo_wp.csv",
    "text/csv",
    csv
  );

  toast(
    "✓ "+
    rows.length+
    " WP",
    "ok",
    "📥"
  );
}

/* =========================================================
   LAND-COVER BRIDGE
   Numeric analysis lives in src/services/landcover.js.
========================================================= */

async function runLandCoverAnalysis(){
  if(window._dgLandCoverBusy){
    return toast("Arazi örtüsü analizi zaten çalışıyor.","info","🛰️");
  }

  /* Faz 8: LULC zinciri artık TEMBEL — ilk kullanımda sırayla yüklenir.
   * Yüklenemezse kullanıcıya sebep söylenir (sessiz başarısızlık yok). */
  if(!window.DG_LANDCOVER && typeof dgEnsureLulc==="function"){
    toast("🛰️ Arazi örtüsü modülü yükleniyor…","info");
    try{
      await dgEnsureLulc();
    }catch(err){
      return toast("Arazi örtüsü modülü yüklenemedi: "+((err&&err.message)||err),"err","🛰️");
    }
  }

  if(!window.DG_LANDCOVER || typeof window.DG_LANDCOVER.analyze!=="function"){
    return toast("10 m arazi örtüsü modülü yüklenmedi.","err","🗺️");
  }

  if(!PARK_POLY || !PARK_POLY.length){
    return toast("Önce park seç","warn","🌳");
  }

  window._dgLandCoverBusy=true;
  const btn=$("landCoverBtn");
  if(btn){
    btn.disabled=true;
    btn.dataset.oldText=btn.innerHTML;
    btn.innerHTML="⏳ Analiz yapılıyor…";
    btn.style.opacity=".65";
    btn.style.cursor="wait";
  }

  const rep=$("landCoverReport");
  if(rep){
    rep.style.display="block";
    rep.innerHTML=
      "<b>🛰️ Arazi örtüsü analizi çalışıyor…</b>"+
      "<div style='font-size:.72rem;color:var(--mut);margin-top:6px'>"+
      "10 m raster verisi park polygonu ile kesiştiriliyor. Bu işlem bağlantıya göre biraz sürebilir; sonuç tamamlanmadan rapor yazılmayacak."+
      "</div>";
  }

  toast(
    "Arazi örtüsü analizi başladı. 10 m raster verisi okunuyor…",
    "info",
    "🛰️"
  );

  const parkArea=parkAreaM2();

  window.DG_LANDCOVER.analyze({
    outer:PARK_POLY,
    holes:PARK_HOLES||[],
    parkAreaM2:parkArea
  }).then(result=>{
    if(window.DG_LANDCOVER_RENDER_REPORT){
      window.DG_LANDCOVER_RENDER_REPORT(rep,result,parkArea);
    }
    toast(
      "✓ 10 m arazi örtüsü analizi tamamlandı (ESA WorldCover 2021 + çapraz IO LULC 2020).",
      "ok",
      "🗺️"
    );
  }).catch(err=>{
    console.error("DENDROGEO · Arazi örtüsü analizi:",err);
    if(rep){
      rep.style.display="block";
      rep.innerHTML=
        "<b>❌ 10 m arazi örtüsü analizi tamamlanamadı.</b>"+
        "<div style='font-size:.74rem;color:var(--red);margin-top:7px'>"+esc(err?.message||String(err))+"</div>"+
        "<div style='font-size:.68rem;color:var(--mut);margin-top:7px'>Geçersiz veya eksik sonuç rapora yazılmadı.</div>";
    }
    toast("Arazi örtüsü analizi hatası: "+(err?.message||String(err)),"err","🗺️");
  }).finally(()=>{
    window._dgLandCoverBusy=false;
    if(btn){
      btn.disabled=false;
      btn.innerHTML=btn.dataset.oldText||"🌿 Yüzey Örtüsü Analizi";
      btn.style.opacity="";
      btn.style.cursor="";
    }
  });
}

function downloadLandCoverClassCSV(){
  if(window.DG_LANDCOVER && typeof window.DG_LANDCOVER.downloadClassCSV==="function"){
    return window.DG_LANDCOVER.downloadClassCSV();
  }
  return toast("CSV dışa aktarma modülü hazır değil.","err","📥");
}

function downloadLandCoverCellsGeoJSON(){
  if(window.DG_LANDCOVER && typeof window.DG_LANDCOVER.downloadCellsGeoJSON==="function"){
    return window.DG_LANDCOVER.downloadCellsGeoJSON();
  }
  return toast("GeoJSON dışa aktarma modülü hazır değil.","err","📍");
}

/* ---------------------------------------------------------------------------
 * PNG DIŞA AKTARIM (vektörel, karosuz)
 *
 * "🖼️ PNG İndir" butonu daha önce TANIMSIZ bir fonksiyonu çağırıyordu
 * (downloadParkImage hiç yazılmamıştı → ReferenceError). Bu gerçekleme
 * haritayı Leaflet/karo üzerinden değil, DOĞRUDAN VEKTÖREL çizerek üretir:
 *   · karo (tile) görüntüsü kullanılmaz → CORS/taint/offline sorunu YOK
 *   · her zaman çalışır, çıktısı temiz ve baskıya uygun
 * Katmanlar paneldeki anahtarlara bağlıdır: chkPngGrid / chkPngWp / chkPngCover.
 * ------------------------------------------------------------------------- */
function dgPxProjector(minLat,maxLat,minLon,maxLon,W,Htop,scale){
  const lat0=(minLat+maxLat)/2,lon0=(minLon+maxLon)/2;
  const MX=111320*Math.cos(lat0*Math.PI/180),MY=110540;
  return{
    lat0,lon0,MX,MY,scale,
    X(lon){return W/2+(lon-lon0)*MX*scale;},
    Y(lat){return Htop+(maxLat-lat)*MY*scale;}
  };
}

function dgPxRingPath(ctx,pr,ring){
  ctx.beginPath();
  ring.forEach((p,i)=>{
    const x=pr.X(p[1]),y=pr.Y(p[0]);
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  });
  ctx.closePath();
}

function downloadParkImage(){
  if(!PARK_POLY||!PARK_POLY.length){
    return toast("Önce park seç","warn","🌳");
  }
  const chk=id=>{const e=document.getElementById(id);return !e||e.checked;};
  /* KULLANICI İSTEĞİ (2026-09-20): "png sadece parkın alanı olsun, onun
   * dışında bir şey gösterilmesin". Sınırlar YALNIZCA park polygonundan
   * türer (grid/WP sınırları büyütmez); çizim park polygonuna kırpılır:
   * park dışına kaymış waypoint/grid kalıntıları görünmez. */
  const opts={grid:chk("chkPngGrid"),wp:chk("chkPngWp"),cover:chk("chkPngCover"),clipPark:true};
  const lc=(window.DG_LANDCOVER&&window.DG_LANDCOVER.getLast)?window.DG_LANDCOVER.getLast():null;
  try{
    /* sınırlar: park + seçili katmanlar */
    let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
    const ext=(lat,lon)=>{
      minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);
      minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);
    };
    (PARK_POLY||[]).forEach(r=>(r||[]).forEach(p=>ext(p[0],p[1])));
    (PARK_HOLES||[]).forEach(r=>(r||[]).forEach(p=>ext(p[0],p[1])));
    if(!(minLat<=maxLat&&minLon<=maxLon))return toast("Görüntü için sınır üretilemedi","err","🖼️");
    /* ~15 m tampon: kenar çizgisi kırpılmasın */
    const bufLat=15/110540;
    const bufLon=15/(111320*Math.cos(((minLat+maxLat)/2)*Math.PI/180));
    minLat-=bufLat;maxLat+=bufLat;minLon-=bufLon;maxLon+=bufLon;

    const lat0=(minLat+maxLat)/2;
    const MX=111320*Math.cos(lat0*Math.PI/180),MY=110540;
    const wM=Math.max(1,(maxLon-minLon)*MX),hM=Math.max(1,(maxLat-minLat)*MY);
    const PAD=70,LEGH=132;
    const scale=Math.min((1600-2*PAD)/wM,(1150-2*PAD)/hM);
    const W=Math.max(960,Math.round(wM*scale+2*PAD));
    const Htop=PAD+46;
    const H=Math.round(Htop+hM*scale+PAD+LEGH);

    const cv=document.createElement("canvas");
    cv.width=W;cv.height=H;
    const ctx=cv.getContext("2d");
    const pr=dgPxProjector(minLat,maxLat,minLon,maxLon,W,Htop,scale);

    /* zemin */
    ctx.fillStyle="#f7f6f2";ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="rgba(20,83,45,.25)";ctx.lineWidth=1;
    ctx.strokeRect(12.5,12.5,W-25,H-25);

    /* başlık */
    ctx.fillStyle="#14532d";
    ctx.font="700 22px system-ui,sans-serif";
    ctx.fillText("DendroGeo · Park Analizi",PAD,40);
    ctx.fillStyle="#556b5e";
    ctx.font="400 13px system-ui,sans-serif";
    const haTxt="Park polygonu: "+(parkAreaM2()/10000).toFixed(2)+" ha";
    ctx.fillText(haTxt+"   ·   "+new Date().toLocaleString("tr-TR"),PAD+ctx.measureText("DendroGeo · Park Analizi   ").width+180,40);

    /* PARK KIPI: park dışındaki hiçbir şey çizilmez */
    ctx.save();
    ctx.beginPath();
    (PARK_POLY||[]).forEach(ring=>{
      ring.forEach((p,i)=>{
        const x=pr.X(p[1]),y=pr.Y(p[0]);
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });
      ctx.closePath();
    });
    (PARK_HOLES||[]).forEach(ring=>{
      ring.forEach((p,i)=>{
        const x=pr.X(p[1]),y=pr.Y(p[0]);
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });
      ctx.closePath();
    });
    ctx.clip("evenodd");

    /* 1) arazi örtüsü nesneleri */
    if(opts.cover&&lc&&lc.patches&&lc.patches.length){
      for(const pt of lc.patches){
        const cls=(DG_LC_CLASSES_SAF||[]).find(c=>c.key===(pt.classKey||pt.group));
        const color=cls?cls.color:"#94a3b8";
        const rings=pt.rings||[];
        if(!rings.length)continue;
        ctx.beginPath();
        rings.forEach(ring=>{
          ring.forEach((p,i)=>{
            const x=pr.X(p[1]),y=pr.Y(p[0]);
            if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
          });
          ctx.closePath();
        });
        ctx.fillStyle=color+"73";      /* ~%45 dolgu */
        ctx.fill("evenodd");
        ctx.strokeStyle=color+"cc";
        ctx.lineWidth=1.4;
        ctx.stroke();
      }
    }

    /* 3) grid hücreleri */
    if(opts.grid&&(GRID_CELLS||[]).length){
      ctx.strokeStyle="rgba(20,83,45,.8)";ctx.lineWidth=1;
      ctx.fillStyle="rgba(20,83,45,.85)";
      ctx.font="600 9px ui-monospace,monospace";
      for(const c of GRID_CELLS){
        const x0=pr.X(c.w0),x1=pr.X(c.w1),y0=pr.Y(c.s0),y1=pr.Y(c.s1);
        ctx.strokeRect(x0,y0,x1-x0,y1-y0);
        if((x1-x0)>34&&(y1-y0)>16){
          ctx.fillText(String(c.id),x0+4,y0+11);
        }
      }
    }

    /* 4) waypoint'ler */
    if(opts.wp&&(WP||[]).length){
      ctx.font="700 10px system-ui,sans-serif";
      for(const w of WP){
        const x=pr.X(w.lon),y=pr.Y(w.lat);
        ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);
        ctx.fillStyle=w.visited?"#16a34a":"#e11d48";
        ctx.fill();
        ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle="#33413a";
        ctx.fillText("P"+w.wp_id,x+8,y+3);
      }
    }

    /* kıpı kapat: lejant/ölçek/park sınırı park dışında serbest çizilsin */
    ctx.restore();

    /* 2) park sınırı (kesikli, kırpın üstünde ki tam görünsün) */
    ctx.setLineDash([10,6]);
    ctx.strokeStyle="#14532d";ctx.lineWidth=2.4;
    (PARK_POLY||[]).forEach(r=>{dgPxRingPath(ctx,pr,r);ctx.stroke();});
    (PARK_HOLES||[]).forEach(r=>{dgPxRingPath(ctx,pr,r);ctx.stroke();});
    ctx.setLineDash([]);

    /* 5) lejant + ölçek + kuzey */
    const ly=H-LEGH+18;
    ctx.fillStyle="rgba(255,255,255,.82)";
    ctx.fillRect(PAD-8,ly-20,W-2*PAD+16,LEGH-24);
    ctx.strokeStyle="rgba(20,83,45,.2)";ctx.lineWidth=1;
    ctx.strokeRect(PAD-8.5,ly-20.5,W-2*PAD+17,LEGH-23);
    let lx=PAD;
    const swatch=(color,label,dash)=>{
      ctx.setLineDash(dash||[]);
      ctx.fillStyle=color;
      ctx.fillRect(lx,ly-4,16,12);
      ctx.strokeStyle="rgba(0,0,0,.35)";ctx.strokeRect(lx,ly-4,16,12);
      ctx.setLineDash([]);
      ctx.fillStyle="#33413a";ctx.font="500 12px system-ui,sans-serif";
      ctx.fillText(label,lx+22,ly+6);
      lx+=22+ctx.measureText(label).width+26;
    };
    if(opts.cover&&lc&&lc.patches){
      const present=["green","water","hard","bare","other"].filter(k=>
        lc.patches.some(p=>(p.classKey||p.group)===k));
      for(const k of present){
        const cls=(DG_LC_CLASSES_SAF||[]).find(c=>c.key===k);
        if(cls)swatch(cls.color+"99",cls.label);
      }
    }
    swatch("rgba(0,0,0,0)","Park sınırı",[6,4]);
    if(opts.grid)swatch("rgba(0,0,0,0)","Grid",[0,0]);
    ctx.fillStyle="#33413a";ctx.font="500 12px system-ui,sans-serif";

    /* ölçek çubuğu */
    const target=120/scale;             /* ~120 px */
    const steps=[25,50,100,200,500,1000,2000];
    let best=steps[0];
    for(const st of steps){if(st<=target)best=st;}
    const bx=W-PAD-160,by=ly+34;
    ctx.strokeStyle="#33413a";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+best*scale,by);
    ctx.moveTo(bx,by-5);ctx.lineTo(bx,by+5);
    ctx.moveTo(bx+best*scale,by-5);ctx.lineTo(bx+best*scale,by+5);
    ctx.stroke();
    ctx.fillText(best+" m",bx+best*scale+8,by+4);

    /* kuzey oku */
    const nx=W-PAD-40,ny=ly-2;
    ctx.beginPath();ctx.moveTo(nx,ny-16);ctx.lineTo(nx-7,ny+4);ctx.lineTo(nx+7,ny+4);
    ctx.closePath();ctx.fillStyle="#33413a";ctx.fill();
    ctx.font="700 12px system-ui,sans-serif";
    ctx.fillText("N",nx-4,ny+18);

    /* TELİF/LİSANS SATIRI (ODbL türev eser şartı): park geometrisi OSM'den
     * türetilir; üretilen PNG bir türev eserdir ve atıf gerektirir. Ayrıca
     * DendroGeo'nun kendi lisansı (CC BY-NC 4.0) da belirtilir — çıktıyı
     * paylaşan/yayınlayan kişi şartları görsün diye. */
    ctx.fillStyle="#8a978f";
    ctx.font="400 11px system-ui,sans-serif";
    ctx.fillText(
      "Park s\u0131n\u0131r\u0131 ve veriler: "+DG_ATTR_TEXT.osm+
      "  \u00b7  DendroGeo (CC BY-NC 4.0)  \u00b7  dendrogeo.org  \u00b7  "+
      new Date().toISOString().slice(0,10),
      PAD, H-14
    );

    /* kaynağa göre indirme adı */
    const name="dendrogeo_park_"+
      (opts.cover&&lc&&lc.patches?"lulc_":"")+
      (opts.grid?"grid_":"")+(opts.wp?"wp_":"")+
      new Date().toISOString().slice(0,10)+".png";

    cv.toBlob(b=>{
      if(!b)return toast("PNG üretilemedi","err","🖼️");
      const u=URL.createObjectURL(b);
      const a=document.createElement("a");
      a.href=u;a.download=name;a.click();
      setTimeout(()=>URL.revokeObjectURL(u),1500);
      toast("✓ PNG indirildi ("+(b.size/1024).toFixed(0)+" KB)","ok","🖼️");
    },"image/png");
  }catch(err){
    console.error("DENDROGEO · PNG:",err);
    toast("PNG hatası: "+(err&&err.message||err),"err","🖼️");
  }
}

window.downloadParkImage=downloadParkImage;

/* DG_LC_CLASSES landcover.js'te (classic script global'i); yoksa düşme */
const DG_LC_CLASSES_SAF=(typeof DG_LC_CLASSES!=="undefined")?DG_LC_CLASSES:

window.runLandCoverAnalysis=runLandCoverAnalysis;

window.downloadLandCoverClassCSV=downloadLandCoverClassCSV;

window.downloadLandCoverCellsGeoJSON=downloadLandCoverCellsGeoJSON;
