"use strict";
window.DG_TOGGLE_SURFACE_OBJECTS={toggle({state,on,dirty,repartition,save}){if(state.rawView||!state.record||state.busy||state.saving)return;state.record.useObjects=on;dirty();repartition().then(ok=>ok&&save());}};
