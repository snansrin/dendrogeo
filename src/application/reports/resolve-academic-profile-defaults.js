"use strict";

window.DG_RESOLVE_ACADEMIC_PROFILE_DEFAULTS = (() => {
  function resolve(user, clean) {
    const metadata = user && user.user_metadata || {};
    const saved = metadata.academic_profile || {};
    return clean({
      ...saved,
      advisor: saved.advisor || saved.supervisor,
      project_name: saved.project_name || saved.project,
      program: saved.program || saved.research_area,
      ...(metadata.dendrogeo_profile || {}),
    });
  }

  function summarize({values,fields}){
    const total=fields.length,filled=fields.filter(([key])=>String(values[key]||'').trim()).length;
    return{total,filled,institution:values.institution||'',department:values.department||'',project:values.project_name||'',program:values.program||''};
  }
  return Object.freeze({ resolve, summarize });
})();
