"use strict";

/* A saved review is reusable only while its analyzed source fingerprint matches. */
window.DG_CLASSIFY_SURFACE_REVIEW_DATA_CHANGE={
  changed({savedFingerprint,nextFingerprint}){return !!savedFingerprint&&savedFingerprint!==nextFingerprint;}
};
