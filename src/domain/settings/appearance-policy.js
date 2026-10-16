"use strict";
(function(root){
 const normalize=value=>['light','dark','system'].includes(value)?value:'system';
 const resolve=(value,systemDark)=>normalize(value)==='system'?(systemDark?'dark':'light'):normalize(value);
 root.DG_APPEARANCE_POLICY=Object.freeze({normalize,resolve});
})(window);
