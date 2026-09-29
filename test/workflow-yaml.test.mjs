// 0029 · WORKFLOW YAML BEKÇİSİ
//
// Canlı kanıt (29.09 gece): 0028 yaması iki adım adını tırnaksız yazdı —
//   - name: Kalp atışını başlat (0017 · 0028: workflow_dispatch)
// YAML'da tırnaksız (plain) skaler ": " (iki nokta + boşluk) İÇEREMEZ; değer
// "…(0017 · 0028" + harita girdisi "workflow_dispatch)" diye bölünür →
// "bad indentation of a mapping entry". Sonuç: ci.yml ve rapor-yayin.yml
// GitHub'da HİÇ çözümlenemedi; push koşuları jobsız "startup failure" öldü,
// kalp'in rapor-yayin dispatch'i 422 aldı (zincir durdu), Göksu yayını
// kuyrukta 1 saatten fazla bekledi. Kullanıcı tecrübesi: "yine bozdun".
//
// Bu test aynı sınıf hatayı PUSH'TAN ÖNCE yakalar. Bağımlılık YOKTUR
// (js-yaml devDependency değil; npm ci ağacında bulunmayabilir) — bu yüzden
// tam YAML parse yerine hedefli yapısal denetim yapar:
//   1) name/description/title değerlerinde tırnaksız ": " veya satır sonu ":"
//   2) TAB karakteri (YAML'da girintide yasak)
//   3) 'on:' bloğu var mı (tetiksiz workflow GitHub'da kaydolmaz)
// Blok skalerler (run: | vb.) ve yorumlar taranmaz — oralardaki ": " serbest.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const WF_DIR = path.join(process.cwd(), ".github", "workflows");

function files() {
  return fs.readdirSync(WF_DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).sort();
}

// Blok-skaler farkındalıklı satır tarayıcı: `key: |` / `key: >` gördüğünde,
// anahtar girintisinden DERİN (veya boş) satırlar blok içeriğidir, atlanır.
function scan(src) {
  const lines = src.split(/\r?\n/);
  const bad = [];
  let blockIndent = -1;
  let hasOn = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (blockIndent >= 0) {
      const t = raw.trim();
      if (t === "" || raw.search(/\S/) > blockIndent) continue; // blok içi
      blockIndent = -1;
    }
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (/^on\s*:\s*$/.test(trimmed)) hasOn = true;
    if (raw.includes("\t")) bad.push({ line: i + 1, why: "TAB karakteri (YAML girintide yasak)", text: raw });
    const m = raw.match(/^(\s*)(?:- )?([A-Za-z_][\w-]*):(\s*)(.*)$/);
    if (!m) continue;
    const indent = m[1].length + (raw.slice(m[1].length).startsWith("- ") ? 2 : 0);
    const key = m[2];
    const val = m[4].trim();
    if (/^[|>][-+]?\s*(#.*)?$/.test(val)) { blockIndent = indent; continue; }
    if (key === "name" || key === "description" || key === "title") {
      if (!val) continue;
      const quoted = /^["']/.test(val);
      if (quoted) continue;
      if (/:\s/.test(val) || /:$/.test(val)) {
        bad.push({ line: i + 1, why: `${key}: tırnaksız değerde ": " → YAML mapping hatası (değeri tırnağa al)`, text: raw });
      }
    }
  }
  return { bad, hasOn };
}

test("workflow dosyaları .github/workflows altında ve boş değil", () => {
  const list = files();
  assert.ok(list.length >= 5, `beklenen ≥5 workflow, bulunan ${list.length}`);
  for (const f of list) {
    assert.ok(f.endsWith(".yml") || f.endsWith(".yaml"), f);
    assert.ok(fs.statSync(path.join(WF_DIR, f)).size > 100, `${f} şüpheli derecede küçük`);
  }
});

test("0028 dersi: adım adlarında tırnaksız ': ' YOK (startup failure sınıfı)", () => {
  const fails = [];
  for (const f of files()) {
    const src = fs.readFileSync(path.join(WF_DIR, f), "utf8");
    const { bad } = scan(src);
    for (const b of bad) fails.push(`${f}:${b.line} ${b.why}\n    ${b.text.trim()}`);
  }
  assert.deepEqual(fails, [], "YAML kıran ad/açıklama değerleri:\n" + fails.join("\n"));
});

test("her workflow'da 'on:' tetik bloğu var", () => {
  const fails = [];
  for (const f of files()) {
    const { hasOn } = scan(fs.readFileSync(path.join(WF_DIR, f), "utf8"));
    if (!hasOn) fails.push(f);
  }
  assert.deepEqual(fails, [], "tetiksiz workflow: " + fails.join(", "));
});

test("regresyon kanıtı: 0028'deki bozuk satır bu bekçiyi DÜŞÜRÜRDÜ", () => {
  const bozuk = [
    "name: test",
    "on: { workflow_dispatch: {} }",
    "jobs:",
    "  j:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - name: Kalp atışını başlat (0017 · 0028: workflow_dispatch)",
    "        run: |",
    "          echo 'içeride: serbest — blok skaler taranmaz'",
    "          curl -sf -d '{\"ref\":\"main\"}' x",
    "      - name: \"Tırnaklı ad (0028: workflow_dispatch) sorun değil\"",
    "        run: echo ok",
  ].join("\n");
  const { bad } = scan(bozuk);
  assert.equal(bad.length, 1, "tam bir ihlal bekleniyor: " + JSON.stringify(bad));
  assert.equal(bad[0].line, 7);
  assert.match(bad[0].why, /tırnaksız/);
});
