"use strict";

/* Accept only positive integer waypoint IDs and finite geographic coordinates. */
window.DG_VALIDATE_WAYPOINT_CSV_ROW={
  validate(cells){
    const lon=Number(cells[0]),lat=Number(cells[1]),id=Number(cells[2]);
    if(cells.length<3||!cells[0]||!cells[1]||!Number.isInteger(id)||id<=0||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
    return{lon,lat,id};
  }
};
