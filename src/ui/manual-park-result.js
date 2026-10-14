"use strict";
/* Keep manual-park UI transitions separate from the registration use case. */
window.DG_PRESENT_MANUAL_PARK_RESULT={
 offer(lat,lon,ports){ports.offerAt({lat,lon});ports.renderCard(true);ports.toast("Bu noktada OSM parkı bulunamadı — elle park oluşturabilirsin.","warn","🌳");},
 created(result,ports){const {toast,escape:esc,translateCommon:tc}=ports;
 if(result.status==="name-required")return toast("Park adı gerekli","err","🌳");
 if(result.status==="location-required")return toast("Konum yok: haritada parkın içine tıkla veya GPS'i aç.","err","📍");
 if(result.status==="registration-failed")return toast("Elle park oluşturulamadı.","err","🌳");
 ports.selectPark(result.row);ports.renderCard();toast(tc("✓ Park oluşturuldu: ")+esc(result.row.name),"ok","🌳");return result.row;
 }
};
