"use strict";

/* Populate the legacy measurement form in its established species/render order. */
window.DG_RENDER_MEASUREMENT_EDIT_FORM={
  render(form,ports){
    ports.element("mProject").value=form.projectId;
    ports.element("mPoint").value=form.pointId;ports.element("mNo").value=form.measurementNo;
    ports.element("mGroup").value=form.group;ports.fillSpecies();ports.element("mSpecies").value=form.species;ports.showLatin();
    ports.element("mDbh").value=form.circumference;ports.element("mHeight").value=form.height;
    ports.element("editBanner").style.display="block";ports.element("saveBtn").textContent="💾 Kaydı Güncelle";
  }
};
