"use strict";

/* Render project selectors and owner/shared cards using injected legacy actions. */
window.DG_MEASUREMENT_PROJECT_DIRECTORY_UI={
  render({projects,element,escape,optionLabel,restore,renderCard,editing}){
    const rows=projects||[];
    const options=rows.map(project=>`<option value="${project.id}">${escape(optionLabel(project))}</option>`).join("");
    const empty="<option value=''>Önce park algıla → proje oluştur</option>";
    for(const id of ["mProject","nProject"]){const select=element(id);if(select)select.innerHTML=options||empty;}
    restore();
    const own=rows.filter(project=>!project.shared),shared=rows.filter(project=>project.shared);
    const ownCount=element("projOwnCount"),sharedCount=element("projSharedCount");
    if(ownCount)ownCount.textContent=String(own.length);
    if(sharedCount)sharedCount.textContent=String(shared.length);
    const ownList=element("projOwnList"),sharedList=element("projSharedList"),sharedSection=element("projSharedSection");
    if(ownList)ownList.innerHTML=own.length?own.map(project=>renderCard(project,false)).join(""):'<div class="project-empty"><b>Henüz kendi projen yok.</b><span>Canlı Harita’dan bir park algılayıp ilk çalışma alanını oluştur.</span></div>';
    if(sharedList)sharedList.innerHTML=shared.map(project=>renderCard(project,true)).join("");
    if(sharedSection)sharedSection.style.display=shared.length?"":"none";
    const compatibilityTable=element("projTable");
    if(compatibilityTable)compatibilityTable.innerHTML=own.map(project=>renderCard(project,false)).join("")+shared.map(project=>renderCard(project,true)).join("");
    const create=element("projCreateDetails");if(create&&!editing)create.open=own.length===0;
  }
};
