"use strict";

/* Raw/edit toggles are unavailable while geometry or another operation is unstable. */
window.DG_IS_SURFACE_RAW_VIEW_TRANSITION_ALLOWED={
  check({record,busy,saving,exporting,rawView,on}){return !!record&&!busy&&!saving&&!exporting&&rawView!==!!on;}
};
