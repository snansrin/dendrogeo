"use strict";

/* Read the owner visitor panel's total, today, and rolling seven-day counts. */
window.DG_VISITOR_LIVE_VISIT_COUNTS_STORE={
 create(){
  async function load(client,{now=Date.now()}={}){
   const today=new Date(now);today.setHours(0,0,0,0);
   const sevenDays=new Date(now-7*86400000);
   const[total,todayCount,weekCount]=await Promise.all([
    client.from("site_visits").select("*",{count:"exact",head:true}),
    client.from("site_visits").select("*",{count:"exact",head:true}).gte("visited_at",today.toISOString()),
    client.from("site_visits").select("*",{count:"exact",head:true}).gte("visited_at",sevenDays.toISOString())]);
   return{total:total.count??0,today:todayCount.count??0,sevenDays:weekCount.count??0};
  }
  return Object.freeze({load});
 }
};
