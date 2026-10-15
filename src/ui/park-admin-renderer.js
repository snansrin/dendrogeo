"use strict";

/* Directory presentation; application modules own all park mutations. */
const parkAdminBindings=new WeakSet(),parkAdminActionsByElement=new WeakMap(),parkAdminModels=new WeakMap();
function bindParkAdminActions(element,actions){
  if(!element||typeof element.addEventListener!=="function")return;
  parkAdminActionsByElement.set(element,actions||{});
  if(parkAdminBindings.has(element))return;
  parkAdminBindings.add(element);
  element.addEventListener('click',event=>{
    const control=event.target?.closest?.('[data-park-admin-action]');
    if(control&&element.contains(control)&&!control.disabled)parkAdminActionsByElement.get(element)?.[control.dataset.parkAdminAction]?.(control,event);
  });
  element.addEventListener('input',event=>{
    if(event.target?.matches?.('[data-park-admin-search]')&&!event.isComposing)parkAdminActionsByElement.get(element)?.search?.(event.target.value);
  });
  element.addEventListener('change',event=>{
    if(event.target?.matches?.('[data-park-admin-sort]'))parkAdminActionsByElement.get(element)?.sort?.(event.target.value);
  });
  element.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const menu=event.target?.closest?.('[data-park-admin-menu]');
    if(menu?.open){event.preventDefault();menu.open=false;menu.querySelector('summary')?.focus();}
  });
  element.addEventListener('toggle',event=>{
    const details=event.target;if(!details?.open)return;
    if(details.matches('[data-park-admin-menu]'))element.querySelectorAll('[data-park-admin-menu]').forEach(other=>{if(other!==details)other.open=false;});
    if(!details.matches('[data-park-admin-merge]'))return;
    const select=details.querySelector('select'),model=parkAdminModels.get(element);
    if(!select||!model||select.dataset.loaded)return;
    const {rows,escapeHTML:escape,translate:t}=model;
    // Build destinations only for an expanded merge editor; search never removes destinations.
    select.innerHTML='<option value="">'+escape(t('Hedef park seçin'))+'</option>'+rows.filter(park=>Number(park.id)!==Number(details.dataset.parkId)).map(park=>'<option value="'+Number(park.id)+'">'+escape(park.name||t('İsimsiz Park'))+' · #'+Number(park.id)+'</option>').join('');
    select.dataset.loaded='true';
  },true);
}
function dgRenderParkAdminHTML({element,rows,overview,showEmpty,formatHectares,distance,escapeHTML,translate,translateFormat,actions}){
  const {projByPark,measByPark,emptyRows,shown,dupGroups,unnamed}=overview,escape=escapeHTML,t=translate;
  const active=element.ownerDocument?.activeElement;
  const focusSelector=active?.matches?.('[data-park-admin-search]')?'[data-park-admin-search]':active?.matches?.('[data-park-admin-sort]')?'[data-park-admin-sort]':null;
  const selection=focusSelector==='[data-park-admin-search]'?[active.selectionStart,active.selectionEnd]:null;
  const duplicateIds=new Set(dupGroups.flatMap(group=>group.map(park=>park.id))),unnamedIds=new Set(unnamed.map(park=>park.id));
  const sorts=[['name-asc','Park adı · A–Z'],['name-desc','Park adı · Z–A'],['created-desc','En yeni kayıt'],['created-asc','En eski kayıt'],['creator-asc','Oluşturan · A–Z'],['measurements-desc','Ölçüm sayısı · çoktan aza'],['projects-desc','Proje sayısı · çoktan aza'],['area-desc','Alan · büyükten küçüğe']];
  const sourceText={osm:'OpenStreetMap',manual:'Elle oluşturuldu',backfill:'Proje üzerinden eşleştirildi'};
  const duplicateHTML=dupGroups.length?'<details class="dg-parkadmin-candidates"><summary>'+escape(translateFormat('{n} benzer park adı · İncele',{n:dupGroups.length}))+'</summary><p class="dg-meta">'+escape(t('Benzer adlar farklı parkları gösterebilir. Birleştirmeden önce kimlik ve konumu karşılaştırın.'))+'</p>'+dupGroups.map(group=>{
    const meters=group[0].centroid_lat&&group[1].centroid_lat?Math.round(distance(+group[0].centroid_lat,+group[0].centroid_lon,+group[1].centroid_lat,+group[1].centroid_lon)):null;
    return '<p class="dg-meta">'+group.map(park=>'<b>'+escape(park.name)+' · #'+Number(park.id)+'</b>').join(' ↔ ')+(meters!==null?' · '+escape(translateFormat('{n} m uzaklık',{n:meters})):'' )+'</p>';
  }).join('')+'</details>':'';
  const rowHTML=park=>{
    const id=Number(park.id),profile=Array.isArray(park.creator)?park.creator[0]:park.creator;
    const creator=profile?.full_name||(park.created_by?translateFormat('Kullanıcı · {id}',{id:String(park.created_by).slice(0,8)}):t('Oluşturan bilgisi yok'));
    const created=Number.isFinite(Date.parse(park.created_at))?new Date(park.created_at):null;
    return '<tr><td data-label="'+escape(t('Park'))+'"><strong>'+escape(park.name||t('İsimsiz Park'))+'</strong><small>#'+id+' · '+escape(formatHectares(park.area_m2))+'</small>'+(unnamedIds.has(park.id)?'<span class="dg-parkadmin-tag">'+escape(t('Ad bekliyor'))+'</span>':'')+(duplicateIds.has(park.id)?'<span class="dg-parkadmin-tag">'+escape(t('Benzer ad'))+'</span>':'')+'</td>'+
    '<td data-label="'+escape(t('Konum'))+'">'+escape([park.city,park.country].filter(Boolean).join(' · ')||'—')+'</td>'+
    '<td data-label="'+escape(t('Oluşturan'))+'">'+escape(creator)+(created?'<small><time datetime="'+created.toISOString()+'">'+escape(created.toLocaleDateString('tr-TR'))+'</time></small>':'')+'</td>'+
    '<td data-label="'+escape(t('Kapsam'))+'"><span>'+escape(translateFormat('{n} proje',{n:projByPark[park.id]||0}))+'</span><small>'+escape(translateFormat('{n} ölçüm',{n:measByPark[park.id]||0}))+'</small></td>'+
    '<td data-label="'+escape(t('İşlemler'))+'"><details class="dg-parkadmin-actions" data-park-admin-menu><summary class="btn sm ghost" aria-label="'+escape(t('İşlemler')+' · '+(park.name||'#'+id))+'">'+escape(t('İşlemler'))+' <span aria-hidden="true">▾</span></summary><div class="dg-parkadmin-actionpanel">'+
    '<p class="dg-meta"><span class="mono">'+escape(park.osm_key||'—')+'</span><br>'+escape(t(sourceText[park.source]||park.source||'—'))+'</p>'+
    '<button type="button" class="btn sm ghost" data-park-admin-action="rename" data-park-id="'+id+'">'+escape(t('Adı düzenle'))+'</button>'+
    '<button type="button" class="btn sm ghost" data-park-admin-action="backfillGeometry" data-park-id="'+id+'">'+escape(t('OSM sınırını güncelle'))+'</button>'+
    '<details class="dg-parkadmin-merge" data-park-admin-merge data-park-id="'+id+'"><summary>'+escape(t('Başka parkla birleştir'))+'</summary><p class="dg-meta">'+escape(t('Bu parkın projeleri ve ölçümleri hedef parka taşınır. İşlem ayrıca onaylanır.'))+'</p><label class="lbl" for="parkMergeSel'+id+'">'+escape(t('Hedef park'))+'</label><select id="parkMergeSel'+id+'" class="dg-png-select"><option value="">'+escape(t('Hedef park seçin'))+'</option></select><button type="button" class="btn sm amber" data-park-admin-action="mergeFromSelect" data-park-id="'+id+'">'+escape(t('Birleştirmeyi onayla'))+'</button></details>'+
    '<button type="button" class="btn sm red" data-park-admin-action="delete" data-park-id="'+id+'">'+escape(t('Park kimliğini kaldır'))+'</button><p class="dg-meta">'+escape(t('Kimlik kaldırıldığında ölçümler silinmez; park bağlantısı kaldırılır.'))+'</p></div></details></td></tr>';
  };
  element.innerHTML='<div class="dg-parkadmin-directory"><div class="dg-parkadmin-toolbar"><label class="dg-parkadmin-search"><span class="lbl">'+escape(t('Park ara'))+'</span><input type="search" data-park-admin-search placeholder="'+escape(t('Park, şehir, oluşturan veya kimlik'))+'" value="'+escape(overview.query||'')+'"></label><label><span class="lbl">'+escape(t('Sıralama'))+'</span><select data-park-admin-sort>'+sorts.map(([value,label])=>'<option value="'+value+'"'+((overview.sort||'name-asc')===value?' selected':'')+'>'+escape(t(label))+'</option>').join('')+'</select></label></div>'+
    '<div class="dg-parkadmin-summary"><span role="status" aria-live="polite">'+escape(translateFormat('{shown} / {total} park',{shown:shown.length,total:rows.length}))+'</span>'+(unnamed.length?'<span>'+escape(translateFormat('{n} ad bekliyor',{n:unnamed.length}))+'</span>':'')+(emptyRows.length?'<button type="button" class="btn sm ghost" data-park-admin-action="toggleEmpty" aria-pressed="'+!!showEmpty+'">'+escape(showEmpty?t('Boş parkları gizle'):translateFormat('Boş parkları göster ({n})',{n:emptyRows.length}))+'</button>':'')+'</div>'+duplicateHTML+
    '<div class="dg-parkadmin-wrap"><table class="dg-cards dg-parkadmin-table"><thead><tr>'+['Park','Konum','Oluşturan','Kapsam','İşlemler'].map(label=>'<th scope="col">'+escape(t(label))+'</th>').join('')+'</tr></thead><tbody>'+(shown.map(rowHTML).join('')||'<tr><td colspan="5">'+escape(t(rows.length?'Aramanızla eşleşen park yok.':'Henüz park kimliği yok — Canlı Harita üzerinden park ekleyin.'))+'</td></tr>')+'</tbody></table></div></div>';
  parkAdminModels.set(element,{rows,escapeHTML,translate});
  bindParkAdminActions(element,actions);
  if(focusSelector){const next=element.querySelector?.(focusSelector);next?.focus({preventScroll:true});if(selection)next?.setSelectionRange(...selection);}
}
window.DG_PARK_ADMIN_RENDERER=Object.freeze({render:dgRenderParkAdminHTML});
