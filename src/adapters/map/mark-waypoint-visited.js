"use strict";

window.DG_MARK_WAYPOINT_VISITED={
  async mark({client,id}){return await client.from("waypoints").update({visited:true}).eq("id",id);}
};
