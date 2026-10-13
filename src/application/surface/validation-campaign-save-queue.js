"use strict";

/* Serialize local campaign writes and recover the chain after a failed write. */
window.DG_VALIDATION_CAMPAIGN_SAVE_QUEUE={
  create(){
    let queue=Promise.resolve();
    return Object.freeze({enqueue(operation){const job=queue.catch(()=>{}).then(operation);queue=job;return job;}});
  }
};
