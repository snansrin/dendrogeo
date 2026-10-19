(function(root){
 'use strict';
 const sources={direct:'Doğrudan / kaynak bilinmiyor',search:'Arama motoru',ai:'Yapay zekâ asistanı',social:'Sosyal medya',telegram:'Telegram',referral:'Başka site',internal:'Site içi bağlantı'};
 const devices={phone:'Telefon',desktop:'Bilgisayar',tablet:'Tablet'};
 const pages={home:'Ana sayfa','home-en':'İngilizce ana sayfa',inventory:'Ağaç Envanteri',carbon:'Karbon Hesaplama',landcover:'Arazi Örtüsü',parks:'Kent Parkı Analizi',methods:'Bilimsel Yöntem','methods-en':'İngilizce yöntem',data:'Veri ve Dışa Aktarım',reports:'Bilimsel Raporlar (DGR)',about:'Proje Hakkında',privacy:'Gizlilik Politikası',notice:'KVKK Aydınlatma Metni',terms:'Kullanım Koşulları',contact:'Künye ve İletişim'};
 const count=value=>Number.isFinite(Number(value))&&Number(value)>=0?Math.floor(Number(value)):0;
 function render(element,data,{translate,locale='tr-TR'}){
  const T=translate,E=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),F=value=>count(value).toLocaleString(locale);
  const views=count(data?.totals?.page_views),entries=value=>Array.isArray(value)?value:[];
  function bars(rows,labels,countries=false){if(!rows.length)return'<p class="dg-meta">'+E(T('Bu aralıkta veri yok.'))+'</p>';return'<ul class="metric-bars">'+rows.slice(0,10).map(row=>{const total=count(row.total),percent=views?Math.min(100,total/views*100):0;let name=labels[row.key]||T('Bilinmiyor');if(countries&&/^[A-Z]{2}$/.test(row.key)&&row.key!=='ZZ'){try{name=new Intl.DisplayNames([locale],{type:'region'}).of(row.key)||T('Bilinmiyor');}catch{name=T('Bilinmiyor');}}return'<li><div class="metric-bar-label">'+(countries?'<span class="metric-country">'+E(row.key==='ZZ'?'—':row.key)+'</span>':'')+'<span>'+E(countries?name:T(name))+'</span><strong>'+F(total)+'</strong><small>'+E(percent.toLocaleString(locale,{maximumFractionDigits:1}))+'%</small></div><progress max="100" value="'+percent.toFixed(3)+'" aria-label="'+E(countries?name:T(name))+'"></progress></li>';}).join('')+'</ul>';}
  const deviceRows=entries(data?.devices).filter(row=>Object.hasOwn(devices,row.key)),deviceTotal=deviceRows.reduce((sum,row)=>sum+count(row.total),0);
  const phone=deviceRows.find(row=>row.key==='phone')?.total||0,desktop=deviceRows.find(row=>row.key==='desktop')?.total||0;
  const first=deviceTotal?count(phone)/deviceTotal*100:0,second=deviceTotal?(count(phone)+count(desktop))/deviceTotal*100:0;
  const summary=[['Sayfa görüntüleme',views,'Herkese açık sayfaların açılış sayısı'],['Çalışma ekranı açılışı',data?.totals?.workspace_opens,'Uygulama içindeki ekran açılışları'],['Yüzey analizi isteği',data?.totals?.analysis_requests,'Analiz düğmesine basılma sayısı']];
  const cards=summary.map(([label,total,note])=>'<div class="metric-step"><span>'+E(T(label))+'</span><strong>'+F(total)+'</strong><small>'+E(T(note))+'</small></div>').join('');
  const header=label=>'<summary>'+E(T(label))+'</summary>';
  element.innerHTML='<div class="metric-steps">'+cards+'</div><p class="metric-note">'+E(T('Bu değerler olay sayılarıdır; tekil kişi veya dönüşüm oranı değildir.'))+'</p><div class="metric-breakdowns">'+
   '<details class="metric-panel" open>'+header('Nereden geliyorlar?')+'<div class="metric-panel-body">'+bars(entries(data?.sources),sources)+'</div></details>'+
   '<details class="metric-panel" open>'+header('Cihaz')+'<div class="metric-panel-body"><div class="metric-donut" role="img" aria-label="'+E(T('Cihaz dağılımı'))+'" style="--metric-phone:'+first.toFixed(3)+'%;--metric-desktop:'+second.toFixed(3)+'%"><div><strong>'+F(deviceTotal)+'</strong><span>'+E(T('görüntüleme'))+'</span></div></div>'+bars(deviceRows,devices)+'</div></details>'+
   '<details class="metric-panel" open>'+header('Ülke')+'<div class="metric-panel-body">'+bars(entries(data?.countries),{},true)+'<p class="metric-note">'+E(T('Ağ konumuna dayalı yaklaşık ülke; VPN ve proxy sonucu değiştirebilir.'))+'</p><p class="metric-note"><a href="https://db-ip.com" target="_blank" rel="noopener noreferrer">IP Geolocation by DB-IP</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p></div></details></div>'+
   '<details class="metric-panel metric-pages">'+header('Görüntülenen sayfalar')+'<div class="metric-panel-body">'+bars(entries(data?.pages),pages)+'</div></details><p class="metric-note">'+E(T('IP, hesap kimliği, tam yönlendiren adres ve ziyaretçi profili saklanmaz. Saat dilimi: Europe/Istanbul.'))+'</p>';
 }
 root.DG_VISITOR_ANALYTICS_UI=Object.freeze({render});
})(window);
