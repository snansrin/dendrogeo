"use strict";

/* Check the selected photo while discarding stale async results after a clear/change. */
window.DG_CHECK_MEASUREMENT_PHOTO={
  create(ports){
    return async function check(event){
      const generation=ports.state.begin();ports.setPhotoOk(false);
      const file=event.target.files[0],box=ports.element("photoCheck");
      ports.selectFile(file);
      if(!file){ports.setPhotoOk(false);box.style.display="none";return;}
      if(!file.type.startsWith("image/")){ports.setPhotoOk(false);ports.showInvalidType(box);return;}
      ports.showPending(box);
      try{
        const loaded=await ports.loadImage(file);
        if(!ports.state.isCurrent(generation)){ports.revokeObjectURL(loaded.url);return;}
        const pixels=ports.readPixels(loaded,120);
        const metrics=ports.scan(pixels,120),valid=ports.gate(metrics);
        ports.setPhotoOk(valid);
        if(valid)ports.showPassed(box,metrics,ports.label(metrics));
        else ports.showFailed(box,metrics);
      }catch(error){
        if(!ports.state.isCurrent(generation))return;
        ports.setPhotoOk(false);ports.showUnreadable(box);
      }
    };
  }
};
