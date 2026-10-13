"use strict";

/* Show a local-save error only while the failed snapshot is still current. */
window.DG_HANDLE_VALIDATION_CAMPAIGN_SAVE_FAILURE={
  handle(snapshotId,ports){
    if(ports.currentId()!==snapshotId)return false;
    ports.setStatus(ports.translate("Cihaz kaydı başarısız. Kaydet düğmesiyle hesap kaydını deneyin."));
    ports.updateStatus();return true;
  }
};
