"use strict";
/* Sign Planetary Computer assets and reuse valid collection SAS tokens. */
(function(root){
  function signedHref(href,token){if(!token)return href;const value=String(token).replace(/^[?&]/,"");if(!value)return href;return href+(href.includes("?")?"&":"?")+value;}
  async function getSas(collection,signal,{cache,defaultCollection,sasEndpoint,fetchJson}){const name=collection||defaultCollection;if(signal?.aborted)throw Object.assign(new Error("İstek iptal edildi."),{name:"AbortError"});const cached=cache.get(name);if(cached&&cached.expires>Date.now()+120000)return cached.token;cache.delete(name);try{const data=await fetchJson(sasEndpoint+name,{headers:{Accept:"application/json"},signal}),token=data?.token||"",expiry=Date.parse(data?.msftExpiry||new URLSearchParams(String(token).replace(/^\?/ ,"")).get("se"));if(token&&Number.isFinite(expiry)&&expiry>Date.now()+120000){if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(name,{token,expires:expiry});}return token;}catch(error){if(signal?.aborted||error.name==="AbortError")throw error;console.warn("DENDROGEO · Veri imzalama tokenı alınamadı; doğrudan açık asset deneniyor.",error);return"";}}
  root.DG_SIGN_STAC_ASSETS=Object.freeze({signedHref,getSas});
})(window);
