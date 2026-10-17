"use strict";

/* Build park-admin counts, visible rows, duplicate groups, and unnamed rows. */
function dgBuildParkAdminOverview({ rows, projects, measurements, showEmpty, normalizeLoose, normalizeName, query='', sort='name-asc' }) {
  const projByPark = {}, measByPark = {};
  (projects || []).forEach(project => {
    if (project.park_id) projByPark[project.park_id] = (projByPark[project.park_id] || 0) + 1;
  });
  (measurements || []).forEach(measurement => {
    if (measurement.park_id) measByPark[measurement.park_id] = (measByPark[measurement.park_id] || 0) + 1;
  });
  const isEmpty = park => !(projByPark[park.id] > 0) && !(measByPark[park.id] > 0);
  const emptyRows = rows.filter(isEmpty);
  const visible = rows.filter(park => !isEmpty(park) || showEmpty || !!normalizeName(query));
  const byName = {};
  visible.forEach(park => {
    const key = normalizeLoose(park.name) || ("#" + park.id);
    (byName[key] = byName[key] || []).push(park);
  });
  const dupGroups = Object.values(byName).filter(group => group.length > 1);
  const unnamed = visible.filter(park => !park.name || normalizeName(park.name).indexOf("isimsiz") === 0);
  const creator=park=>(Array.isArray(park.creator)?park.creator[0]:park.creator)?.full_name||park.created_by||'';
  const needle=normalizeName(query);
  const compare=(a,b)=>String(a||'').localeCompare(String(b||''),'tr',{numeric:true,sensitivity:'base'});
  const date=park=>Number.isFinite(Date.parse(park.created_at))?Date.parse(park.created_at):0;
  const comparators={
    'name-asc':(a,b)=>compare(a.name,b.name),'name-desc':(a,b)=>compare(b.name,a.name),
    'created-desc':(a,b)=>date(b)-date(a),'created-asc':(a,b)=>date(a)-date(b),
    'creator-asc':(a,b)=>compare(creator(a),creator(b)),
    'measurements-desc':(a,b)=>(measByPark[b.id]||0)-(measByPark[a.id]||0),
    'projects-desc':(a,b)=>(projByPark[b.id]||0)-(projByPark[a.id]||0),
    'area-desc':(a,b)=>(Number(b.area_m2)||0)-(Number(a.area_m2)||0)
  };
  const order=comparators[sort]||comparators['name-asc'];
  const shown=visible.filter(park=>!needle||normalizeName([park.id,park.name,park.city,park.country,park.osm_key,creator(park)].join(' ')).includes(needle)).sort((a,b)=>order(a,b)||compare(a.name,b.name)||Number(a.id)-Number(b.id));
  return { projByPark, measByPark, emptyRows, shown, dupGroups, unnamed, query, sort, visibleCount:visible.length };
}

window.DG_PARK_ADMIN_OVERVIEW = Object.freeze({ build: dgBuildParkAdminOverview });
