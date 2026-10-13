"use strict";
(function(root){
 function open(rows,status,query,ports){
  const tree=ports.group(ports.filter(rows,status,query));
  tree.forEach(park=>{
   if(!(park.beklemede>0))return;
   ports.openKeys.add(park.key);
   park.projects.forEach(project=>{
    if(!(project.beklemede>0))return;
    ports.openKeys.add(project.key);
    project.users.forEach(user=>{if(user.beklemede>0)ports.openKeys.add(user.key);});
   });
  });
  ports.render(tree);
  return tree;
 }
 root.DG_OPEN_ADMIN_TREE_PENDING_NODES=Object.freeze({open});
})(window);
