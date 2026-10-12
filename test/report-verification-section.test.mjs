import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderReportVerificationSection} from '../scripts/lib/report-verification-section.mjs';

const base={
  QA_ST_LABEL:'🟡 İNCELEME',QA_BLOCKED:false,QA_WHY:'GNSS doğruluğu kaydedilmedi',
  QA_REVIEW:true,AGAC_DEGER_TEMIZ:true,qaStates:['ok','review','info'],
  qaRows:'<tr><td>Kontrol</td></tr>',id:'DGR-2026-0001',verTxt:'1.0',hash:'abc123',
  snap:{
    generated_at:'2026-10-12T08:00:00.000Z',
    geofence:{verified_rows:2,total:3,outside_rows:1},
    moderation:{approved:3,reviewed:2},
  },
};

test('verification section keeps review, information, and integrity disclosures',()=>{
  const html=renderReportVerificationSection(base);
  assert.match(html,/^<h2><span class="no">7<\/span>Kalite Kontrol ve Doğrulama<\/h2>/);
  assert.match(html,/Bu raporun QA durumu: 🟡 İNCELEME/);
  assert.match(html,/Bu rapordaki inceleme kalemlerinin HİÇBİRİ ağaç ölçüm değerleriyle/);
  assert.match(html,/ℹ️ BEYAN/);
  assert.match(html,/<tbody><tr><td>Kontrol<\/td><\/tr><\/tbody>/);
  assert.match(html,/sha256:abc123/);
  assert.match(html,/yayın 2026-10-12/);
  assert.match(html,/2\/3 kayıt park poligonu içinde doğrulanmıştır; 1 kayıt poligon dışında/);
  assert.match(html,/zaman damgası \(reviewed_at\) 2\/3 kayıtta mevcuttur/);
  assert.match(html,/Kalıcı kimlik: DGR-2026-0001 \+ içerik hash'i/);
});

test('blocked status wording excludes review-only and informational text',()=>{
  const html=renderReportVerificationSection({
    ...base,QA_ST_LABEL:'🔴 BLOKLU',QA_BLOCKED:true,QA_WHY:'kritik ölçüm hatası',
    QA_REVIEW:false,AGAC_DEGER_TEMIZ:false,qaStates:['blocked'],
    snap:{...base.snap,geofence:{verified_rows:3,total:3,outside_rows:0},moderation:{approved:3,reviewed:3}},
  });
  assert.match(html,/kritik hata: kritik ölçüm hatası/);
  assert.match(html,/Karbon toplamı bu nedenle GEÇİCİDİR/);
  assert.doesNotMatch(html,/inceleme kalemleri:/);
  assert.doesNotMatch(html,/ℹ️ BEYAN/);
  assert.match(html,/✅ Konum çiti: 3\/3 kayıt park poligonu içinde/);
  assert.match(html,/✅ Moderasyon: 3\/3 kayıt onaylı ve zaman damgalıdır/);
});
