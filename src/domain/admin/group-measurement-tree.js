"use strict";

window.DG_GROUP_MEASUREMENT_TREE = (() => {
  function group(rows) {
    const parks = new Map();
    (rows || []).forEach(r => {
      const proj = r.projects || null;
      const park = proj && proj.parks ? proj.parks : null;
      const parkId = park && park.id ? park.id : (r.park_id || 0);
      const pKey = parkId ? "p" + parkId : "p0";
      if (!parks.has(pKey)) parks.set(pKey, {
        key: pKey, park_id: parkId || 0,
        name: park ? (park.name || "İsimsiz park") : (parkId ? "Park #" + parkId : "⚠ Park algılanmamış"),
        pending: !parkId, area_m2: park && park.area_m2 ? park.area_m2 : null,
        city: (park && park.city) || (proj && proj.city) || "", projects: new Map(),
        n: 0, c: 0, beklemede: 0, onayli: 0, red: 0,
      });
      const P = parks.get(pKey);
      const jKey = "j" + (proj && proj.id ? proj.id : "x" + (r.project_id || 0));
      if (!P.projects.has(jKey)) P.projects.set(jKey, {
        key: jKey, project_id: (proj && proj.id) || r.project_id || 0,
        name: (proj && proj.name) || "Proje #" + (r.project_id || 0),
        is_locked: proj?.is_locked===true,
        park_name: (proj && proj.park_name) || null, users: new Map(),
        n: 0, c: 0, beklemede: 0, onayli: 0, red: 0,
      });
      const J = P.projects.get(jKey);
      const uKey = "u" + (r.owner || "bilinmeyen");
      if (!J.users.has(uKey)) {
        const profile = r.profiles || null;
        J.users.set(uKey, { key: uKey, owner: r.owner || null,
          name: (profile && profile.full_name) || (profile && profile.email) || "Bilinmeyen kullanıcı",
          rows: [], n: 0, c: 0, onayli: 0, beklemede: 0, red: 0 });
      }
      const U = J.users.get(uKey);
      const carbon = Number(r.carbon_kg) || 0;
      U.rows.push(r); U.n++; U.c += carbon;
      const status = r.status || "Beklemede";
      if (status === "Onaylı") { U.onayli++; J.onayli++; P.onayli++; }
      else if (status === "Red") { U.red++; J.red++; P.red++; }
      else { U.beklemede++; J.beklemede++; P.beklemede++; }
      J.n++; J.c += carbon; P.n++; P.c += carbon;
    });
    const out = [...parks.values()].map(P => {
      P.projects = [...P.projects.values()].map(J => {
        J.users = [...J.users.values()].sort((a, b) => (b.beklemede - a.beklemede) || (b.c - a.c) || (b.n - a.n));
        for (const U of J.users) U.rows.sort((a, b) => (+a.point_id || 0) - (+b.point_id || 0) || (+a.measurement_no || 1) - (+b.measurement_no || 1));
        return J;
      }).sort((a, b) => (b.beklemede - a.beklemede) || (b.c - a.c) || (b.n - a.n));
      return P;
    });
    return out.sort((a, b) => (a.pending - b.pending) || (b.beklemede - a.beklemede) || (b.c - a.c) || (b.n - a.n));
  }

  return Object.freeze({ group });
})();
