"use strict";

/* Coordinate the existing record read, form normalization, and edit entry. */
window.DG_EDIT_MEASUREMENT_RECORD={
  async edit(id,ports){
    const record=await ports.fetch(id);
    if(!record)return;
    ports.clearPhoto();
    ports.setEditing(id);
    const form=ports.build(record);
    ports.render(form);
    ports.liveCalc();ports.navigate("measure");ports.projectChanged();
    return form;
  }
};
