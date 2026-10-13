"use strict";

/* Remove queue-only values before sending a measurement to PostgREST. */
window.DG_PREPARE_MEASUREMENT_SYNC_PAYLOAD={
  build(data){
    const payload={...data};
    delete payload.photoBlob;
    delete payload._editId;
    return payload;
  }
};
