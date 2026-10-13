"use strict";

/* Parse the existing coordinate-first CSV format, skipping its header and blanks. */
window.DG_PARSE_WAYPOINT_CSV={
  parse(text){return String(text).replace(/^\uFEFF/,"").split(/\r?\n/).slice(1).filter(line=>line.trim()).map(line=>line.split(",").map(value=>value.trim().replace(/^"|"$/g,"")));}
};
