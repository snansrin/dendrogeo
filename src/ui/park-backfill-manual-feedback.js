"use strict";

/* Present the successful manual park creation without owning its workflow. */
window.DG_PARK_BACKFILL_MANUAL_FEEDBACK_UI={
  show({park,escape,notify}){
    notify("✓ "+escape(park.name)+" oluşturuldu ve bağlandı","ok","🌳");
  }
};
