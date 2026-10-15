"use strict";

/* Keep the park registry's three admin reads in the Supabase adapter layer. */
window.DG_PARK_ADMIN_READ_STORE={
  fetchParks(client){return client.from("parks").select("*").order("name");},
  fetchProjects(client){return client.from("projects").select("id,name,park_id");},
  fetchMeasurements(client){return client.from("measurements").select("park_id").limit(5000);}
};
