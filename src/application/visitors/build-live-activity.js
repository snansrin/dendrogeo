"use strict";

/* Turn ephemeral presence metadata into the live activity timeline. */
window.DG_VISITOR_ACTIVITY_APPLICATION = {
  create() {
    function build(rows, {viewLabels={},actionLabels={},translate=value=>value,maxItems=18}={}) {
      const events=[];
      for(const row of (rows||[])){
        const person=row.p||{},who=person.n||"?";
        if(person.st)events.push({t:person.st,who,k:translate("çevrimiçi oldu"),d:person.dev||""});
        for(const item of (person.vh||[]))events.push({t:item.t,who,k:translate("görüntüledi"),d:translate(viewLabels[item.v]||item.v)});
        if(person.act)events.push({t:person.act.t,who,k:translate(actionLabels[person.act.k]||person.act.k),d:person.act.d||""});
      }
      events.sort((a,b)=>b.t-a.t);
      return events.slice(0,maxItems);
    }

    return Object.freeze({build});
  }
};
