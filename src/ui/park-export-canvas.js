/* Canvas renderer for the park PNG; download and DOM concerns stay in its adapter. */
(function(root){
 "use strict";
 function draw({context,layout,options,landcover,outer,holes,gridSession,waypoints,classes,areaM2,osmAttribution,traceRing}){
  const {W,H,PAD,LEGH,scale,projector:pr}=layout;
  const ctx=context,opts=options,lc=landcover;
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
    const haTxt="Park polygonu: "+(areaM2()/10000).toFixed(2)+" ha";
    ctx.fillText(haTxt+"   ·   "+new Date().toLocaleString("tr-TR"),PAD+ctx.measureText("DendroGeo · Park Analizi   ").width+180,40);

    /* PARK KIPI: park dışındaki hiçbir şey çizilmez */
    ctx.save();
    ctx.beginPath();
    (outer||[]).forEach(ring=>{
      ring.forEach((p,i)=>{
        const x=pr.X(p[1]),y=pr.Y(p[0]);
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });
      ctx.closePath();
    });
    (holes||[]).forEach(ring=>{
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
        const cls=(classes()||[]).find(c=>c.key===(pt.classKey||pt.group));
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
    if(opts.grid&&(gridSession().getCells()||[]).length){
      ctx.strokeStyle="rgba(20,83,45,.8)";ctx.lineWidth=1;
      ctx.fillStyle="rgba(20,83,45,.85)";
      ctx.font="600 9px ui-monospace,monospace";
      for(const c of gridSession().getCells()){
        const x0=pr.X(c.w0),x1=pr.X(c.w1),y0=pr.Y(c.s0),y1=pr.Y(c.s1);
        ctx.strokeRect(x0,y0,x1-x0,y1-y0);
        if((x1-x0)>34&&(y1-y0)>16){
          ctx.fillText(String(c.id),x0+4,y0+11);
        }
      }
    }

    /* 4) waypoint'ler */
    if(opts.wp&&(waypoints()||[]).length){
      ctx.font="700 10px system-ui,sans-serif";
      for(const w of waypoints()){
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
    (outer||[]).forEach(r=>{traceRing(ctx,pr,r);ctx.stroke();});
    (holes||[]).forEach(r=>{traceRing(ctx,pr,r);ctx.stroke();});
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
        const cls=(classes()||[]).find(c=>c.key===k);
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
      "Park s\u0131n\u0131r\u0131 ve veriler: "+osmAttribution()+
      "  \u00b7  DendroGeo (CC BY-NC 4.0)  \u00b7  dendrogeo.org  \u00b7  "+
      new Date().toISOString().slice(0,10),
      PAD, H-14
    );

    /* kaynağa göre indirme adı */
    const name="dendrogeo_park_"+
      (opts.cover&&lc&&lc.patches?"lulc_":"")+
      (opts.grid?"grid_":"")+(opts.wp?"wp_":"")+
      new Date().toISOString().slice(0,10)+".png";

  return name;
 }
 root.DG_PARK_EXPORT_CANVAS=Object.freeze({draw});
})(window);
