/* Seven Windows updater — native dialogs for decisions, topbar for status */
(function(){
"use strict";
const bridge=window.sevenDesktop;
if(!bridge||typeof bridge.checkForUpdates!=="function")return;
function init(){
 const bar=document.querySelector(".topbar-right");
 if(!bar)return;
 const group=document.createElement("div");group.className="seven-update-group";
 const button=document.createElement("button");button.id="sevenUpdateButton";
 button.type="button";button.className="seven-update-button";button.textContent="Mises à jour";
 button.setAttribute("aria-label","Vérifier les mises à jour de Seven Gestion");
 const label=document.createElement("small");label.id="sevenUpdateStatus";
 label.className="seven-update-label";label.setAttribute("role","status");label.setAttribute("aria-live","polite");
 group.append(button,label);bar.prepend(group);
 let phase="idle";
 function render(s){
  if(!s||typeof s!=="object")return;
  phase=String(s.phase||"idle");
  button.disabled=["checking","downloading","installing"].includes(phase);
  const version=String(s.nextVersion||"").slice(0,35);
  if(phase==="checking"){button.textContent="Vérification…";label.textContent="Recherche d’une mise à jour";}
  else if(phase==="available"){button.textContent="Version "+version;label.textContent="Mise à jour disponible";}
  else if(phase==="downloading"){button.textContent="Téléchargement "+(Math.round(Number(s.percent)||0))+" %";label.textContent="Ne fermez pas le logiciel";}
  else if(phase==="ready"){button.textContent="Installer "+version;button.disabled=false;label.textContent="Mise à jour téléchargée";}
  else if(phase==="installing"){button.textContent="Installation…";label.textContent="Redémarrage en cours";}
  else if(phase==="error"){button.textContent="Réessayer";button.disabled=false;label.textContent="Vérification impossible";}
  else if(phase==="disabled"){button.hidden=true;label.textContent="";}
  else{button.textContent="Mises à jour";button.disabled=false;label.textContent=phase==="up-to-date"?"Logiciel à jour":"";}
 }
 bridge.onUpdateStatus(render);
 bridge.getUpdateState().then(render).catch(()=>{});
 button.addEventListener("click",async()=>{
  try{
   if(phase==="ready")await bridge.installUpdate();
   else await bridge.checkForUpdates();
  }catch(error){
   label.textContent="Vérification impossible.";
   console.warn("Seven desktop update action failed",error?.message);
  }
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();
