"use strict";

/* Keep the bulk administrator geocode read and row updates at the Supabase boundary. */
window.DG_ADMIN_RE_GEOCODE_STORE = (() => {
  function create(getClient) {
    async function loadMeasurements() {
      const { data } = await getClient().from("measurements").select("id,lat,lon,city,country");
      return data || [];
    }

    function updatePlace(id, fields) {
      return getClient().from("measurements").update(fields).eq("id", id);
    }

    return Object.freeze({ loadMeasurements, updatePlace });
  }

  return Object.freeze({ create });
})();
