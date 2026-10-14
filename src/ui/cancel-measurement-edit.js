"use strict";

/* Restore the measurement form after edit cancellation or a successful edit. */
window.DG_CANCEL_MEASUREMENT_EDIT={
  cancel(ports){
    ports.setEditing(null);ports.setManualPoint(false);
    ports.element("editBanner").style.display="none";
    ports.element("saveBtn").textContent="💾 Hesapla ve Kaydet";
    ports.parkGate();
  }
};
