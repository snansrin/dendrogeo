"use strict";

/* Apply reviewed class moves to mapped areas without mutating source areas. */
window.DG_APPLY_VALIDATION_CAMPAIGN_CORRECTIONS={
  apply(groupAreas,cells,corrections){
    const correctedAreas={};for(const key of Object.keys(groupAreas||{}))correctedAreas[key]=Number(groupAreas[key])||0;
    const lookup={};for(const cell of(cells||[]))lookup[cell.row+":"+cell.col]=cell;
    let nCorrected=0,nConfirmed=0,nOrphan=0,movedAreaM2=0;
    for(const key of Object.keys(corrections||{})){
      const record=corrections[key],cell=lookup[key];if(!cell||!record||!record.from){nOrphan++;continue;}
      const area=Number(cell.areaM2)||0;
      if(record.to&&record.to!==record.from&&correctedAreas[record.from]!==undefined&&correctedAreas[record.to]!==undefined){correctedAreas[record.from]=Math.max(0,correctedAreas[record.from]-area);correctedAreas[record.to]=correctedAreas[record.to]+area;movedAreaM2+=area;nCorrected++;}
      else nConfirmed++;
    }
    return{correctedAreas,nCorrected,nConfirmed,nOrphan,movedAreaM2:+movedAreaM2.toFixed(3)};
  }
};
