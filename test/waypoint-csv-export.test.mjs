import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('File export menu exposes the themed waypoint CSV action and routes it to the existing downloader',()=>{
 const menus=read('src/ui/render-surface-editor-menus.js'),sens=read('src/ui/lc-sens.js'),help=read('src/ui/operation-help-content.js');
 assert.match(menus,/data-dg-click="exportWaypointsCsv"/);
 assert.match(menus,/dg-png-btn ghost sm[^>]*data-dg-click="exportWaypointsCsv"/);
 assert.match(sens,/exportWaypointsCsv:\(\)=>window\.downloadWaypointsCSV\?\.\(\)/);
 assert.match(help,/exportWaypointsCsv:'pointsCsv'/);
});

test('CSV downloader exports only the selected project points and ignores stale or foreign project lists',()=>{
 const source=read('src/ui/park-export.js'),start=source.indexOf('function downloadWaypointsCSV(){'),end=source.indexOf('/* =========================================================',start);
 assert.ok(start>=0&&end>start);
 const calls=[],context=vm.createContext({window:{DG_LIVE_MAP_PROJECTS:{activeProjectId:()=>12},DG_PARK_EXPORT_FORMATS:{waypointsCSV:rows=>{calls.push(rows);return'csv';}}},document:{getElementById:()=>null},LAST_WP_ROWS:[{project_id:12,wp_id:1},{project_id:13,wp_id:2}],WP:[{project_id:12,wp_id:8}],downloadBlob:(...args)=>calls.push(args),toast(){}});
 vm.runInContext(source.slice(start,end),context);vm.runInContext('downloadWaypointsCSV()',context);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),[{project_id:12,wp_id:1}]);
 assert.match(calls[1][0],/^dendrogeo_olcum_noktalari_12\.csv$/);
});

test('DendroGeo waypoint CSV keeps its import header, BOM, numeric order and quoted cells',()=>{
 const context=vm.createContext({window:{}});vm.runInContext(read('src/domain/parks/park-export-formats.js'),context);
 const csv=context.window.DG_PARK_EXPORT_FORMATS.waypointsCSV([{wp_id:3,lat:39.9,lon:32.8,visited:true}]);
 assert.equal(csv,'\uFEFFwp_id,lat,lon,visited\n"3","39.9","32.8","1"\n');
 const parseContext=vm.createContext({window:{}});vm.runInContext(read('src/domain/parks/parse-waypoint-csv.js'),parseContext);
 assert.deepEqual(JSON.parse(JSON.stringify(parseContext.window.DG_PARSE_WAYPOINT_CSV.parse(csv))),[['32.8','39.9','3','']]);
});
