"use strict";
/* Explain the decision and keep sensor absence distinct from permission/timeout failures. */
(function(root){
  async function verify(park,why,{freshFix,decide,config,translate,translateFormat,warn}){
    if(!park)return{ok:true,verified:false,reason:"no-park"};
    let fix;
    try{fix=await freshFix();}
    catch(error){
      const code=(error&&error.code)||"unavailable";
      if(code==="unavailable"){
        warn("DENDROGEO · konum servisi yok → yerinde doğrulama yapılamadı (sunucu çiti aktif)");
        return{ok:true,verified:false,reason:"no-geo",distM:null,acc:null,
          message:translate("Cihazda konum servisi yok: yerinde doğrulama yapılamadı; sunucu çiti yine de park dışı girişi reddeder.")};
      }
      return{ok:false,verified:false,reason:code,
        message:code==="denied"
          ?translateFormat("Konum izni gerekli: bu {w} yalnızca {p} içinden veri kabul eder. Tarayıcı ayarlarından konuma izin ver.",{w:translate(why==="project"?"proje":"ölçüm"),p:park.name||translate("parkı")})
          :translateFormat("Konum alınamadı ({e}). Açık alanda yeniden dene.",{e:(error&&error.message||code)})};
    }
    const result=decide(fix,park,config);
    result.fix=fix;
    if(!result.ok&&result.reason==="acc")
      result.message=translateFormat("GPS hassasiyeti ±{a} m (eşik ±{m} m). Açık alanda bekleyip yeniden dene.",{a:Math.round(result.acc),m:config.ACC_MAX_M});
    if(!result.ok&&result.reason==="outside")
      result.message=translateFormat("Konumun {p} DIŞINDA (kenara ~{d} m). Bu proje yalnızca bu parktan veri kabul eder — başka parktan giriş engellendi.",{p:(park.name||translate("park")),d:(result.edgeM!=null?result.edgeM:result.distM)});
    return result;
  }
  root.DG_VERIFY_AT_PARK_APPLICATION=Object.freeze({verify});
})(window);
