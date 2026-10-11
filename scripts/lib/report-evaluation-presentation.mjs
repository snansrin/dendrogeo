import {grpTr} from './report-species-presentation.mjs';

export function createReportEvaluationPresentation({esc, trNum}) {
  return function renderEvaluation({snap, L, t, ciTxt}) {
  /* ---- Değerlendirme: yalnız veriden türeyen betimleme ---- */
  const clsPct = (k) => { const c = ((L && L.classes) || []).find((x) => x.key === k); return c ? c.pct : null; };
  const distParts = [];
  for (const [k, label] of [['green', 'yeşil alan'], ['hard', 'sert yüzey'], ['building','bina'], ['water', 'su'], ['pool','havuz / süs havuzu'], ['bare', 'açık/çıplak alan'], ['other', 'diğer']]) {
    const v = clsPct(k); if (v != null && v > 0) distParts.push(`${label} %${trNum(v, 1)}`);
  }
  const dominant = (((L && L.classes) || []).slice().sort((a, b) => b.pct - a.pct))[0] || null;
  const grpTot = {};
  for (const s of snap.species) grpTot[s.grp] = (grpTot[s.grp] || 0) + s.carbon_kg;
  const grpShares = Object.entries(grpTot).map(([g, c]) => `${grpTr(g)} türlerde %${trNum(100 * c / (t.carbon_kg || 1), 1)}`).join(', ');
  const evalParas = [
    distParts.length ? `<p>Arazi örtüsü sınıflandırmasına göre analiz alanının ${distParts.join('; ')} şeklinde dağıldığı belirlenmiştir${dominant ? `; baskın sınıf %${trNum(dominant.pct, 1)} pay ile ${esc(dominant.label)} sınıfıdır` : ''}.</p>` : '',
    `<p>Ölçüm kaydı bulunan ${t.n} ağacın toplam karbon stoku ${ciTxt} olarak hesaplanmış; stokun ${grpShares || 'tek grupta'} biriktiği görülmüştür. Ölçüm kaydı bulunan ağaçların karbon toplamının park alanına oranı ${t.per_ha_kg == null ? '—' : trNum(t.per_ha_kg / 1000, 3) + ' t/ha'} değerindedir; bu oran yalnız kayıt kapsamını tanımlar.</p>`,
    `<p>Örneklem ${t.n} ağaç ölçümüne dayanmaktadır; sonuçlar ölçümü yapılan ağaçların toplamını verir ve parkın ölçülmeyen bölümlerine ekstrapole edilmemelidir.</p>`,
    `<p class="qnote">Yüzey sınıfı oranları ile ağaçların karbon stoku arasındaki nedensel ilişki bu veri kapsamıyla test edilmemiştir.</p>`,
  ].join('');

    return evalParas;
  };
}
