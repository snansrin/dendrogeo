export function createReportQaPresentation({qaStateOf, QA_STATE}) {
  const qaStates = [];
  const row = (k, ok, det) => {
    const txt = ok === true ? '✓ Geçerli' : ok === false ? '⚠ Kontrol edilemedi' : ok;
    const s = String(txt);
    const isInfo = s.startsWith('ℹ');
    const cls = ok === true ? 'qok qst' : s.startsWith('⛔') ? 'qbad qst' : isInfo ? 'qinfo qst'
      : (ok === false || s.startsWith('⚠')) ? 'qwarn qst' : 'qst';
    qaStates.push(s.startsWith('⛔') ? 'block' : isInfo ? 'info' : (ok === true ? 'ok' : 'review'));
    return `<tr><td class="tr">${k}</td><td class="${cls}">${txt}</td><td class="qd">${det}</td></tr>`;
  };
  function summary() {
  const QA_ST = qaStateOf({ block: qaStates.includes('block'), review: qaStates.includes('review') });
  const QA_ST_LABEL = { [QA_STATE.BLOCKED]: '🔴 BLOKLU', [QA_STATE.REVIEW]: '🟡 İNCELEME', [QA_STATE.VALID]: '🟢 GEÇERLİ' }[QA_ST];
  const QA_ST_CLASS = { [QA_STATE.BLOCKED]: 'st st-bad', [QA_STATE.REVIEW]: 'st st-warn', [QA_STATE.VALID]: 'st st-ok' }[QA_ST];
  const QA_BLOCKED = QA_ST === QA_STATE.BLOCKED;
  const QA_REVIEW = QA_ST === QA_STATE.REVIEW;
    return {QA_ST, QA_ST_LABEL, QA_ST_CLASS, QA_BLOCKED, QA_REVIEW, qaStates:[...qaStates]};
  }
  return {row, summary};
}
