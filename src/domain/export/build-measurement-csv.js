"use strict";
(function(root){
 function build(rows,header,formatRow){return"\uFEFF"+header+"\n"+rows.map(formatRow).join("\n")+"\n";}
 root.DG_BUILD_MEASUREMENT_CSV=Object.freeze({build});
})(window);
