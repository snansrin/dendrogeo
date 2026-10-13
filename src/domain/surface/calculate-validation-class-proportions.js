"use strict";

/* Convert confusion counts to per-map-class reference proportions. */
window.DG_CALCULATE_VALIDATION_CLASS_PROPORTIONS={
  calculate(confusion,classes){
    const proportions={};
    for(const mapClass of classes){
      proportions[mapClass]={};
      const rowN=confusion.nRow[mapClass]||0;
      for(const refClass of classes)proportions[mapClass][refClass]=rowN>0?confusion.n[mapClass][refClass]/rowN:0;
      proportions[mapClass].ambiguous=rowN>0?confusion.n[mapClass].ambiguous/rowN:0;
    }
    return proportions;
  }
};
