"use strict";

/* Keep the selected photo name, remove control, and cleared state in one UI adapter. */
window.DG_MEASUREMENT_PHOTO_FILE_UI={
  select(file,element){
    const name=element("mPhotoName");if(name)name.textContent=file?file.name:"";
    const remove=element("mPhotoRemove");if(remove)remove.style.display=file?"inline-flex":"none";
  },
  clear(element){
    element("mPhoto").value="";element("mPhotoName").textContent="";element("photoCheck").style.display="none";
    const remove=element("mPhotoRemove");if(remove)remove.style.display="none";
  }
};
