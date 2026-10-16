"use strict";

window.DG_SAVE_ACADEMIC_PROFILE = (() => {
  async function execute(event, ports) {
    event.preventDefault();
    const form = event.target?.matches?.('[data-academic-profile-form]') ? event.target : event.currentTarget;
    const status = ports.getStatus();
    const button = form.querySelector('button[type=submit]');
    if (!ports.isAuthenticated() || button.disabled) return;
    const value = ports.clean({...ports.defaults?.(),...Object.fromEntries(ports.formData(form))});
    if (!ports.orcidValid(value.orcid)) {
      status.textContent = 'ORCID kimliğini kontrol edin.';
      return;
    }
    button.disabled = true;
    form.setAttribute?.('aria-busy','true');
    const cancel=form.querySelector('[data-academic-profile-action="cancel"]');if(cancel&&cancel!==button)cancel.disabled=true;
    status.textContent = 'Kaydediliyor…';
    try {
      const { data, error } = await ports.update(value);
      if (error) throw error;
      if (!data?.user) throw Error('Hesap yanıtı alınamadı.');
      ports.acceptUser(data.user);
      ports.render();
      const saved=ports.savedStatus();saved.textContent = 'Profil hesabınıza kaydedildi.';
      saved.focus?.({preventScroll:true});
      ports.toast('Profiliniz hesabınıza kaydedildi.', 'ok', '👤');
    } catch (error) {
      status.textContent = 'Kaydedilemedi: ' + String(error.message || error);
      ports.toast('Profil kaydedilemedi. Girdiğiniz bilgiler formda korunuyor.', 'err', '👤');
    } finally {
      form.removeAttribute?.('aria-busy');if(cancel&&cancel!==button)cancel.disabled=false;
      button.disabled = false;
    }
  }

  return Object.freeze({ execute });
})();
