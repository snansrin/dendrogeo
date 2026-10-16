"use strict";

/* Project name preview uses the same canonical park + label rule as persistence. */
window.DG_MEASUREMENT_PROJECT_NAME_PREVIEW={
  render({element,park,label,projectName}){
    if(!element)return;
    if(!park||!park.name){element.removeAttribute?.("translate");element.textContent="— (önce park algıla)";element.style.color="var(--mut)";return;}
    element.setAttribute?.("translate","no");element.textContent=projectName(park.name,label||"");element.style.color="var(--ink)";
  }
};
