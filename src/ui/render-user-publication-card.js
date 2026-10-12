"use strict";

window.DG_RENDER_USER_PUBLICATION_CARD = (() => {
  function schemaWarning(close) {
    return '<div class="shead" style="margin-bottom:10px"><span class="no">📄</span><h2 style="font-size:1.15rem">Park Raporu</h2><span class="rule"></span>' + close + "</div>"
      + '<div class="alert warn">⚠ <b>Yayın kuyruğu veritabanında kurulu değil.</b> Yönetici Supabase → SQL Editor\'da '
      + '<span class="mono">0008_report_publish.sql</span> ve <span class="mono">0009_user_report_publish.sql</span> dosyalarını çalıştırmalı.</div>';
  }

  function render(state, error, header, controls, notices, escape) {
    return (error ? '<div class="alert err">⚠ ' + escape(error) + "</div>" : "") + header + controls + notices;
  }

  return Object.freeze({ schemaWarning, render });
})();
