/* restore-ci.test.mjs — 0013 iade SQL'i + CI kuyruk tetiği + panel çevre ipucu
 * Sözleşmeler: iade idempotent ve kanıt koruyucu; kuyruk her main push'unda
 * boşaltılır (schedule'a bağımlılık bitti); panel ham çevreyi gizlemez. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

describe('0013 · iade SQL sözleşmesi', () => {
  const sql = read('supabase/migrations/0013_restore_measurements.sql');
  test('yedekten birebir iade + idempotent koruma', () => {
    assert.match(sql, /from public\.measurements_bak_0011 b/, 'yedek tablodan okur');
    assert.match(sql, /abs\(m\.dbh_cm - round\(\(m\.girth_cm \/ pi\(\)\)::numeric, 2\)::double precision\) < 0\.005/, 'yalnız dönüştürülmüş satırlar döner');
    assert.match(sql, /^begin;/m);
    assert.match(sql, /^commit;/m);
  });
  test('P7 ondalık onarımı kapsamı dar (çap/boy değişmez)', () => {
    assert.match(sql, /point_id = 7/);
    assert.match(sql, /dbh_cm = 107/, 'yalnız özgün çap korunurken');
    assert.match(sql, /carbon_kg between 150 and 250/, 'yalnız kaymış değer');
  });
  test('kanıt korunur: girth_cm silinmez, park geometrisine dokunulmaz', () => {
    assert.ok(!/girth_cm\s*=\s*null/i.test(sql), 'girth_cm kanıtı silinemez');
    assert.ok(!/update public\.parks/i.test(sql), 'parks tablosuna dokunamaz');
  });
});

describe('0013 · CI kuyruk tetiği (schedule bağımlılığı bitti)', () => {
  const ci = read('.github/workflows/ci.yml');
  test('kuyruk isi her main pushunda dogrula ile paralel kosar', () => {
    assert.match(ci, /kuyruk:/, 'ayrı iş (paralellik)');
    assert.match(ci, /github\.event_name == 'push'/);
    assert.match(ci, /refs\/heads\/main/);
  });
  test('rapor-yayin ile aynı concurrency grubu → çift koşu çakışmaz', () => {
    assert.match(ci, /group: rapor-yayin-kuyrugu/);
    assert.match(ci, /cancel-in-progress: false/, 'başlayan iş kesilmez (rapor yarım kalmaz)');
  });
  test('üretim zinciri tam: npm ci → publish-queue → commit + push (3 deneme)', () => {
    assert.match(ci, /npm ci/);
    assert.match(ci, /node scripts\/publish-queue\.mjs/);
    assert.match(ci, /git pull --rebase origin main && git push/);
    assert.match(ci, /for i in 1 2 3/);
  });
  test('rapor-yayin.yml (schedule + dispatch) yedek olarak duruyor', () => {
    const y = read('.github/workflows/rapor-yayin.yml');
    assert.match(y, /cron: '\*\/5 \* \* \* \*'/);
    assert.match(y, /workflow_dispatch/);
  });
});

describe('0013 · panel çevre ipucu (şeffaflık)', () => {
  const ui = read('src/services/admin-tree.js');
  test('girth_cm select listesinde', () => {
    assert.match(ui, /DG_TREE_SEL_FULL=\s*\n\s*"id,point_id,measurement_no,species,grp,dbh_cm,girth_cm,height_m,carbon_kg,"/);
  });
  test('Çap hücresi ham çevreyi alt satırda gösterir (farklıysa)', () => {
    assert.match(ui, /çevre: \$\{esc\(r\.girth_cm\)\} cm/);
    assert.match(ui, /Number\(r\.girth_cm\)!==Number\(r\.dbh_cm\)/, 'yalnız dönüşüm izi varsa');
  });
});
