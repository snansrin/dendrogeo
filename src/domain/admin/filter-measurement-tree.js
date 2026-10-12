"use strict";

window.DG_FILTER_MEASUREMENT_TREE = (() => {
  function filter(rows, status, query) {
    const q = String(query || "").trim().toLocaleLowerCase("tr");
    return (rows || []).filter(r => {
      if (status && (r.status || "Beklemede") !== status) return false;
      if (!q) return true;
      const proj = r.projects && r.projects.name ? r.projects.name : "";
      const park = (r.projects && r.projects.parks && r.projects.parks.name) || (r.projects && r.projects.park_name) || "";
      const user = r.profiles && r.profiles.full_name ? r.profiles.full_name : "";
      return (proj + " " + park + " " + user + " " + (r.species || "") + " " + (r.point_id || "") + " " + (r.city || ""))
        .toLocaleLowerCase("tr").includes(q);
    });
  }

  return Object.freeze({ filter });
})();
