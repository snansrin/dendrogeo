import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawReportMapFooter,reportMapFooterLayout } from '../scripts/lib/report-map-footer.mjs';

function createCanvas() {
  return { lines: [], texts: [],
    line(...args) { this.lines.push(args); },
    text(...args) { this.texts.push(args); }
  };
}

test('report map footer preserves document ID, brand, source, projection, and date', () => {
  const canvas = createCanvas();
  const tones = { ink: [24, 36, 32], mut: [104, 118, 110] };
  const frameTone = [206, 210, 206];
  drawReportMapFooter({
    canvas, width: 500, height: 300, padding: 26, footerHeight: 70,
    frameTone, tones, dataset: 'ESA WORLDCOVER 2021 V200',
    meta: {
      id: 'DGR-123', source: 'WorldCover 2021', resolution: '10 M',
      epsg: '4326', dateStr: '12.10.2026', engine: '3.4'
    }
  });

  assert.deepEqual(canvas.lines, [[26, 234, 474, 234, frameTone]]);
  assert.deepEqual(canvas.texts.map(([x, y, value]) => [x, y, value]), [
    [26, 242, 'DENDROGEO - DGR-123'],
    [306, 242, 'DENDROGEO 2026'],
    [26, 262, 'VERI: WorldCover 2021 / COZUNURLUK: 10 M / PROJEKSIYON: EPSG:4326'],
    [26, 282, 'ANALIZ TARIHI: 12.10.2026 / DENDROGEO LC ENGINE V3.4 / CC BY-NC 4.0']
  ]);
  assert.deepEqual(canvas.texts.map(([, , , color, size]) => [color, size]), [
    [tones.ink, 2], [tones.mut, 2], [tones.mut, 1], [tones.mut, 1]
  ]);
});

test('report map footer uses defaults and omits analysis detail when metadata is absent', () => {
  const canvas = createCanvas();
  const tones = { ink: [24, 36, 32], mut: [104, 118, 110] };
  drawReportMapFooter({
    canvas, width: 220, height: 180, padding: 26, footerHeight: 70,
    frameTone: [206, 210, 206], tones, dataset: 'ESA WORLDCOVER 2021 V200'
  });

  assert.deepEqual(canvas.texts.map(([x, y, value]) => [x, y, value]), [
    [26, 122, 'DENDROGEO - BILIMSEL ANALIZ'],
    [26, 132, 'HARITASI'],
    [26, 142, 'VERI: ESA WORLDCOVER 2021'],
    [26, 152, 'V200 / COZUNURLUK: 10 M']
  ]);
  assert.deepEqual(canvas.texts.map(([, , , , size]) => size), [1, 1, 1, 1]);
});

test('long accepted-analysis metadata wraps without losing projection or crossing the footer',()=>{
 for(const width of [220,420,526,1000]){
  const layout=reportMapFooterLayout({width,padding:26,dataset:'ESA WORLDCOVER',meta:{id:'DGR-2026-0026',source:'UYDU / OSM / KULLANICI KARARI',resolution:'UYDU 10/20 M; VEKTOR SINIR',epsg:32636,dateStr:'14.10.2026'}});
  assert.match(layout.rows.map(r=>r.text).join(' '),/PROJEKSIYON: EPSG:32636/);
  for(const row of layout.rows){
   assert.ok(row.text.length*6*row.scale<=width-52,'text fits horizontally');
   assert.ok(12+row.y+7*row.scale<layout.height,'text fits vertically');
  }
 }
});
