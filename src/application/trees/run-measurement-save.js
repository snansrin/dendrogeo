"use strict";

/* Guard overlapping saves and restore the established button/error behavior. */
window.DG_RUN_MEASUREMENT_SAVE={
  async run(ports){
    if(ports.isBusy())return;
    ports.setBusy(true);
    try{return await ports.save();}
    catch(error){ports.failed(error);}
    finally{ports.setBusy(false);}
  }
};
