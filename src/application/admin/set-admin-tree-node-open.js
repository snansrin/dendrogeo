"use strict";
(function(root){
 function set(openKeys,key,open){
  if(open)openKeys.add(key);else openKeys.delete(key);
  return openKeys.has(key);
 }
 root.DG_SET_ADMIN_TREE_NODE_OPEN=Object.freeze({set});
})(window);
