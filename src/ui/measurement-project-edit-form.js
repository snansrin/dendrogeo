"use strict";

/* Own project edit/cancel form presentation; the service supplies legacy state. */
window.DG_MEASUREMENT_PROJECT_EDIT_FORM={
  begin(id,ports){
    const project=(ports.projects()||[]).find(row=>row.id===id&&!row.shared);if(!project)return null;
    const panel=ports.element("projCreateDetails");if(panel)panel.open=true;
    const park=project.park_id?{id:project.park_id,name:(project.parks&&project.parks.name)||project.park_name||"",area_m2:(project.parks&&project.parks.area_m2)||null}:null;
    ports.setEditing(id,park);
    ports.element("pLabel").value=project.label!=null?project.label:ports.labelFromLegacy(project.name,park?park.name:"");
    ports.element("pCountry").value=project.country||"";ports.element("pCity").value=project.city||"";
    ports.element("projSaveBtn").textContent="💾 Projeyi Güncelle";ports.element("projCancelBtn").style.display="inline-block";
    ports.renderParkBox();return project;
  },
  cancel(ports){
    ports.setEditing(null,null);ports.element("pLabel").value="";ports.element("projSaveBtn").textContent="+ Proje Oluştur";ports.element("projCancelBtn").style.display="none";
    const panel=ports.element("projCreateDetails");if(panel&&(ports.projects()||[]).some(project=>!project.shared))panel.open=false;
    ports.renderParkBox();
  }
};
