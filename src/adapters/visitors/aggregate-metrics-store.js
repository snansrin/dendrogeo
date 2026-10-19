(function(root){
 'use strict';
 async function load(client,days){const {data,error}=await client.rpc('get_site_metrics_v1',{p_days:days});if(error)throw error;return data;}
 root.DG_AGGREGATE_METRICS_STORE=Object.freeze({load});
})(window);
