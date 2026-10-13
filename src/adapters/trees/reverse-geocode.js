"use strict";

/* Reverse-geocode adapter shared by the measurement service. */
window.DG_MEASUREMENT_REVERSE_GEOCODE={
  async resolve(fetcher,lat,lon){
    try{
      const r=await fetcher("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat="+lat+"&lon="+lon+"&accept-language=tr",{headers:{Accept:"application/json"}});
      if(!r.ok)return null;
      const j=await r.json();const a=j.address||{};
      const cc=(a.country_code||"").toLowerCase();
      const city=cc==="tr"?(a.state||a.province||a.city||null):(a.city||a.town||a.village||a.municipality||a.state||null);
      const country=a.country||null;
      if(!city&&!country)return null;
      return{city:city||"Bilinmiyor",country:country||"Bilinmiyor"};
    }catch(e){return null;}
  }
};
