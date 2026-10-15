"use strict";

/* Compose the five measurement-save phases exposed by the legacy service facade. */
window.DG_SUBMIT_MEASUREMENT={
  async run(input,ports){
    const validated=window.DG_VALIDATE_MEASUREMENT_SUBMISSION.validate(input,ports.validation);
    if(!validated.ok){ports.stopForValidation(validated);return;}
    const draft=await window.DG_PREPARE_MEASUREMENT_SUBMISSION.prepare(validated,ports.prepare);
    if(!draft.ok){ports.stopForValidation({reason:"calculation",calculation:draft.calculation});return;}
    const location=await window.DG_VERIFY_MEASUREMENT_SUBMISSION_LOCATION.verify(draft,ports.location);
    if(!location.ok){ports.locationRejected(location);return;}
    const saved=await window.DG_PERSIST_MEASUREMENT_SUBMISSION.persist(draft,ports.persistence);
    if(!saved.ok){ports.writeFailed(saved.error);return;}
    return ports.complete({draft,location,mode:saved.mode});
  }
};
