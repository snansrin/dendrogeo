"use strict";

/* Build the reviewed-plan row update after a manual park link succeeds. */
window.DG_BUILD_MANUAL_BACKFILL_PARK_UPDATE={
  build({row,park,projectName,labelFromLegacy}){
    const label=labelFromLegacy(row.project.name,park.name);
    return{
      durum:"eşleşti",
      parkName:park.name,
      yol:"elle oluşturuldu",
      newName:projectName(park.name,label),
      cand:{name:park.name,area:park.area_m2}
    };
  }
};
