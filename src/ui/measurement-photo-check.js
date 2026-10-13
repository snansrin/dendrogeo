"use strict";

/* Render the calibrated photo gate's pending, success and failure feedback. */
window.DG_MEASUREMENT_PHOTO_CHECK_UI={
  pending(box,translate){box.style.display="block";box.className="alert info";box.innerHTML="⏳ "+translate("Fotoğraf denetleniyor…");},
  invalidType(box,translate){box.style.display="block";box.className="alert err";box.innerHTML="⚠ "+translate("Yalnızca görsel dosyası yükleyin.");},
  passed(box,metrics,label,translate){box.className="alert ok";box.innerHTML=`✓ <b>${translate("Fotoğraf uygun")}</b> · ${label||translate("bitki/dal kanıtı yeterli")} · ${translate("Pozlama:")} ${metrics.lum.toFixed(0)}/255`;},
  failed(box,metrics,translate){
    const why=(metrics.lum>25&&metrics.lum<245)?translate("Karede ağaç/dal/bitki örtüsü kanıtı bulunamadı."):translate("Pozlama uygun değil (çok karanlık veya patlak).");
    box.className="alert err";box.innerHTML=`⚠ <b>${translate("Fotoğraf uygun değil")}</b> · ${why}<br>${translate("Ağacı, gövdesini veya dallarını kadraja alıp yeniden çekin.")}`;
  },
  unreadable(box,translate){box.className="alert err";box.innerHTML="⚠ "+translate("Fotoğraf okunamadı, tekrar deneyin.");}
};
