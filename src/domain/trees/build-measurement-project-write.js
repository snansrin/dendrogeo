"use strict";

/* Build the established project write payload without reading UI or storage. */
window.DG_BUILD_MEASUREMENT_PROJECT_WRITE={
  build({editId,editPark,park,userId,label,country,city,composeName}){
    if(editId){
      if(!editPark)return{kind:"park-required",mode:"update",projectId:editId};
      return{kind:"update",id:editId,payload:{label,park_id:editPark.id,country,city}};
    }
    if(!park)return{kind:"park-required",mode:"insert",projectId:null};
    const name=composeName(park.name,label);
    return{kind:"insert",name,payload:{owner:userId,park_id:park.id,label,name,country:country||park.country||"",city:city||park.city||""}};
  }
};
