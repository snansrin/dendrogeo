"use strict";
/* DendroGeo · domain/parks/identity.js
 * Saf park kimliği kuralları. DOM, ağ, Supabase ve oturum durumu kullanmaz.
 * Eski dg* adları park-registry.js uyumluluk katmanında korunur. */
(function(root){
  const TR_FOLD={
    "ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u",
    "â":"a","î":"i","û":"u","é":"e","à":"a","ñ":"n"
  };
  const TR_UP={"i":"İ","ı":"I","ş":"Ş","ğ":"Ğ","ü":"Ü","ö":"Ö","ç":"Ç"};
  const SEPARATOR=" - ";
  const BASE_MATCH_RADIUS_M=400;

  function normalizeName(s){
    let t=String(s??"").trim();
    if(!t)return "";
    t=t.replace(/[İI]/g,"i").toLowerCase();
    t=t.replace(/[çğıöşüâîûéàñ]/g,c=>TR_FOLD[c]||c);
    return t.replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
  }
  function normalizeLooseName(s){
    return normalizeName(s).replace(/\b(park|parki|parklar|parki)\b/g,"").trim().replace(/\s+/g," ");
  }
  function osmKey(type,id){
    const t=String(type||"way").toLowerCase();
    const n=Number(id);
    return t+"/"+(Number.isFinite(n)?String(n):String(id??"").trim());
  }
  function manualKey(name,lat,lon){
    const a=Number(lat),o=Number(lon);
    const cell=Number.isFinite(a)&&Number.isFinite(o)?a.toFixed(3)+"/"+o.toFixed(3):"yok";
    return "manual/"+(normalizeName(name)||"isimsiz")+"/"+cell;
  }
  function projectName(parkName,label){
    const p=String(parkName??"").trim(),l=String(label??"").trim();
    if(!p)return l;
    return l?p+SEPARATOR+l:p;
  }
  function labelFromLegacy(name,parkName){
    const n=String(name??"").trim(),p=String(parkName??"").trim();
    if(!p)return n;
    if(n.toLowerCase()===p.toLowerCase())return "";
    if(n.toLowerCase().startsWith(p.toLowerCase()))return n.slice(p.length).replace(/^[\s\-–—·:,.]+/,"").trim();
    return n;
  }
  function matchRadius(areaM2){
    const a=Number(areaM2);
    if(!Number.isFinite(a)||a<=0)return BASE_MATCH_RADIUS_M;
    return Math.max(BASE_MATCH_RADIUS_M,Math.sqrt(a));
  }
  function titleCaseTR(t){
    return String(t??"").trim().split(/\s+/).map(w=>{
      if(!w)return w;
      const c=w.charAt(0);
      return (TR_UP[c]||c.toLocaleUpperCase("tr"))+w.slice(1);
    }).join(" ");
  }
  function suggestName(projectNameValue){
    const t=String(projectNameValue??"").trim();
    if(!t)return "İsimsiz Park";
    return /[A-ZİIŞĞÜÖÇ]/.test(t)?t:titleCaseTR(t);
  }
  function centerFromRings(rings){
    const outer=Array.isArray(rings)?rings:(rings&&Array.isArray(rings.outer)?rings.outer:null);
    if(!outer||!outer.length)return null;
    let a0=90,a1=-90,o0=180,o1=-180,n=0;
    outer.forEach(r=>{
      if(!Array.isArray(r))return;
      r.forEach(p=>{
        if(!Array.isArray(p))return;
        const la=Number(p[0]),lo=Number(p[1]);
        if(!Number.isFinite(la)||!Number.isFinite(lo))return;
        if(la<a0)a0=la;if(la>a1)a1=la;if(lo<o0)o0=lo;if(lo>o1)o1=lo;n++;
      });
    });
    if(!n)return null;
    return{lat:+(((a0+a1)/2).toFixed(6)),lon:+(((o0+o1)/2).toFixed(6))};
  }
  root.DG_PARK_IDENTITY=Object.freeze({
    SEPARATOR,BASE_MATCH_RADIUS_M,normalizeName,normalizeLooseName,osmKey,manualKey,
    projectName,labelFromLegacy,matchRadius,titleCaseTR,suggestName,centerFromRings
  });
})(window);
