"use strict";

/* Build the stable tabular representation of a validation campaign. */
(function(root){
  function build(campaign,{version,classes}){
    const quote=value=>'"'+String(value??"").replace(/"/g,'""')+'"',rows=[];
    rows.push(["# DendroGeo LULC doğrulama kampanyası"]);
    rows.push(["campaign_id",quote(campaign.id)]);
    rows.push(["park",quote(campaign.parkName||""),"park_id",campaign.parkId||""]);
    rows.push(["seed",campaign.seed,"engine",quote(campaign.engineVersion||""),"validate",quote(version)]);
    rows.push(["generated",quote(campaign.createdAt||""),"labeled",campaign.metrics?campaign.metrics.n:0]);
    rows.push([]);
    rows.push(["POINT_ID","LAT","LON","MAP_CLASS","REF_CLASS","NDVI","MNDWI","NDBI","MNDWI_YEAR_MAX","NDVI_SEASON_MAX","SPEC_PREDICT","AREA_M2"]);
    for(const sample of(campaign.samples||[])){
      const spectral=(campaign.spectral&&campaign.spectral.cells&&campaign.spectral.cells[sample.row+":"+sample.col])||{};
      const fixed=value=>value!==undefined&&value!==null?+Number(value).toFixed(3):"";
      rows.push([quote(sample.id),sample.lat,sample.lon,quote(sample.mapClass),quote(sample.refClass||""),fixed(spectral.ndvi),fixed(spectral.mndwi),fixed(spectral.ndbi),fixed(spectral.mndwiMaxYear!==undefined?spectral.mndwiMaxYear:spectral.mndwiMax),fixed(spectral.ndviMax),quote(spectral.predict||""),sample.areaM2]);
    }
    if(campaign.metrics){
      const metrics=campaign.metrics;
      rows.push([]);rows.push(["OA","OA_CI95","KAPPA","N","N_AMBIGUOUS"]);rows.push([metrics.oa,metrics.oaCi95,metrics.kappa,metrics.n,metrics.nAmbiguous]);
      rows.push([]);rows.push(["CLASS","N","CORRECT","UA","UA_CI95","PA","ADJ_AREA_HA","ADJ_CI95_HA","WEIGHT"]);
      for(const cls of classes){const perClass=metrics.perClass[cls]||{};rows.push([quote(cls),perClass.n||0,perClass.correct||0,perClass.ua??"",perClass.uaCi95??"",perClass.pa??"",perClass.adjustedAreaHa??"",perClass.adjustedCi95Ha??"",perClass.weight||0]);}
    }
    if(campaign.gate){rows.push([]);rows.push(["GATE_STATE","GATE_LABEL"]);rows.push([quote(campaign.gate.state),quote(campaign.gate.label)]);for(const reason of(campaign.gate.reasons||[]))rows.push(["REASON",quote(reason)]);}
    const corrections=campaign.corrections||{},keys=Object.keys(corrections);
    if(keys.length){
      rows.push([]);rows.push(["# HÜCRE KARARLARI (uyuşmazlık kuyruğu — insan kararı, denetim izli)"]);rows.push(["ROW","COL","FROM_CLASS","TO_CLASS","STATUS","ADJUDICATED_AT"]);
      for(const key of keys){const record=corrections[key]||{},parts=String(key).split(":"),same=!record.to||record.to===record.from;rows.push([parts[0]||"",parts[1]||"",quote(record.from||""),quote(record.to||""),quote(same?"confirmed":"corrected"),quote(record.ts||"")]);}
      if(campaign.correctedAreas){rows.push([]);rows.push(["# DOĞRULANMIŞ ALANLAR (ha) — karar verilen hücreler işlendi, kalanlar raster değerinde"]);rows.push(["CLASS","RASTER_HA","ADJUDICATED_HA","DELTA_HA"]);for(const cls of classes){const raster=(campaign.rasterAreas&&campaign.rasterAreas[cls])||0,adjusted=campaign.correctedAreas[cls]||0;rows.push([quote(cls),(raster/10000).toFixed(4),(adjusted/10000).toFixed(4),((adjusted-raster)/10000).toFixed(4)]);}}
    }
    return rows;
  }
  root.DG_BUILD_VALIDATION_CAMPAIGN_CSV_ROWS=Object.freeze({build});
})(window);
