"use strict";
/* Register or resolve one OSM/manual park without owning Supabase or UI state. */
(function(root){
  function create({getStore,getUser,isEnabled,session,centerFor,manualKey,osmKey,normalizeName,matchRadius,getReverseGeocode,notifyManualConflict,notifyWriteFailure,warn}){
    return async function register(cand,opt){
      opt=opt||{};
      const user=getUser(),store=getStore();
      if(!user||!store)return null;
      if(!isEnabled())return null;

      const rawName=String((cand&&cand.name)||opt.name||"").trim();
      const name=rawName||"İsimsiz Park";
      const manual=opt.manual===true||(cand&&cand.source==="manual");
      const center=centerFor(cand,opt);
      const key=manual?manualKey(name,center.lat,center.lon):osmKey(cand&&cand.type,cand&&cand.id);
      if(session.has(key))return session.get(key);

      let city=opt.city||null,country=opt.country||null;
      const area=Number(cand&&cand.area);
      const row={
        osm_key:key,
        osm_type:manual?"manual":String((cand&&cand.type)||"way"),
        osm_id:manual?null:(Number(cand&&cand.id)||null),
        name,
        name_norm:normalizeName(name),
        country,city,
        centroid_lat:center.lat,
        centroid_lon:center.lon,
        area_m2:Number.isFinite(area)&&area>0?Math.round(area):null,
        source:opt.source||(manual?"manual":"osm"),
        created_by:user.id
      };

      let hit=await store.selectByKey(key);
      if(!hit&&Number.isFinite(+center.lat)){
        hit=await store.selectNear(row.name_norm,+center.lat,+center.lon,matchRadius(row.area_m2));
      }
      if(hit){
        session.set(key,hit);
        if(!manual&&hit.source==="manual")notifyManualConflict(hit);
        return hit;
      }

      if(Number.isFinite(+center.lat)&&(!city||!country)){
        const reverseGeocode=getReverseGeocode();
        if(typeof reverseGeocode==="function"){
          const geo=await reverseGeocode(+center.lat,+center.lon);
          if(geo){city=geo.city;country=geo.country;row.city=city;row.country=country;}
        }
      }

      const{data,error}=await store.insert(row);
      if(error){
        if(error.code==="23505"){
          const again=await store.selectByKey(key);
          if(again){session.set(again.osm_key,again);return again;}
        }
        warn(error);
        notifyWriteFailure(error);
        return null;
      }
      session.set(key,data);
      return data;
    };
  }
  root.DG_PARK_REGISTRATION_APPLICATION=Object.freeze({create});
})(window);
