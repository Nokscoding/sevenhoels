(function(){
 "use strict";
 const api=window.sevenDesktop;
 const page=document.getElementById("rfidPage");
 if(!api?.getRfidStudioStatus||!page)return;
 const panel=document.createElement("div");panel.className="panel";panel.id="sevenRfidStudioPanel";
 const heading=document.createElement("h2");heading.textContent="Lecteur S18 — mode compatible";
 const note=document.createElement("p");note.className="message-note";
 note.textContent="Retrouvez la lecture, l’écriture et l’effacement dans Seven RFID Studio 2.2. Gardez CardLock ouvert pendant les opérations. Utilisez les badges et serrures de test.";
 const actions=document.createElement("div");actions.className="inline-actions";
 const open=document.createElement("button");open.id="sevenRfidStudioOpen";open.className="primary";open.type="button";open.textContent="Ouvrir Seven RFID Studio";
 const manufacturer=document.createElement("button");manufacturer.id="sevenRfidCardLockOpen";manufacturer.className="outline";manufacturer.type="button";manufacturer.textContent="Ouvrir CardLock";
 const status=document.createElement("p");status.className="hint";status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 actions.append(open,manufacturer);panel.append(heading,note,actions,status);page.prepend(panel);
 async function refresh(){
  try{
   const value=await api.getRfidStudioStatus();
   open.disabled=!value.supported||!value.available;manufacturer.disabled=!value.supported;
   status.textContent=!value.supported?"Module disponible dans l’application Windows.":!value.available?"Module RFID absent : réinstallez la mise à jour Seven.":value.servicePort?"Service lecteur disponible. Le studio contrôle les opérations sur le badge.":"Ouvrez le studio : Seven vous aidera à lancer CardLock si nécessaire.";
  }catch{status.textContent="Impossible de vérifier le module RFID. Réessayez après redémarrage de Seven.";}
 }
 async function action(fn,message){
  open.disabled=true;manufacturer.disabled=true;status.textContent=message;
  try{
   const result=await fn();
   status.textContent=result.ok?"Fenêtre ouverte. Gardez CardLock ouvert pendant l’utilisation du lecteur.":result.cancelled?"Sélection annulée.":result.message||"Ouverture impossible.";
  }catch{status.textContent="Ouverture impossible. Vérifiez l’installation de CardLock.";}
  finally{open.disabled=false;manufacturer.disabled=false;}
 }
 open.addEventListener("click",()=>action(()=>api.openRfidStudio(),"Ouverture de CardLock et du studio compatible…"));
 manufacturer.addEventListener("click",()=>action(()=>api.openRfidCardLock(),"Ouverture de CardLock…"));
 refresh();
})();
