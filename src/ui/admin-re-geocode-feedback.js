"use strict";

window.DG_ADMIN_RE_GEOCODE_FEEDBACK = Object.freeze({
  denied(toast) {
    toast("Yetki yok.", "err");
  },
  completed(toast, format, count) {
    toast(format("✓ {n} kaydın şehri güncellendi", { n: count }), "ok", "🌍");
  },
});
