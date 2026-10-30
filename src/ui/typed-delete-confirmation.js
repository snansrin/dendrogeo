"use strict";
/* One fail-closed, typed confirmation for destructive project, park and tree writes.
 * This is an accidental-deletion guard; Supabase RLS remains the authority. */
(function(root){
 const labels={
  project:{tr:"PROJE",en:"PROJECT",titleTr:"Projeyi sil",titleEn:"Delete project"},
  park:{tr:"PARK",en:"PARK",titleTr:"Park kimliğini sil",titleEn:"Delete park identity"},
  measurement:{tr:"KAYIT",en:"RECORD",titleTr:"Ölçümü sil",titleEn:"Delete measurement"}
 };
 let active=false;

 function requiredText(kind,id,lang="tr"){
  const label=labels[kind],identifier=String(id??"").trim();
  if(!label||!/^[1-9]\d*$/.test(identifier))return "";
  return lang==="en"?`DELETE ${label.en} ${identifier}`:`SİL ${label.tr} ${identifier}`;
 }

 function matches(kind,id,typed,lang="tr"){
  const required=requiredText(kind,id,lang);
  return !!required&&String(typed??"").trim()===required;
 }

 function ask({kind,id,name="",warning=""}={}){
  const doc=root.document,lang=doc?.documentElement?.lang==="en"?"en":"tr";
  const required=requiredText(kind,id,lang),label=labels[kind];
  if(!required||active||!doc?.body?.appendChild||!doc?.createElement)return Promise.resolve(false);
  const dialog=doc.createElement("dialog");
  if(typeof dialog.showModal!=="function"||typeof dialog.close!=="function")return Promise.resolve(false);
  active=true;
  const lastFocus=doc.activeElement;
  dialog.className="dg-operation-help-dialog";
  dialog.setAttribute("aria-labelledby","dgTypedDeleteTitle");
  dialog.setAttribute("aria-describedby","dgTypedDeleteHint");
  const header=doc.createElement("div");header.className="dg-operation-help-header";
  const title=doc.createElement("h2");title.id="dgTypedDeleteTitle";
  title.textContent=lang==="en"?label.titleEn:label.titleTr;
  header.appendChild(title);
  const form=doc.createElement("form");form.className="dg-operation-help-body";
  const target=doc.createElement("p");target.className="dg-meta";
  target.textContent=`${name?String(name)+" · ":""}#${id}`;
  form.appendChild(target);
  for(const line of String(warning).split(/\r?\n/).map(value=>value.trim()).filter(Boolean)){
   const note=doc.createElement("p");note.className="dg-meta";note.textContent=line;
   form.appendChild(note);
  }
  const hint=doc.createElement("p");hint.id="dgTypedDeleteHint";
  hint.textContent=lang==="en"
   ?`This cannot be undone. To confirm, type exactly: ${required}`
   :`Bu işlem geri alınamaz. Onaylamak için aynen şunu yazın: ${required}`;
  const fieldLabel=doc.createElement("label");fieldLabel.className="lbl";
  fieldLabel.setAttribute("for","dgTypedDeleteInput");
  fieldLabel.textContent=lang==="en"?"Written confirmation":"Yazılı onay";
  const input=doc.createElement("input");input.id="dgTypedDeleteInput";input.className="dg-typed-delete-field";
  input.type="text";input.autocomplete="off";input.spellcheck=false;
  input.setAttribute("autocapitalize","off");input.setAttribute("aria-required","true");
  input.setAttribute("aria-describedby","dgTypedDeleteHint");
  const actions=doc.createElement("div");actions.className="dg-typed-delete-actions";
  const cancel=doc.createElement("button");cancel.type="button";cancel.className="btn ghost";
  cancel.textContent=lang==="en"?"Cancel":"Vazgeç";
  const accept=doc.createElement("button");accept.type="submit";accept.className="btn red";
  accept.textContent=lang==="en"?"Delete permanently":"Kalıcı olarak sil";accept.disabled=true;
  actions.append(cancel,accept);
  form.append(hint,fieldLabel,input,actions);
  dialog.append(header,form);

  return new Promise(resolve=>{
   let settled=false;
   function finish(approved){
    if(settled)return;
    settled=true;active=false;
    if(dialog.open)dialog.close();
    dialog.remove();
    if(lastFocus?.isConnected&&typeof lastFocus.focus==="function")lastFocus.focus({preventScroll:true});
    resolve(approved);
   }
   input.addEventListener("input",()=>{accept.disabled=!matches(kind,id,input.value,lang);});
   cancel.addEventListener("click",()=>finish(false));
   dialog.addEventListener("close",()=>finish(false));
   form.addEventListener("submit",event=>{
    event.preventDefault();
    if(matches(kind,id,input.value,lang))finish(true);
   });
   try{doc.body.appendChild(dialog);dialog.showModal();input.focus();}
   catch(_error){finish(false);}
  });
 }
 root.DG_TYPED_DELETE_CONFIRM=Object.freeze({ask,requiredText,matches});
})(window);
