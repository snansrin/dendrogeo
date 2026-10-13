"use strict";

/* Stable park-collaborator marker color derived from the member identifier. */
window.DG_PARK_LIVE_MEMBER_COLOR={
  color(id,palette){let hash=0;const value=String(id||"?");for(let i=0;i<value.length;i++)hash=(hash*31+value.charCodeAt(i))>>>0;return palette[hash%palette.length];}
};
