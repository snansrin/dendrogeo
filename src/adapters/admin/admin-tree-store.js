"use strict";

window.DG_ADMIN_TREE_STORE = (() => {
  const SELECT_FULL = "id,point_id,measurement_no,species,grp,dbh_cm,girth_cm,height_m,carbon_kg," +
    "status,photo_url,created_at,lat,lon,owner,project_id,park_id," +
    "reviewed_by,reviewed_at,profiles!measurements_owner_fkey(full_name)," +
    "projects(id,name,park_id,park_name,is_locked,parks(id,name,area_m2,city,country))";

  async function fetchRows(sb, warnIfTruncated) {
    let result = await sb.from("measurements")
      .select(SELECT_FULL, { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (!result.error) {
      warnIfTruncated(result.data, 1000, "Yönetim ağacı", result.count);
      return { rows: result.data || [], count: result.count, mode: "embed", error: null };
    }
    const firstError = result.error;
    const [measurements, projects, users] = await Promise.all([
      sb.from("measurements").select("*").order("created_at", { ascending: false }).limit(1000),
      sb.from("projects").select("*,parks(id,name,area_m2,city,country)").limit(1000),
      sb.from("profiles").select("id,full_name,email").limit(1000),
    ]);
    if (!measurements.error) {
      warnIfTruncated(measurements.data, 1000, "Yönetim ağacı", null);
      const projectById = new Map((projects.data || []).map(project => [project.id, project]));
      const userById = new Map((users.data || []).map(user => [user.id, user]));
      const rows = (measurements.data || []).map(measurement => ({
        ...measurement,
        profiles: userById.get(measurement.owner) || null,
        projects: projectById.get(measurement.project_id) || null,
      }));
      return { rows, count: rows.length, mode: "join",
        error: firstError ? "embed hatası, yedek join kullanıldı: " + firstError.message : null };
    }
    return { rows: [], count: 0, mode: "fail",
      error: (firstError && firstError.message) + " | yedek: " + (measurements.error && measurements.error.message) };
  }

  return Object.freeze({ fetchRows });
})();
