"use strict";

window.DG_DELETE_PROJECT_WAYPOINTS={
  async delete({client,projectId}){return await client.from("waypoints").delete().eq("project_id",projectId);}
};
