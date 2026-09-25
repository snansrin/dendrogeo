/* compliance.test.mjs — HUKUKİ/LİSANS UYUM KİLİTLERİ (2026-09-24)
 *
 * Bu dosya "çalışan kod"u değil, **yasal zorunlulukları** kilitler. Sebep:
 * bu maddelerin hiçbiri bozulduğunda test patlamaz, sayfa çökmez, CI yeşil
 * kalır — sorun ancak bir lisans sahibi/KVKK başvurusu/Google doğrulaması
 * geldiğinde ortaya çıkar. Yani tam olarak sessizce çürüyen hata sınıfı.
 *
 * Kapsanan dört risk:
 *   1) HARİTA ATFI — OSM verisi ODbL 1.0: "© OpenStreetMap contributors"
 *      atfı GÖRÜNÜR olmalı. OpenTopoMap CC-BY-SA (OSM atfı da gerekir),
 *      Esri World Imagery kendi kaynak zincirini ister. Eskiden 4 haritanın
 *      hiçbirinde atıf yoktu, yalnız altlık değiştirilince eksik metinle
 *      basılıyordu → lisans ihlali.
 *   2) KVKK AÇIK RIZA — kayıt formunda onay kutusu + aydınlatma bağlantısı;
 *      rıza olmadan hesap açılamaz; rıza zaman damgası auth metadata'sına
 *      yazılır (sonradan inkâr edilemez kayıt).
 *   3) LİSANS TUTARLILIĞI — LICENSE, NOTICE, package.json, README, kullanım
 *      koşulları ve JSON-LD aynı lisansı söylemeli (CC BY-NC 4.0). Eskiden
 *      LICENSE=MIT iken rozet/DOI=CC BY-NC idi → çelişki.
 *   4) BULUNABİLİRLİK/ŞEFFAFLIK — yasal sayfalar yayında ve bağlı, JSON-LD'de
 *      Dataset (DOI) + kaynak atıfları (isBasedOn) + privacyPolicy var.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const idx = rd('index.html');
const constants = rd('src/config/constants.js');
const mapjs = rd('src/services/map.js');
const landingjs = rd('src/ui/landing.js');
const parkExport = rd('src/ui/park-export.js');
const auth = rd('src/services/auth.js');

/* =========================================================
   1) HARİTA ATFI (ODbL / CC-BY-SA / Esri)
========================================================= */
describe('harita atfı — OSM ODbL ve diğer altlık lisansları', () => {
  test('⭐ tek kaynak: DG_ATTR sabiti üç altlığı da tam metinle tanımlıyor', () => {
    assert.match(constants, /const DG_ATTR=\{/);
    assert.match(constants, /OpenStreetMap<\/a> contributors/, 'OSM atfı "contributors" içermeli');
    assert.match(constants, /Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics/, 'Esri kaynak zinciri eksik');
    assert.match(constants, /OpenTopoMap<\/a> \(CC-BY-SA\)/);
    assert.match(constants, /DG_ATTR_TEXT=\{/, 'canvas/PNG için düz metin sürümü');
  });

  test('⭐ src/** altındaki HİÇBİR tileLayer attribution’sız değil', () => {
    const dosyalar = [];
    const yuru = (d) => {
      for (const a of readdirSync(d)) {
        if (a === 'node_modules' || a.startsWith('.')) continue;
        const t = join(d, a);
        if (statSync(t).isDirectory()) yuru(t);
        else if (a.endsWith('.js')) dosyalar.push(t);
      }
    };
    yuru(join(ROOT, 'src'));
    /* Yürüyücünün gerçekten dosya bulduğunu doğrula: boş tarama sahte yeşildir
     * (bu test ilk sürümünde tam olarak o hataya düştü). */
    assert.ok(dosyalar.length >= 30, 'yürüyücü dosya bulamadı: ' + dosyalar.length);
    const bos = [];
    let toplam = 0;
    for (const f of dosyalar) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/L\.tileLayer\(([\s\S]*?)\)\.addTo/g)) {
        toplam++;
        if (!/attribution/.test(m[1])) bos.push(f.split('/src/')[1] + ' → ' + m[1].slice(0, 60));
      }
    }
    assert.ok(toplam >= 4, 'tileLayer çağrıları bulunamadı: ' + toplam);
    assert.deepEqual(bos, [], 'atıfsız karo katmanı: ' + bos.join(' | '));
  });

  test('ilk yüklenen 4 harita atıfla kuruluyor (canlı/navigasyon/dünya/landing)', () => {
    assert.equal((mapjs.match(/attribution:DG_ATTR\.osm/g) || []).length, 3, 'canlı + navigasyon + dünya');
    assert.match(landingjs, /attribution:DG_ATTR\.osm/);
  });

  test('altlık değiştirme artık DG_ATTR’den besleniyor (kopya metin yok)', () => {
    assert.match(mapjs, /const attr=DG_ATTR;/);
    assert.ok(!/'© OpenStreetMap',/.test(mapjs), 'eksik eski atıf metni kalmamalı');
  });

  test('⭐ PNG çıktısında telif satırı var (ODbL türev eser şartı)', () => {
    assert.match(parkExport, /DG_ATTR_TEXT\.osm/);
    assert.match(parkExport, /CC BY-NC 4\.0/);
    assert.match(parkExport, /dendrogeo\.org/);
  });
});

/* =========================================================
   2) KVKK — AÇIK RIZA + AYDINLATMA
========================================================= */
describe('KVKK: açık rıza ve aydınlatma', () => {
  test('⭐ kayıt formunda rıza kutusu + aydınlatma/gizlilik bağlantısı var', () => {
    assert.match(idx, /id="rgConsent"/);
    assert.match(idx, /class="dg-consent"/);
    assert.match(idx, /href="\/aydinlatma\/"[^>]*target="_blank"/, 'aydınlatma metni yeni sekmede açılmalı (form verisi kaybolmasın)');
    assert.match(idx, /href="\/gizlilik\/"/);
    assert.match(idx, /yurt dışı altyapısında barındırılmasını/, 'yurt dışı aktarım açıkça belirtilmeli (KVKK m.9)');
  });

  test('rıza yoksa kayıt ENGELLENİYOR', () => {
    const fn = auth.slice(auth.indexOf('async function doRegister'), auth.indexOf('async function sendResetEmail') > -1 ? auth.indexOf('async function sendResetEmail') : auth.length);
    assert.match(fn, /consentEl&&!consentEl\.checked/, 'onay kontrolü yok');
    assert.match(fn, /kvkk_consent:true/, 'rıza metadata’ya yazılmalı');
    assert.match(fn, /kvkk_consent_at:new Date\(\)\.toISOString\(\)/, 'zaman damgası şart (inkâr edilemez kayıt)');
    assert.match(fn, /kvkk_consent_version/, 'hangi metin sürümü onaylandı');
  });

  test('aydınlatma metni KVKK m.10 unsurlarını içeriyor', () => {
    const p = 'aydinlatma/index.html';
    assert.ok(existsSync(join(ROOT, p)), 'sayfa yok');
    const t = rd(p);
    assert.match(t, /Nagihan ŞİRİN &amp; Sinan ŞİRİN/, 'veri sorumlusu KİMLİĞİ yazılmalı');
    assert.match(t, /sinan@dendrogeo\.org/);
    assert.match(t, /m\.5\/2-a/, 'hukuki sebep');
    assert.match(t, /meşru menfaat/);
    assert.match(t, /yurt dışına aktarım/i);
    assert.match(t, /30 gün/, 'başvuru cevap süresi (m.13)');
    assert.match(t, /m\.11/, 'haklar');
    assert.match(t, /silinmesini veya yok edilmesini/);
    assert.match(t, /Otomatik karar|profilleme/i);
    assert.match(t, /13 yaş/, 'çocuklar');
  });

  test('gizlilik politikası veri sorumlusunu isimlendiriyor ve aydınlatmaya bağlı', () => {
    const t = rd('gizlilik/index.html');
    assert.match(t, /Nagihan ŞİRİN &amp; Sinan ŞİRİN/);
    assert.match(t, /href="\.\.\/aydinlatma\/"/);
    assert.match(t, /href="\.\.\/kunye\/"/);
  });

  test('künye sayfası: sorumlu, atıf, içerik kaldırma süreci, erişilebilirlik', () => {
    const t = rd('kunye/index.html');
    assert.match(t, /Nagihan ŞİRİN &amp; Sinan ŞİRİN/);
    assert.match(t, /10\.5281\/zenodo\.22948643/);
    assert.match(t, /İçerik bildirimi ve kaldırma talebi/);
    assert.match(t, /7 gün/, 'bildirim değerlendirme süresi');
    assert.match(t, /Erişilebilirlik beyanı/);
    assert.match(t, /prefers-reduced-motion/);
    assert.match(t, /SECURITY\.md/);
    assert.match(t, /5651/);
  });

  test('yasal sayfalar sitemap + robots + footer bağlantılarıyla erişilebilir', () => {
    const sm = rd('sitemap.xml'), rb = rd('robots.txt');
    for (const s of ['/gizlilik/', '/kullanim-kosullari/', '/aydinlatma/', '/kunye/']) {
      assert.ok(sm.includes(s), 'sitemap: ' + s);
      assert.ok(rb.includes(s), 'robots: ' + s);
      assert.ok(idx.includes('href="' + s + '"'), 'landing footer: ' + s);
    }
  });
});

/* =========================================================
   3) LİSANS TUTARLILIĞI
========================================================= */
describe('lisans tutarlılığı (CC BY-NC 4.0)', () => {
  test('⭐ LICENSE artık CC BY-NC 4.0 (MIT değil)', () => {
    const t = rd('LICENSE');
    assert.match(t, /Attribution-NonCommercial 4\.0 International/);
    assert.ok(!/MIT License/.test(t), 'MIT metni kalmamalı — çelişki yaratır');
    assert.ok(t.length > 10000, 'tam lisans metni olmalı, kısaltma değil');
  });

  test('NOTICE: telif sahipleri + atıf biçimi + üçüncü taraf lisansları', () => {
    const t = rd('NOTICE');
    assert.match(t, /Nagihan ŞİRİN & Sinan ŞİRİN/);
    assert.match(t, /CC BY-NC 4\.0/);
    assert.match(t, /10\.5281\/zenodo\.22948643/);
    assert.match(t, /OpenStreetMap verisi\s+ODbL/, 'ODbL atfı NOTICE’ta');
    assert.match(t, /Leaflet/, 'üçüncü taraf bileşenler kendi lisansıyla ayrışmalı');
  });

  test('package.json lisans alanı tutarlı', () => {
    const pkg = JSON.parse(rd('package.json'));
    assert.equal(pkg.license, 'CC-BY-NC-4.0');
  });

  test('README, kullanım koşulları ve JSON-LD aynı lisansı söylüyor', () => {
    assert.match(rd('README.md'), /CC BY-NC 4\.0/);
    assert.match(rd('kullanim-kosullari/index.html'), /CC BY-NC 4\.0/);
    assert.match(rd('kullanim-kosullari/index.html'), /LICENSE/, 'kullanıcı LICENSE dosyasına yönlendirilmeli');
    const head = rd('partials/head.html');
    assert.match(head, /"license": "https:\/\/creativecommons\.org\/licenses\/by-nc\/4\.0\/"/);
    assert.ok(!/MIT/.test(rd('kullanim-kosullari/index.html')), 'eski MIT ifadesi kalmamalı');
  });
});

/* =========================================================
   4) YAPILANDIRILMIŞ VERİ (bulunabilirlik + şeffaflık)
========================================================= */
describe('JSON-LD: Dataset, atıf ve yasal belge bağlantıları', () => {
  const m = idx.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'JSON-LD yok');
  const ld = JSON.parse(m[1]);
  const nodes = ld['@graph'];
  const ds = nodes.find((n) => n['@type'] === 'Dataset');
  const app = nodes.find((n) => n['@type'] === 'WebApplication');

  test('tek Dataset düğümü var (çift kayıt Google’ı yanıltır)', () => {
    assert.equal(nodes.filter((n) => n['@type'] === 'Dataset').length, 1);
  });

  test('⭐ Dataset DOI + lisans + gerçek kişi yaratıcılar', () => {
    assert.equal(ds.identifier, 'https://doi.org/10.5281/zenodo.22948643');
    assert.match(ds.license, /by-nc\/4\.0/);
    assert.ok(Array.isArray(ds.creator) && ds.creator.length === 2, 'creator kişi listesi olmalı');
    assert.equal(ds.creator[0]['@type'], 'Person');
  });

  test('⭐ kaynak atıfları yapılandırılmış veride de duruyor (isBasedOn)', () => {
    const names = ds.isBasedOn.map((x) => x.name).join(' ');
    assert.match(names, /OpenStreetMap/);
    assert.match(names, /ESA WorldCover/);
    assert.match(ds.isBasedOn[0].license, /opendatacommons\.org\/licenses\/odbl/);
  });

  test('variableMeasured park kimliğini de kapsıyor', () => {
    const names = ds.variableMeasured.map((v) => v.name).join(' | ');
    assert.match(names, /Park identity/);
    assert.match(names, /GPS accuracy/);
  });

  test('uygulama düğümünde sameAs + yasal belge bağlantıları', () => {
    assert.ok(app.sameAs.includes('https://github.com/snansrin/dendrogeo'));
    assert.ok(app.sameAs.some((x) => x.includes('10.5281/zenodo')));
    assert.equal(app.privacyPolicy, 'https://dendrogeo.org/gizlilik/');
    assert.equal(app.termsOfService, 'https://dendrogeo.org/kullanim-kosullari/');
    assert.match(app.copyrightHolder.name, /Nagihan ŞİRİN & Sinan ŞİRİN/);
  });
});

/* =========================================================
   5) KİŞİSEL VERİ SIZINTISI (kullanıcı isteği 2026-09-24:
      "her yere kişisel mailimi yazmışsın … gerçek mailimi verme")
========================================================= */
describe('depoda kişisel e-posta sızıntısı yok', () => {
  /* Desen runtime'da kuruluyor: bu test dosyasının KENDİSİ eşleşmesin. */
  const KISISEL = new RegExp('@' + ['gmail', 'hotmail', 'outlook', 'yahoo', 'icloud', 'yandex'].join('|@') + '\\.', 'i');
  const ATLANACAK = /\.(png|jpe?g|gif|ico|svg|woff2?|ttf|eot|map|patch)$/i;

  test('⭐ izlenen hiçbir metin dosyasında kişisel e-posta yok', () => {
    const dosyalar = [];
    const yuru = (d) => {
      for (const a of readdirSync(d)) {
        if (a === '.git' || a === 'node_modules' || a.startsWith('.')) continue;
        const t = join(d, a);
        if (statSync(t).isDirectory()) yuru(t);
        else if (!ATLANACAK.test(a)) dosyalar.push(t);
      }
    };
    yuru(ROOT);
    assert.ok(dosyalar.length > 40, 'tarama dosya bulamadı: ' + dosyalar.length);
    const sizen = [];
    for (const f of dosyalar) {
      let t; try { t = readFileSync(f, 'utf8'); } catch (e) { continue; }
      if (KISISEL.test(t)) sizen.push(f.slice(ROOT.length + 1));
    }
    assert.deepEqual(sizen, [], 'kişisel e-posta içeren dosyalar: ' + sizen.join(', '));
  });

  test('⭐ iletişim adresi alan adı üzerinden (sinan@dendrogeo.org)', () => {
    for (const f of ['kunye/index.html', 'gizlilik/index.html', 'aydinlatma/index.html', 'kullanim-kosullari/index.html', 'NOTICE']) {
      assert.match(rd(f), /sinan@dendrogeo\.org/, f + ' alan adı adresi kullanmalı');
    }
  });

  test('⭐ migration kurucu ataması gerçek e-posta İÇERMİYOR (depo herkese açık)', () => {
    const m = rd('supabase/migrations/0001_init_v2_1.sql');
    assert.ok(!/role='owner'.*where email='[^']*@[^']*'/s.test(m.replace(/^--.*$/gm, '')),
      'çalışan SQL içinde gerçek e-posta olmamalı');
    assert.match(m, /KENDI_HESAP_EPOSTANIZ/, 'kurulum talimatı placeholder ile verilmeli');
    assert.match(m, /HERKESE AÇIK bir depoda/, 'gerekçe belgelenmeli');
  });

  test('güvenlik bildirimi ayrı adreste (security@dendrogeo.org)', () => {
    assert.match(rd('SECURITY.md'), /security@dendrogeo\.org/);
  });
});
