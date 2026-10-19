"use strict";
(() => {
  const button = document.getElementById('runProbe');
  const status = document.getElementById('probeStatus');
  const result = document.getElementById('probeResult');
  function report(message, state) {
    status.textContent = message;
    status.dataset.state = state;
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    result.hidden = true;
    report('Oturum denetleniyor…', 'pending');
    try {
      const {data, error} = await sb.auth.getSession();
      if (error || !data?.session) {
        report('DendroGeo oturumu bulunamadı. Önce ana sayfada oturum açın, sonra bu sayfaya dönün.', 'error');
        button.disabled = false;
        return;
      }
      report('Özel depolama bağlantısı denetleniyor…', 'pending');
      const response = await sb.functions.invoke('oracle-storage-probe', {body: {}});
      if (response.error || response.data?.verified !== true) {
        const statusCode = response.error?.context?.status;
        const message = statusCode === 503
          ? 'Deneme işlevi kapalı veya yapılandırılmamış. Güvenlik gereği istek sonlandırıldı.'
          : statusCode === 401 || statusCode === 403
            ? 'Oturum bu deneme için yetkili değil. Hiçbir depolama işlemi doğrulanmadı.'
            : 'Bağlantı doğrulanamadı. Ayrıntılar güvenlik nedeniyle gizlendi; üretim verileri etkilenmedi.';
        report(message, 'error');
        button.disabled = false;
        return;
      }
      report('Bağlantı doğrulandı. Sentetik metin yazıldı ve aynı içerik geri okunarak eşleşti.', 'success');
      result.textContent = `${response.data.bucket} · ${response.data.region} · ${response.data.bytes} bayt · yazma/okuma doğrulandı`;
      result.hidden = false;
    } catch {
      report('Bağlantı doğrulanamadı. Ayrıntılar gizlendi; üretim verileri etkilenmedi.', 'error');
      button.disabled = false;
    }
  });
})();
