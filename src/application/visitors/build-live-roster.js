"use strict";

/* Derive the live visitor roster from ephemeral presence state. */
window.DG_VISITOR_ROSTER_APPLICATION = {
  create() {
    function hasLocation(p) {
      return p?.la!=null&&p?.lo!=null&&Number.isFinite(Number(p.la))&&Number.isFinite(Number(p.lo))&&Math.abs(Number(p.la))<=90&&Math.abs(Number(p.lo))<=180&&!(Number(p.la)===0&&Number(p.lo)===0);
    }

    function rows(state, now, presenceReady) {
      const users=new Map();
      for(const key in (state||{}))for(const p of (state[key]||[])){
        if(!p?.id)continue;
        const t=Number(p.t);
        if(!Number.isFinite(t))continue;
        const age=Math.max(0,Math.round((now-t)/1000));
        if(age>120&&!presenceReady)continue;
        const old=users.get(String(p.id));
        if(!old||age<old.age)users.set(String(p.id),{p,age});
      }
      return [...users.values()].sort((a,b)=>a.age-b.age);
    }

    function filter(rows, {query="",view="",located=false}={}) {
      const normalizedQuery=String(query||"").trim().toLocaleLowerCase("tr-TR");
      return rows.filter(r=>(!normalizedQuery||String((r.p.n||"")+" "+(r.p.dev||"")).toLocaleLowerCase("tr-TR").includes(normalizedQuery))&&(!view||r.p.v===view)&&(!located||hasLocation(r.p)));
    }

    return Object.freeze({hasLocation,rows,filter});
  }
};
