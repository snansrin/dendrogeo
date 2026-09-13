"use strict";
/* ===== DendroGeo v2 · src/services/gridplan.js v9 =====
Park sınırı + grid planlama + su/katı zemin filtresi
+ RBush spatial index + MANUEL SEÇİM (FİLTRE MUAF) */

// --- Global değişkenler ---
var PARK_POLY = null, PARK_LAYER = null, PARK_MODE = false, PARK_CLICK_BOUND = false, PARK_CANDS = [];
var WATER_RINGS = [], WATER_LAYER = null;
var IMP_NODES = [], IMP_LAYER = null;
var GRID_CELLS = [];
var GRID_LAYER = null, WP_AUTO_LAYER = null;
var SELECTED_CELLS = new Set();
var WATER_TREE = null, IMP_TREE = null;

var OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter"
];

// --- RBush yükleme (dinamik import) ---
async function loadRBush() {
  if (window.RBush) return;
  try {
    var module = await import('https://cdn.jsdelivr.net/npm/rbush@3.0.1/+esm');
    window.RBush = module.default;
  } catch (e) {
    console.warn('RBush yüklenemedi, manuel index kullanılacak:', e);
  }
}

// --- RBush spatial index ---
function buildRBush(points) {
  if (!window.RBush) return null;
  var tree = new window.RBush();
  var items = points.map(function(p, i) {
    return { minX: p[1], minY: p[0], maxX: p[1], maxY: p[0], idx: i, lat: p[0], lon: p[1] };
  });
  tree.load(items);
  return tree;
}

function queryRBush(tree, lat, lon, bufferDeg) {
  if (!tree) return [];
  return tree.search({
    minX: lon - bufferDeg, minY: lat - bufferDeg,
    maxX: lon + bufferDeg, maxY: lat + bufferDeg
  });
}

// --- esc yardımcı (başka dosyada tanımlı değilse) ---
if (typeof window.esc !== 'function') {
  window.esc = function(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
}
var esc = window.esc;

// --- Overpass sorgusu ---
async function queryPark(lat, lon, radius) {
  radius = radius || 1200;
  await loadRBush();
  var q = '[out:json][timeout:20];(' +
    'way["leisure"~"park|garden|nature_reserve|common|recreation_ground|playground|pitch"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'way["landuse"~"forest|grass|meadow|recreation_ground"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'relation["leisure"~"park|garden|nature_reserve|common|recreation_ground"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'way["natural"="water"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'way["waterway"~"riverbank|canal|dock|basin"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'relation["natural"="water"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'way["building"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'way["highway"~"residential|primary|secondary|tertiary|service|footway|path|cycleway|track|unclassified"](around:' + radius + ',' + lat + ',' + lon + ');' +
    'way["landuse"~"commercial|industrial|retail|construction"](around:' + radius + ',' + lat + ',' + lon + ');' +
    ');out geom;';

  for (var i = 0; i < OVERPASS_URLS.length; i++) {
    var url = OVERPASS_URLS[i];
    try {
      var res = await fetch(url + '?data=' + encodeURIComponent(q));
      if (!res.ok) continue;
      var json = await res.json();
      var cands = [];
      WATER_RINGS = [];
      IMP_NODES = [];

      var elements = json.elements || [];
      for (var j = 0; j < elements.length; j++) {
        var el = elements[j];
        if (isWater(el)) {
          var wr = extractRings(el);
          if (wr) WATER_RINGS = WATER_RINGS.concat(wr);
          continue;
        }
        if (isImpervious(el)) {
          collectImpNodes(el);
          continue;
        }
        var rings = extractRings(el);
        if (!rings || !rings.length) continue;
        cands.push({ rings: rings, name: (el.tags && el.tags.name) || null, area: polyArea(rings) });
      }

      if (!cands.length) continue;

      var inside = cands.filter(function(c) { return pointInPark(lat, lon, c.rings); });
      WATER_TREE = buildRBush(WATER_RINGS.flat());
      IMP_TREE = buildRBush(IMP_NODES);
      return (inside.length ? inside : cands).slice().sort(function(a, b) { return b.area - a.area; });
    } catch (e) {
      console.warn('Overpass denemesi başarısız:', url, e);
    }
  }
  return null;
}

// --- OSM element işleme ---
function extractRings(el) {
  if (el.type === "way" && el.geometry) {
    var r = el.geometry.map(function(g) { return [g.lat, g.lon]; });
    return r.length > 2 ? [r] : null;
  }
  if (el.type === "relation" && el.members) {
    var outer = el.members.filter(function(m) { return m.role === "outer" && m.geometry; })
      .map(function(m) { return m.geometry.map(function(g) { return [g.lat, g.lon]; }); });
    if (!outer.length) return null;
    return joinWaysToRings(outer);
  }
  return null;
}

function isWater(el) {
  var t = el.tags || {};
  return t.natural === "water" || t.landuse === "reservoir" || t.landuse === "basin" ||
         t.leisure === "swimming_pool" || !!t.waterway;
}

function isImpervious(el) {
  var t = el.tags || {};
  return !!t.building || !!t.highway || t.landuse === "commercial" ||
         t.landuse === "industrial" || t.landuse === "retail" || t.landuse === "construction";
}

function collectImpNodes(el) {
  if (el.type === "way" && el.geometry) {
    el.geometry.forEach(function(g) { IMP_NODES.push([g.lat, g.lon]); });
  } else if (el.type === "relation" && el.members) {
    el.members.filter(function(m) { return m.geometry; }).forEach(function(m) {
      m.geometry.forEach(function(g) { IMP_NODES.push([g.lat, g.lon]); });
    });
  }
}

function pointInWater(lat, lon) {
  return WATER_RINGS.some(function(r) { return pointInPolygon(lat, lon, r); });
}

// --- Su / bina yakınlık kontrolü (RBush) ---
function nearWater(queryLat, queryLon) {
  var b2 = 0.000135 * 0.000135; // ~15m
  var pts = queryRBush(WATER_TREE, queryLat, queryLon, 0.0002);
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i];
    var dx = p.lon - queryLon, dy = p.lat - queryLat;
    if (dx * dx + dy * dy < b2) return true;
  }
  return false;
}

function nearImpervious(queryLat, queryLon) {
  var b2 = 0.00009 * 0.00009; // ~10m
  var pts = queryRBush(IMP_TREE, queryLat, queryLon, 0.0002);
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i];
    var dx = p.lon - queryLon, dy = p.lat - queryLat;
    if (dx * dx + dy * dy < b2) return true;
  }
  return false;
}

function isValidSpot(lat, lon) {
  if (pointInWater(lat, lon)) return false;
  if (nearWater(lat, lon)) return false;
  if (nearImpervious(lat, lon)) return false;
  return true;
}

// --- Hücre geçerlilik (merkez + 4 köşe) ---
function isCellValid(s0, s1, w0, w1) {
  var cLat = (s0 + s1) / 2, cLon = (w0 + w1) / 2;
  if (!pointInPark(cLat, cLon, PARK_POLY)) return false;
  if (!isValidSpot(cLat, cLon)) return false;
  if (!isValidSpot(s0, w0)) return false;
  if (!isValidSpot(s0, w1)) return false;
  if (!isValidSpot(s1, w0)) return false;
  if (!isValidSpot(s1, w1)) return false;
  return true;
}

// --- Geometri yardımcıları ---
function joinWaysToRings(ways) {
  var rings = [], rem = ways.slice();
  var eq = function(a, b) { return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9; };
  while (rem.length) {
    var ch = rem.shift().slice();
    var m = true, guard = ways.length * 2 + 10;
    while (m && guard-- > 0) {
      m = false;
      for (var i = 0; i < rem.length; i++) {
        var w = rem[i], h = ch[0], t = ch[ch.length - 1];
        if (eq(t, w[0])) { ch.push.apply(ch, w.slice(1)); m = true; }
        else if (eq(t, w[w.length - 1])) { ch.push.apply(ch, w.slice().reverse().slice(1)); m = true; }
        else if (eq(h, w[w.length - 1])) { ch.unshift.apply(ch, w.slice(0, -1)); m = true; }
        else if (eq(h, w[0])) { ch.unshift.apply(ch, w.slice().reverse().slice(0, -1)); m = true; }
        if (m) { rem.splice(i, 1); break; }
      }
    }
    if (ch.length > 2) rings.push(ch);
  }
  return rings;
}

function pointInPolygon(lat, lon, ring) {
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var yi = ring[i][0], xi = ring[i][1], yj = ring[j][0], xj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function pointInPark(lat, lon, rings) {
  return rings.some(function(r) { return pointInPolygon(lat, lon, r); });
}

function polyArea(rings) {
  var t = 0;
  for (var k = 0; k < rings.length; k++) {
    var ring = rings[k];
    if (!ring || ring.length < 3) continue;
    var kx = 111320 * Math.cos(ring[0][0] * Math.PI / 180), ky = 110540;
    var a = 0;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      a += (ring[j][1] * kx) * (ring[i][0] * ky) - (ring[i][1] * kx) * (ring[j][0] * ky);
    }
    t += Math.abs(a / 2);
  }
  return t;
}

// --- Park modu ---
function toggleParkMode() {
  PARK_MODE = !PARK_MODE;
  var b = $("parkModeBtn");
  if (b) {
    b.textContent = "🌳 Park Analizi Modu: " + (PARK_MODE ? "AÇIK" : "KAPALI");
    b.className = "btn sm " + (PARK_MODE ? "" : "blue");
  }
  var hint = $("parkModeHint");
  if (hint) hint.textContent = PARK_MODE ? "Şimdi haritada bir parkın İÇİNE tıkla." : "Açınca haritada bir parkın içine tıkla → sınırı otomatik algılanır.";
  bindParkClick();
  if (!PARK_MODE) { PARK_CANDS = []; clearPark(); }
}

function bindParkClick() {
  if (PARK_CLICK_BOUND || typeof map === 'undefined' || !map) return;
  PARK_CLICK_BOUND = true;
  map.on("click", async function(e) {
    if (!PARK_MODE) return;
    toast("🌳 Park sınırı sorgulanıyor…", "info");
    var parks = await queryPark(e.latlng.lat, e.latlng.lng);
    if (!parks || !parks.length) return toast("Park bulunamadı veya Overpass yoğun. 10 sn sonra tekrar dene.", "warn");
    PARK_CANDS = parks;
    drawPark(parks[0]);
  });
}

function drawPark(park) {
  clearPark(); clearGrid();
  PARK_POLY = park.rings;
  PARK_LAYER = L.polygon(park.rings, { color: "#2b6cb0", weight: 2.5, dashArray: "6,6", fillColor: "#3b82f6", fillOpacity: 0.10, interactive: false }).addTo(map);
  if (WATER_RINGS.length) WATER_LAYER = L.polygon(WATER_RINGS, { color: "#2563eb", weight: 1, fillColor: "#60a5fa", fillOpacity: 0.4, interactive: false }).addTo(map);
  if (IMP_NODES.length) {
    IMP_LAYER = L.layerGroup().addTo(map);
    IMP_NODES.forEach(function(p) {
      L.circleMarker(p, { radius: 1.5, color: "#9ca3af", fillColor: "#9ca3af", fillOpacity: 0.5, weight: 0, interactive: false }).addTo(IMP_LAYER);
    });
  }
  map.fitBounds(PARK_LAYER.getBounds(), { padding: [30, 30] });

  var totalArea = park.area / 10000;
  var waterArea = WATER_RINGS.length ? polyArea(WATER_RINGS) : 0;
  var landArea = Math.max(0, park.area - waterArea);
  var haLand = (landArea / 10000).toFixed(1);
  var haWater = (waterArea / 10000).toFixed(1);

  var sizeWarn = "";
  if (totalArea > 50) {
    sizeWarn = '<div style="margin-top:8px;padding:10px;background:#fef3c7;border-radius:8px;font-size:.78rem;color:#92400e;border-left:3px solid #f59e0b">⚠️ <b>Bu alan çok geniş (' + totalArea.toFixed(1) + ' ha).</b> Grid oluşturmak yerine manuel waypoint kullanmanız önerilir.</div>';
  }

  var alt = PARK_CANDS.length > 1 ?
    '<div style="margin-top:8px;font-size:.8rem">🔁 Alan seç: <select id="parkAlt" onchange="switchPark(+this.value)">' +
    PARK_CANDS.map(function(c, i) {
      return '<option value="' + i + '"' + (c === park ? " selected" : "") + '>' + esc(c.name || "İsimsiz") + ' · ' + ((c.area - waterArea) / 10000).toFixed(1) + ' ha</option>';
    }).join("") + '</select></div>' : "";

  var info = $("parkInfo");
  if (info) {
    info.style.display = "block";
    info.innerHTML = '<b>🌳 ' + esc(park.name || "İsimsiz Park") + '</b> · <b>Kara: ' + haLand + ' ha</b>' +
      (haWater > 0.1 ? ' · Su: ' + haWater + ' ha' : '') + alt + sizeWarn +
      '<div style="font-size:.75rem;color:var(--mut);margin-top:4px">🔒 Filtre: suya 15m + yol/binaya 10m (RBush spatial index)</div>' +
      '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<label style="font-size:.8rem">Proje:</label>' +
      '<select id="gridProject">' + ((typeof PROJ_LIST !== "undefined" && PROJ_LIST.length) ? PROJ_LIST.map(function(p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join("") : '<option value="0">Önce proje oluştur</option>') + '</select>' +
      '<label style="font-size:.8rem">Grid:</label>' +
      '<select id="gridSize"><option value="10">10×10 m</option><option value="20" selected>20×20 m</option><option value="50">50×50 m</option></select>' +
      '<label style="font-size:.8rem">Yeterli eşik:</label>' +
      '<select id="gridThresh"><option value="1">1+</option><option value="2">2+</option><option value="3" selected>3+</option><option value="5">5+</option></select></div>' +
      '<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<button class="btn sm blue" onclick="buildGrid()">🔲 Grid Oluştur</button>' +
      '<button class="btn sm" id="gridVisBtn" onclick="toggleGridVis()">🔲 Grid: GÖRÜNÜR</button>' +
      '<button class="btn sm" id="wpVisBtn" onclick="toggleWpVis()">📍 Waypoint: GÖRÜNÜR</button>' +
      '<button class="btn sm" onclick="clearGrid()">✕ Temizle</button></div>' +
      '<div id="gridSummary" style="margin-top:10px;font-size:.85rem;line-height:1.7"></div>';
  }
  toast("✓ Park algılandı: " + haLand + " ha kara" + (haWater > 0.1 ? " + " + haWater + " ha su" : ""), "ok", "🌳");
}

function clearPark() {
  if (PARK_LAYER && map) { map.removeLayer(PARK_LAYER); PARK_LAYER = null; }
  if (WATER_LAYER && map) { map.removeLayer(WATER_LAYER); WATER_LAYER = null; }
  if (IMP_LAYER && map) { map.removeLayer(IMP_LAYER); IMP_LAYER = null; }
  WATER_RINGS = []; IMP_NODES = []; PARK_POLY = null;
  WATER_TREE = null; IMP_TREE = null;
  var pi = $("parkInfo");
  if (pi) { pi.style.display = "none"; pi.innerHTML = ""; }
}

function switchPark(i) {
  var p = PARK_CANDS[i];
  if (p) drawPark(p);
}

// --- Grid oluşturma ---
async function buildGrid() {
  if (!PARK_POLY || !PARK_POLY.length) return toast("Önce park seç");
  var size = +$("gridSize").value || 20;
  var thresh = +$("gridThresh").value || 3;
  var est = Math.round(polyArea(PARK_POLY) / (size * size));
  if (est > 3000) return toast("⚠ ~" + est + " hücre çok yoğun. 50×50 m seç.", "err");
  if (est > 800 && !confirm("⚠ ~" + est + " hücre oluşturulacak.\nDevam?")) return;
  clearGrid();

  var minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  PARK_POLY.forEach(function(r) {
    r.forEach(function(p) {
      if (p[0] < minLat) minLat = p[0]; if (p[0] > maxLat) maxLat = p[0];
      if (p[1] < minLon) minLon = p[1]; if (p[1] > maxLon) maxLon = p[1];
    });
  });

  var lat0 = minLat * Math.PI / 180;
  var dLat = size / 110540, dLon = size / (111320 * Math.cos(lat0));
  var cellMap = {};
  GRID_CELLS.length = 0;

  for (var rI = 0; ; rI++) {
    var s0 = minLat + rI * dLat, s1 = s0 + dLat;
    if (s0 >= maxLat) break;
    for (var cI = 0; ; cI++) {
      var w0 = minLon + cI * dLon, w1 = w0 + dLon;
      if (w0 >= maxLon) break;
      var cLat = s0 + dLat / 2, cLon = w0 + dLon / 2;
      if (!isCellValid(s0, s1, w0, w1)) continue;
      var cell = { lat: cLat, lon: cLon, s0: s0, s1: s1, w0: w0, w1: w1, n: 0, id: rI + "_" + cI };
      cellMap[cell.id] = cell;
      GRID_CELLS.push(cell);
    }
  }

  var res = await sb.from("measurements").select("lat,lon").eq("status", "Onaylı")
    .gte("lat", minLat).lte("lat", maxLat).gte("lon", minLon).lte("lon", maxLon).limit(5000);
  (res.data || []).forEach(function(m) {
    var cell = cellMap[Math.floor((m.lat - minLat) / dLat) + "_" + Math.floor((m.lon - minLon) / dLon)];
    if (cell) cell.n++;
  });

  SELECTED_CELLS.clear();
  drawGridLayer();
  toast("✓ Grid hazır: " + GRID_CELLS.length + " hücre", "ok", "🔲");
}

function drawGridLayer() {
  if (GRID_LAYER && map) map.removeLayer(GRID_LAYER);
  GRID_LAYER = L.layerGroup().addTo(map);
  var thresh = +($("gridThresh") || {}).value || 3;
  var g = 0, y = 0, r0 = 0;

  GRID_CELLS.forEach(function(cell) {
    var col = cell.n === 0 ? "#e11d48" : (cell.n < thresh ? "#f59e0b" : "#16a34a");
    if (cell.n === 0) r0++; else if (cell.n < thresh) y++; else g++;
    var isSel = SELECTED_CELLS.has(cell.id);
    var rect = L.rectangle([[cell.s0, cell.w0], [cell.s1, cell.w1]], {
      color: isSel ? "#1d4ed8" : col,
      weight: isSel ? 3 : 1.2,
      fillColor: isSel ? "#3b82f6" : col,
      fillOpacity: isSel ? 0.55 : 0.32,
      interactive: true
    }).addTo(GRID_LAYER);
    rect._cellId = cell.id;
    rect.on("click", function(e) {
      L.DomEvent.stopPropagation(e);
      toggleCellSelection(cell.id, rect);
    });
    rect.bindTooltip("Hücre " + cell.id + " · " + cell.n + " ölçüm · Tıkla: seç/kaldır", { sticky: true });
  });

  updateGridSummary(g, y, r0);
}

function updateGridSummary(g, y, r0) {
  var thresh = +($("gridThresh") || {}).value || 3;
  var tot = GRID_CELLS.length;
  var pct = function(v) { return tot ? Math.round(v / tot * 100) : 0; };
  var selCount = SELECTED_CELLS.size;
  var el = $("gridSummary");
  if (!el) return;
  el.innerHTML =
    '<b>📊 Park Analizi</b> · Grid ' + (($("gridSize") || {}).value || 20) + '×' + (($("gridSize") || {}).value || 20) + ' m<br>' +
    'Toplam hücre: <b>' + tot + '</b><br>' +
    '<span style="color:#16a34a">🟢 Yeterli (' + thresh + '+): ' + g + ' (%' + pct(g) + ')</span> · ' +
    '<span style="color:#b45309">🟡 Az: ' + y + ' (%' + pct(y) + ')</span> · ' +
    '<span style="color:#e11d48">🔴 Boş: ' + r0 + ' (%' + pct(r0) + ')</span><br>' +
    (selCount > 0 ? '<b style="color:#1d4ed8">🔵 Seçili: ' + selCount + ' hücre</b><br>' : "") +
    '💡 Hücrelere tıklayarak manuel seçim yapabilirsiniz.<br>' +
    '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">' +
    (r0 > 0 ? '<button class="btn sm blue" onclick="createWaypointsFromGrid(\'auto\')">📍 Otomatik (' + r0 + ' boş)</button>' : "") +
    (selCount > 0 ? '<button class="btn sm" style="background:#1d4ed8;color:#fff" onclick="createWaypointsFromGrid(\'manual\')">📍 Seçili (' + selCount + ')</button>' : "") +
    (selCount > 0 ? '<button class="btn sm ghost" onclick="clearCellSelection()">✕ Seçimi Temizle</button>' : "") +
    '</div>';
}

function toggleCellSelection(cellId, rect) {
  if (SELECTED_CELLS.has(cellId)) {
    SELECTED_CELLS.delete(cellId);
    var cell = GRID_CELLS.find(function(c) { return c.id === cellId; });
    if (cell) {
      var thresh = +($("gridThresh") || {}).value || 3;
      var col = cell.n === 0 ? "#e11d48" : (cell.n < thresh ? "#f59e0b" : "#16a34a");
      rect.setStyle({ color: col, weight: 1.2, fillColor: col, fillOpacity: 0.32 });
    }
  } else {
    SELECTED_CELLS.add(cellId);
    rect.setStyle({ color: "#1d4ed8", weight: 3, fillColor: "#3b82f6", fillOpacity: 0.55 });
  }
  var g = 0, y = 0, r0 = 0;
  var thresh = +($("gridThresh") || {}).value || 3;
  GRID_CELLS.forEach(function(c) { if (c.n === 0) r0++; else if (c.n < thresh) y++; else g++; });
  updateGridSummary(g, y, r0);
}

function clearCellSelection() {
  SELECTED_CELLS.clear();
  if (GRID_LAYER) {
    var thresh = +($("gridThresh") || {}).value || 3;
    GRID_LAYER.eachLayer(function(l) {
      if (l.setStyle && l._cellId) {
        var cell = GRID_CELLS.find(function(c) { return c.id === l._cellId; });
        if (cell) {
          var col = cell.n === 0 ? "#e11d48" : (cell.n < thresh ? "#f59e0b" : "#16a34a");
          l.setStyle({ color: col, weight: 1.2, fillColor: col, fillOpacity: 0.32 });
        }
      }
    });
  }
  var g = 0, y = 0, r0 = 0;
  var thresh = +($("gridThresh") || {}).value || 3;
  GRID_CELLS.forEach(function(c) { if (c.n === 0) r0++; else if (c.n < thresh) y++; else g++; });
  updateGridSummary(g, y, r0);
}

function clearGrid() {
  if (GRID_LAYER && map) { map.removeLayer(GRID_LAYER); GRID_LAYER = null; }
  if (WP_AUTO_LAYER && map) { map.removeLayer(WP_AUTO_LAYER); WP_AUTO_LAYER = null; }
  GRID_CELLS.length = 0;
  SELECTED_CELLS.clear();
  var gs = $("gridSummary");
  if (gs) gs.innerHTML = "";
}

function toggleGridVis() {
  if (!GRID_LAYER) return;
  if (map.hasLayer(GRID_LAYER)) { map.removeLayer(GRID_LAYER); $("gridVisBtn").textContent = "🔲 Grid: GİZLİ"; }
  else { map.addLayer(GRID_LAYER); $("gridVisBtn").textContent = "🔲 Grid: GÖRÜNÜR"; }
}

function toggleWpVis() {
  if (!WP_AUTO_LAYER) return;
  if (map.hasLayer(WP_AUTO_LAYER)) { map.removeLayer(WP_AUTO_LAYER); $("wpVisBtn").textContent = "📍 Waypoint: GİZLİ"; }
  else { map.addLayer(WP_AUTO_LAYER); $("wpVisBtn").textContent = "📍 Waypoint: GÖRÜNÜR"; }
}

// --- Waypoint oluşturma ---
async function createWaypointsFromGrid(mode) {
  if (!GRID_CELLS.length) return toast("Önce grid oluştur", "warn");
  var pid = +$("gridProject").value || 0;
  if (!pid) return toast("Önce proje seç veya oluştur", "warn");

  var targetCells = [];
  if (mode === "manual") {
    if (!SELECTED_CELLS.size) return toast("Önce hücre seçin", "warn");
    targetCells = GRID_CELLS.filter(function(c) { return SELECTED_CELLS.has(c.id); });
  } else {
    targetCells = GRID_CELLS.filter(function(c) { return c.n === 0; });
  }

  if (!targetCells.length) return toast("Uygun hücre yok", "warn");
  if (targetCells.length > 500 && !confirm(targetCells.length + " waypoint oluşturulacak.\nDevam?")) return;

  var res = await sb.from("waypoints").select("wp_id").eq("project_id", pid).order("wp_id", { ascending: false }).limit(1);
  var next = ((res.data && res.data.length ? res.data[0].wp_id : 0) + 1);
  var first = next;
  var rows = targetCells.map(function(c) {
    return { owner: USER.id, project_id: pid, wp_id: next++, lat: +c.lat.toFixed(6), lon: +c.lon.toFixed(6), visited: false };
  });

  var ins = await sb.from("waypoints").insert(rows);
  if (ins.error) return toast("Hata: " + ins.error.message, "err");

  if (WP_AUTO_LAYER && map) map.removeLayer(WP_AUTO_LAYER);
  WP_AUTO_LAYER = L.layerGroup().addTo(map);
  rows.forEach(function(r) {
    L.circleMarker([r.lat, r.lon], { radius: 5, color: "#fff", weight: 1.5, fillColor: "#e11d48", fillOpacity: 0.95, interactive: false }).addTo(WP_AUTO_LAYER);
  });

  $("nProject").value = String(pid);
  loadWaypoints();
  toast("✓ " + rows.length + " waypoint oluşturuldu (P" + first + "–P" + (next - 1) + ")", "ok", "📍");
  clearCellSelection();
}
