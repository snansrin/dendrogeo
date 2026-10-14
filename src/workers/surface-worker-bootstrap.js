/* Load shared park geometry contracts before the frozen surface worker. */
(function(){
 self.window=self;
 const version=new URL(self.location.href).searchParams.get('v')||'current';
 const query='?v='+encodeURIComponent(version);
 importScripts('../domain/parks/osm-rings.js'+query,'../domain/parks/ensure-osm-rings.js'+query,'./surface-worker.js'+query);
})();
