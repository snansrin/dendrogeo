"use strict";

/* Keep the existing warning about linked measurement and waypoint deletion. */
window.DG_CONFIRM_MEASUREMENT_PROJECT_DELETE={
  confirm({count,format,projectId,projectName}){
    return window.DG_TYPED_DELETE_CONFIRM.ask({kind:"project",id:projectId,name:projectName||"",warning:format("Proje silinsin mi? Bağlı {n} ölçüm ve ölçüm noktaları da silinebilir.\n(Park kimliği silinmez — aynı parktaki diğer projelerin karşılaştırması devam eder.)",{n:count||0})});
  }
};
