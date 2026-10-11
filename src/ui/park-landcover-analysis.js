"use strict";
/* Park-specific LULC UI orchestration. Numerical analysis stays in DG_LANDCOVER. */
(function(g){
  function create(deps){
    async function run(){
      if(deps.isBusy())return deps.toast("Arazi örtüsü analizi zaten çalışıyor.","info","🛰️");
      if(!deps.getLandcover()&&deps.ensureLulc){
        deps.toast("🛰️ Arazi örtüsü modülü yükleniyor…","info");
        try{await deps.ensureLulc();}
        catch(err){return deps.toast(deps.cf("Arazi örtüsü modülü yüklenemedi: ")+((err&&err.message)||err),"err","🛰️");}
      }
      const landcover=deps.getLandcover();
      if(!landcover||typeof landcover.analyze!=="function")return deps.toast("10 m arazi örtüsü modülü yüklenmedi.","err","🗺️");
      const outer=deps.getOuter();
      if(!outer||!outer.length)return deps.toast("Önce park seç","warn","🌳");

      deps.setBusy(true);
      const map=deps.getElement("v-map");
      map?.classList.add("surface-review-active");
      const pending=deps.getElement("surfacePendingTools");if(pending)pending.style.display="flex";
      const pendingBase=deps.getElement("dgPendingBaseSelect");if(pendingBase)pendingBase.value=deps.getElement("baseLayerSelect")?.value||"osm";
      const btn=deps.getButton();
      if(btn){btn.disabled=true;btn.dataset.oldText=btn.innerHTML;btn.innerHTML="⏳ Analiz yapılıyor…";btn.style.opacity=".65";btn.style.cursor="wait";}
      const rep=deps.getReport();
      if(rep){
        rep.style.display="block";
        rep.innerHTML="<b>🛰️ Arazi örtüsü analizi çalışıyor…</b>"+
          "<div style='font-size:.72rem;color:var(--mut);margin-top:6px'>"+
          "10 m raster verisi park polygonu ile kesiştiriliyor. Bu işlem bağlantıya göre biraz sürebilir; sonuç tamamlanmadan rapor yazılmayacak."+
          "</div>";
      }
      deps.toast("Arazi örtüsü analizi başladı. 10 m raster verisi okunuyor…","info","🛰️");
      const parkArea=deps.parkAreaM2();
      return landcover.analyze({outer,holes:deps.getHoles()||[],parkAreaM2:parkArea}).then(async result=>{
        const render=deps.getReportRenderer();if(render)render(rep,result,parkArea);
        const sensitivity=deps.getSensitivity();
        if(sensitivity&&typeof sensitivity.mount==="function"){
          try{await sensitivity.mount("lcSens");}
          catch(e){console.warn("DENDROGEO · hassasiyet paneli monte edilemedi:",e);deps.toast(deps.cf("Yüzey düzenleme açılamadı: ")+String(e.message||e),"err");}
        }
        deps.toast("✓ 10 m arazi örtüsü analizi tamamlandı (ESA WorldCover 2021 + çapraz IO LULC 2020).","ok","🗺️");
      }).catch(err=>{
        console.error("DENDROGEO · Arazi örtüsü analizi:",err);
        if(rep){rep.style.display="block";rep.innerHTML="<b>❌ 10 m arazi örtüsü analizi tamamlanamadı.</b>"+
          "<div style='font-size:.74rem;color:var(--red);margin-top:7px'>"+deps.escape(err?.message||String(err))+"</div>"+
          "<div style='font-size:.68rem;color:var(--mut);margin-top:7px'>Geçersiz veya eksik sonuç rapora yazılmadı.</div>";}
        deps.toast(deps.cf("Arazi örtüsü analizi hatası: ")+(err?.message||String(err)),"err","🗺️");
      }).finally(()=>{
        deps.setBusy(false);
        if(pending)pending.style.display="none";
        if(!deps.hasSensitivityRecord())deps.getElement("v-map")?.classList.remove("surface-review-active");
        if(btn){btn.disabled=false;btn.innerHTML=btn.dataset.oldText||"🌿 Yüzey Örtüsü Analizi";btn.style.opacity="";btn.style.cursor="";}
      });
    }
    return {run};
  }
  g.DG_PARK_LANDCOVER_UI={create};
})(window);
