"use strict";
/* Present a search outcome without owning lookup or registry persistence. */
window.DG_PRESENT_PARK_SEARCH_RESULT={async present(result,ports){
 const {toast,escape:esc,translate:t,translateCommon:tc}=ports;
 if(result.status==="empty-query")return toast("Önce park adını yaz.","warn","🔍");
 if(result.status==="registered"){ports.selectPark(result.park);ports.renderCard();return toast("🌳 "+esc(result.park.name)+" "+t("seçildi — proje açabilirsin; ölçüm için parkta olman gerekir."),"ok","🌳");}
 if(result.status==="not-found")return toast("Bulunamadı: haritada parkın içine tıkla ya da ✍️ elle oluştur.","warn","🔍");
 if(result.status==="geocode-failed")return toast(tc("Arama hatası: ")+esc(result.error.message)+" "+t("— haritada tıkla veya elle oluştur."),"err","🔍");
 if(result.status==="geocoded")return await ports.detectAt(+result.point.lat,+result.point.lon);
}};
