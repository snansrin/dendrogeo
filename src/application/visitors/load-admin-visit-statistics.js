"use strict";

/* Keep admin count reads sequential and preserve already-rendered partial results. */
window.DG_LOAD_ADMIN_VISIT_STATISTICS={
  create({loadTotal,loadSince,resolveWindows,setTotal,setToday,setSevenDays,fail}){
    return async function load(){
      try{
        const total=await loadTotal();
        setTotal(total.count??0);
        const windows=resolveWindows();
        const today=await loadSince(windows.today);
        setToday(today.count??0);
        const week=await loadSince(windows.sevenDays);
        setSevenDays(week.count??0);
      }catch(_){fail();}
    };
  }
};
