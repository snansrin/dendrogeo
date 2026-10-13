"use strict";

/* Keep the existing success/partial-failure wording and icon. */
window.DG_PARK_BACKFILL_APPLY_FEEDBACK_UI={
  show({result,translateFormat,notify}){
    notify(translateFormat("✓ {n} proje parkla eşleştirildi{f}",{
      n:result.successes,
      f:result.failures?translateFormat(" · {n} hata",{n:result.failures}):""
    }),result.failures?"warn":"ok","🌳");
  }
};
