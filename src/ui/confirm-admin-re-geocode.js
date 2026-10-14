"use strict";

window.DG_CONFIRM_ADMIN_RE_GEOCODE = Object.freeze({
  ask(confirmAction, translate) {
    return confirmAction(translate("Tüm kayıtların şehir/ülke bilgisi GPS koordinatından yeniden algılansın mı? (Nominatim limiti ~1 istek/sn)"));
  },
});
