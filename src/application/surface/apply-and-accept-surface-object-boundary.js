"use strict";
window.DG_APPLY_AND_ACCEPT_SURFACE_OBJECT_BOUNDARY={async run({apply,accept,isAccepted}){const applied=await apply();if(!applied)return false;const accepted=await accept();if(!accepted)return false;return isAccepted();}};
