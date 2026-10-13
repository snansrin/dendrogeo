"use strict";

/* Do not commit geometry prepared for a previous editor epoch. */
window.DG_IS_SURFACE_REPARTITION_CURRENT={
  check({epoch,currentEpoch}){return epoch===currentEpoch;}
};
