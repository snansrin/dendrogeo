"use strict";
(function(root){
 function expand(rows,status,query,openKeys,ports,open){
  const tree=ports.group(ports.filter(rows,status,query));
  openKeys.clear();
  if(open)tree.forEach(park=>{
   openKeys.add(park.key);
   park.projects.forEach(project=>{
    openKeys.add(project.key);
    project.users.forEach(user=>openKeys.add(user.key));
   });
  });
  ports.render(tree);
  return tree;
 }
 root.DG_EXPAND_ADMIN_MEASUREMENT_TREE=Object.freeze({expand});
})(window);
