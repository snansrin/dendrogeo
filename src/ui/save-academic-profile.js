"use strict";

window.DG_SAVE_ACADEMIC_PROFILE = (() => {
  async function execute(event, ports) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = ports.getStatus();
    const button = form.querySelector('button[type=submit]');
    if (!ports.isAuthenticated() || button.disabled) return;
    const value = ports.clean(Object.fromEntries(ports.formData(form)));
    if (!ports.orcidValid(value.orcid)) {
      status.textContent = 'ORCID kimliğini kontrol edin.';
      return;
    }
    button.disabled = true;
    status.textContent = 'Kaydediliyor…';
    try {
      const { data, error } = await ports.update(value);
      if (error) throw error;
      if (!data?.user) throw Error('Hesap yanıtı alınamadı.');
      ports.acceptUser(data.user);
      ports.render();
      ports.savedStatus().textContent = 'Profil hesabınıza kaydedildi.';
      ports.toast('Akademik profiliniz hesabınıza kaydedildi.', 'ok', '👤');
    } catch (error) {
      status.textContent = 'Kaydedilemedi: ' + String(error.message || error);
      ports.toast('Profil kaydedilemedi. Girdiğiniz bilgiler formda korunuyor.', 'err', '👤');
    } finally {
      button.disabled = false;
    }
  }

  return Object.freeze({ execute });
})();
