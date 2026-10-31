import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const species=read('src/config/species.js');
const palette=JSON.parse(species.match(/const GROUP_COLOR=(\{[^\n]+\});/)[1]);

function fixture({loadPalette=true}={}){
  const markers=[];
  const leaflet={
    divIcon:options=>options,
    marker:(point,options)=>{
      const marker={point,options,bindPopup(html){this.popup=html;}};
      markers.push(marker);
      return marker;
    },
    markerClusterGroup:()=>({items:[],addLayer(marker){this.items.push(marker);},clearLayers(){this.items=[];}})
  };
  const context=vm.createContext({window:{},console,setTimeout:callback=>callback()});
  if(loadPalette)vm.runInContext(`const GROUP_COLOR=${JSON.stringify(palette)};`,context);
  vm.runInContext(read('src/ui/create-measurement-map-marker.js'),context);
  vm.runInContext(read('src/ui/map-measurement-markers.js'),context);
  return {markers,leaflet,ui:context.window};
}

const rows=[
  {lat:39.1,lon:32.1,point_id:1,grp:'İBRELİ'},
  {lat:39.2,lon:32.2,point_id:2,grp:'YAPRAKLI'},
  {lat:39.3,lon:32.3,point_id:3,grp:'DİĞER'},
  {lat:39.4,lon:32.4,point_id:4,grp:null}
];

test('the existing analysis bar colors are the marker colors',()=>{
  assert.equal(palette['İBRELİ'],'#1e6f4b');
  assert.equal(palette['YAPRAKLI'],'#c77d2e');
  const {leaflet,ui}=fixture();
  for(const row of rows){
    const marker=ui.DG_CREATE_MEASUREMENT_MAP_MARKER.create(row,{leaflet,popupHTML:value=>`P${value.point_id}`});
    const expected=palette[row.grp]||palette['İBRELİ'];
    assert.ok(marker.options.icon.html.includes(`background:${expected}`),`point ${row.point_id}`);
    assert.equal(marker.popup,`P${row.point_id}`);
    assert.equal(marker.options.icon.className,'tree-marker');
    assert.deepEqual(Array.from(marker.point),[row.lat,row.lon]);
  }
});

test('live and world maps share the group colors without changing cluster membership',()=>{
  const {leaflet,ui}=fixture();
  for(const name of ['live','world']){
    const map={name,addLayer(layer){this.layer=layer;}};
    ui.DG_MAP_MEASUREMENT_MARKERS.add(map,rows,2,{leaflet,popupHTML:row=>`P${row.point_id}`,setTimer:callback=>callback()});
    assert.equal(map.layer.items.length,rows.length);
    assert.deepEqual(map.layer.items.map(item=>item.popup),['P1','P2','P3','P4']);
    for(let i=0;i<rows.length;i++){
      assert.ok(map.layer.items[i].options.icon.html.includes(`background:${palette[rows[i].grp]||palette['İBRELİ']}`));
    }
  }
});

test('older harnesses without the palette keep green and amber canonical groups',()=>{
  const {leaflet,ui}=fixture({loadPalette:false});
  const broadleaf=ui.DG_CREATE_MEASUREMENT_MAP_MARKER.create(rows[1],{leaflet,popupHTML:()=>''});
  const conifer=ui.DG_CREATE_MEASUREMENT_MAP_MARKER.create(rows[0],{leaflet,popupHTML:()=>''});
  assert.match(broadleaf.options.icon.html,/background:#c77d2e/);
  assert.match(conifer.options.icon.html,/background:#1e6f4b/);
});
