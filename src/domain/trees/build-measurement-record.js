"use strict";

/* Build the existing measurement row without changing locked carbon inputs. */
window.DG_BUILD_MEASUREMENT_RECORD={
  build({owner,projectId,pointId,measurementNo,group,species,circumferenceCm,dbhCm,heightM,volumeM3,carbonKg,parkSchemaOk,parkId}){
    const record={owner,project_id:projectId,point_id:pointId,measurement_no:measurementNo,grp:group,species,girth_cm:circumferenceCm,dbh_cm:dbhCm,height_m:heightM,volume_m3:volumeM3,carbon_kg:carbonKg,slope_deg:0,shared:true,status:"Beklemede"};
    if(parkSchemaOk)record.park_id=parkId||null;
    return record;
  }
};
