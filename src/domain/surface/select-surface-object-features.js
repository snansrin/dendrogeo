"use strict";
window.DG_SELECT_SURFACE_OBJECT_FEATURES={select({rawView,record}){if(rawView)return [];return[...(record?.useObjects!==false?record?.objectFeatures||[]:[]),...(record?.features||[])];}};
