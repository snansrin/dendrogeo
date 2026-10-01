import io
def P(path,pairs):
    t=io.open(path,encoding='utf-8').read()
    for old,new in pairs:
        assert old in t, path+' YOK: '+old[:70]
        t=t.replace(old,new,1)
    io.open(path,'w',encoding='utf-8').write(t)
    print('OK',path,len(pairs))

HELPER='''/* 0037: i18n güvenlikli yerel yardımcılar. */
const _tinv=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tinvf=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\\{(\\w+)\\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));
'''
HELPER_GR='''/* 0037: i18n güvenlikli yerel yardımcılar. */
const _tgr=(s)=>(typeof dgCf==="function"?dgCf(s):s);
const _tgrf=(t,v)=>(typeof dgTfs==="function"?dgTfs(t,v):String(t).replace(/\\{(\\w+)\\}/g,(m,k)=>(v&&v[k]!=null?v[k]:m)));
'''

# ═══ park-invites.js ═══
t=io.open('src/services/park-invites.js',encoding='utf-8').read()
if '_tinv=' not in t:
    t=t.replace('"use strict";','"use strict";\n'+HELPER,1)
pairs=[
('''parkına çalışma arkadaşı davetin var${r.note?` · not: <i>${esc(r.note)}</i>`:""}''',
 '''${_tinv("parkına çalışma arkadaşı davetin var")}${r.note?` · ${_tinv("not")}: <i>${esc(r.note)}</i>`:""}'''),
('${p.role==="collaborator"?" · ortak":""}','${p.role==="collaborator"?" · "+_tinv("ortak"):""}'),
('`<div class="lbl">Ortaklar (${col.length})</div>`+','`<div class="lbl">${_tinv("Ortaklar")} (${col.length})</div>`+'),
('`<div class="lbl" style="margin-top:10px">Davetler (${inv.length})</div>`+','`<div class="lbl" style="margin-top:10px">${_tinv("Davetler")} (${inv.length})</div>`+'),
]
for old,new in pairs:
    assert old in t,'invites YOK: '+old[:60]
    t=t.replace(old,new,1)
io.open('src/services/park-invites.js','w',encoding='utf-8').write(t)
print('OK park-invites')

# ═══ grid-engine.js ═══
t=io.open('src/services/grid-engine.js',encoding='utf-8').read()
if '_tgr=' not in t:
    t=t.replace('"use strict";','"use strict";\n'+HELPER_GR,1)
pairs=[
('''    return toast(
      "⚠ ~"+
      est+
      " hücre çok yoğun.",
      "err"
    );''','    return toast(_tgrf("⚠ ~{n} hücre çok yoğun.",{n:est}),"err");'),
('''    !confirm(
      `⚠ ~${est} hücre.\\nDevam?`
    )''','    !confirm(_tgrf("⚠ ~{n} hücre.\\nDevam?",{n:est}))'),
('''  toast(
    "✓ Grid hazır: "+
    GRID_CELLS.length+
    " hücre",
    "ok",
    "🔲"
    );''','  toast(_tgrf("✓ Grid hazır: {n} hücre",{n:GRID_CELLS.length}),"ok","🔲");'),
('      `Hücre ${cell.id} · ${cell.n} ölçüm`,','      _tgrf("Hücre {id} · {n} ölçüm",{id:cell.id,n:cell.n}),'),
('`Toplam: <b>${tot}</b> · `+','`${_tgr("Toplam:")} <b>${tot}</b> · `+'),
('`🟢 Ölçülmüş: ${g} (%${pct(g)}) · `+','`🟢 ${_tgr("Ölçülmüş:")} ${g} (%${pct(g)}) · `+'),
('`🔴 Boş: ${r0} (%${pct(r0)})<br>`+','`🔴 ${_tgr("Boş:")} ${r0} (%${pct(r0)})<br>`+'),
('`<b style="color:#1d4ed8">🔵 Seçili: ${selCount}</b><br>`','`<b style="color:#1d4ed8">🔵 ${_tgr("Seçili:")} ${selCount}</b><br>`'),
('''`<button class="btn sm blue" onclick="createWaypointsFromGrid('auto')">📍 Otomatik (${r0})</button>`''',
 '''`<button class="btn sm blue" onclick="createWaypointsFromGrid('auto')">${_tgrf("📍 Otomatik ({n})",{n:r0})}</button>`'''),
('''`<button class="btn sm" style="background:#1d4ed8;color:#fff" onclick="createWaypointsFromGrid('manual')">📍 Seçili (${selCount})</button>`''',
 '''`<button class="btn sm" style="background:#1d4ed8;color:#fff" onclick="createWaypointsFromGrid('manual')">${_tgrf("📍 Seçili ({n})",{n:selCount})}</button>`'''),
]
for old,new in pairs:
    assert old in t,'grid YOK: '+old[:60]
    t=t.replace(old,new,1)
io.open('src/services/grid-engine.js','w',encoding='utf-8').write(t)
print('OK grid-engine')

# ═══ park-panel.js ═══
t=io.open('src/ui/park-panel.js',encoding='utf-8').read()
old='''  toast(
    "✓ Park algılandı: "+
    ((parkRow&&parkRow.name)||park.name||"")+
    " · "+haTotal+" ha"+
    (parkRow?" · kimlik #"+parkRow.id:""),
    "ok",
    "🌳"'''
new='''  toast(
    (typeof dgCf==="function"?dgCf("✓ Park algılandı: "):"✓ Park algılandı: ")+
    ((parkRow&&parkRow.name)||park.name||"")+
    " · "+haTotal+" ha"+
    (parkRow?" · "+(typeof dgCf==="function"?dgCf("kimlik #"):"kimlik #")+parkRow.id:""),
    "ok",
    "🌳"'''
assert old in t,'panel toast yok'; t=t.replace(old,new,1)
io.open('src/ui/park-panel.js','w',encoding='utf-8').write(t)
print('OK park-panel')

# ═══ auth.js ═══
t=io.open('src/services/auth.js',encoding='utf-8').read()
if 'toast("Google girişi başlatılamadı: "' in t:
    t=t.replace('toast("Google girişi başlatılamadı: "','toast((typeof dgCf==="function"?dgCf("Google girişi başlatılamadı: "):"Google girişi başlatılamadı: ")',1)
io.open('src/services/auth.js','w',encoding='utf-8').write(t)
print('OK auth')

# ═══ backup.js ═══
t=io.open('src/services/backup.js',encoding='utf-8').read()
old='toast("✓ Yedek indirildi: "+name+" ("+meas.length+" ölçüm)","ok","💾");'
new='toast((typeof dgTfs==="function"?dgTfs("✓ Yedek indirildi: {f} ({n} ölçüm)",{f:name,n:meas.length}):("✓ Yedek indirildi: "+name+" ("+meas.length+" ölçüm)")),"ok","💾");'
assert old in t,'backup toast yok'; t=t.replace(old,new,1)
io.open('src/services/backup.js','w',encoding='utf-8').write(t)
print('OK backup')

# ═══ data-requests.js 28: birleşik mesaj ═══
t=io.open('src/services/data-requests.js',encoding='utf-8').read()
i=t.find('Aynı filtreyle bir talebiniz zaten')
print('data-requests bağlam:',repr(t[i-60:i+180]))
io.open('/tmp/dr_ctx.txt','w',encoding='utf-8').write(t[max(0,i-200):i+400])
