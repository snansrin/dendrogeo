"use strict";
(function(root){
 async function execute(profile,ports){
  if(!profile||profile.role!=="owner")return;
  const box=ports.container();if(!box)return;
  const datasets=await ports.load();
  const rows=ports.build(datasets,{translate:ports.translate,translateValue:ports.translateValue});
  return ports.render(box,rows,{locale:ports.locale(),translate:ports.translate,escape:ports.escape});
 }
 root.DG_LOAD_OWNER_VISITOR_ACTIVITY=Object.freeze({execute});
})(window);
