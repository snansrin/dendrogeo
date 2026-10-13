"use strict";

/* Keep the existing warning about linked measurement and waypoint deletion. */
window.DG_CONFIRM_MEASUREMENT_PROJECT_DELETE={
  confirm({count,format,confirm}){
    return confirm(format("Proje silinsin mi? Bağlı {n} ölçüm ve waypoint'ler de silinebilir.\n(Park kimliği silinmez — aynı parktaki diğer projelerin karşılaştırması devam eder.)",{n:count||0}));
  }
};
