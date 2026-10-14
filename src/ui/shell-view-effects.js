"use strict";
/* Keep asynchronous view refresh schedules and data loaders out of DOM activation. */
window.DG_SHELL_VIEW_EFFECTS={run(view,ports){const {schedule,getDataLoader}=ports;const data=()=>getDataLoader();
 if(view==='dash'){if(data())data().load(view);else ports.loadWaypoints().then(()=>ports.loadDash());}
 if(view==='measure'){ports.refreshParkGate();ports.scheduleLiveShare();}
 if(view==='map')schedule(ports.refreshMap,150);
 if(view==='nav'){schedule(ports.refreshNavigation,150);if(data())data().load(view);else ports.loadWaypoints();}
 if((view==='records'||view==='world')&&data())data().load(view);
 if(view==='world')schedule(ports.refreshWorld,150);
 if(view==='admin')ports.loadAdmin();
 if(view==='projects'){ports.loadInvites();ports.loadCollaborators();}
 if(view==='users')ports.loadUsers();
 if(view==='visitors')schedule(ports.loadVisitors,120);
 if(view==='export'){if(data())data().load(view);else{ports.loadMyRequests();ports.loadRequestOptions();}}
}};
