"use strict";

/* Preserve owner-first project order and keep the input collections untouched. */
window.DG_MERGE_MEASUREMENT_PROJECTS={
  merge(ownedProjects,sharedProjects){return [...(ownedProjects||[]),...(sharedProjects||[])];}
};
