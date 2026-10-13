"use strict";

/* Preserve the existing administrator-facing project-link failure feedback. */
window.DG_PARK_BACKFILL_LINK_FEEDBACK_UI={
  failed({project,error,escape,translate,warn,notify}){
    warn("DENDROGEO · backfill proje hatası:",error.message);
    notify(translate("Bağlanamadı (")+escape(project.name)+"): "+escape(error.message),"err");
  }
};
