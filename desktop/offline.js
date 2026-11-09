/* Seven Gestion Windows — lecture locale non sensible, sans réserver hors ligne. */
(function(){
"use strict";
const bridge=window.sevenDesktop;
if(!bridge)return;

document.body.classList.add("seven-desktop");
const form=document.getElementById("loginForm");
if(!form)return;

const button=document.createElement("button");
button.type="button";
button.className="desktop-offline-button";
button.textContent="Consulter l'état local des chambres (hors ligne)";
const message=document.getElementById("loginMessage");
form.insertBefore(button,message);

const dialog=document.createElement("dialog");
dialog.className="desktop-offline-dialog";
dialog.setAttribute("aria-label","Consultation locale Seven");
dialog.innerHTML='<div class="desktop-offline-head"><div><span class="overline">SEVEN / MODE LOCAL</span><h2>État de l’établissement</h2></div><button type="button" id="desktopOfflineClose" aria-label="Fermer">×</button></div><p class="desktop-offline-note">Dernière situation enregistrée sur cet ordinateur. Consultation uniquement : les réservations, arrivées et encaissements nécessitent une connexion sécurisée.</p><div id="desktopOfflineData" class="desktop-offline-data"></div><p class="desktop-offline-foot">Les informations locales peuvent être anciennes ; vérifiez le serveur avant toute décision.</p>';
document.body.appendChild(dialog);
dialog.querySelector("#desktopOfflineClose").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});

const labels={
 available:"Disponible",occupied:"Occupée",cleaning:"Nettoyage",
 maintenance:"Maintenance",out_of_service:"Hors service",unknown:"Statut inconnu"
};
function add(parent,tag,text,className){
 const node=document.createElement(tag);
 if(className)node.className=className;
 node.textContent=String(text??"");
 parent.appendChild(node);
 return node;
}
async function showOffline(){
 const area=dialog.querySelector("#desktopOfflineData");
 area.replaceChildren();
 try{
  const snapshot=await bridge.readSnapshot();
  if(!snapshot||!Array.isArray(snapshot.properties)||!snapshot.properties.length){
   add(area,"p","Aucune donnée locale n'est encore disponible. Connectez-vous une première fois pour télécharger l'état des chambres.","desktop-offline-empty");
   dialog.showModal();return;
  }
  const when=new Date(snapshot.createdAt);
  add(area,"p","Dernière synchronisation : "+(Number.isFinite(when.getTime())?when.toLocaleString("fr-FR"):"date inconnue"),"desktop-offline-time");
  for(const hotel of snapshot.properties){
   const section=add(area,"section","","desktop-offline-hotel");
   add(section,"h3",hotel.name||"Établissement");
   const counts={};
   for(const room of hotel.rooms||[]){
    counts[room.status]=(counts[room.status]||0)+1;
   }
   const stats=add(section,"div","","desktop-offline-stats");
   for(const status of ["available","occupied","cleaning","maintenance","out_of_service"]){
    const n=counts[status]||0;
    const el=add(stats,"div","","desktop-offline-stat");
    add(el,"strong",n);
    add(el,"small",labels[status]);
   }
   const list=add(section,"div","","desktop-offline-roomlist");
   for(const room of (hotel.rooms||[]).slice(0,200)){
    const item=add(list,"div","","desktop-offline-room");
    add(item,"span","Chambre "+room.number);
    add(item,"small",labels[room.status]||"État inconnu");
   }
  }
  dialog.showModal();
 }catch(error){
  console.error("Seven local overview error",error);
  add(area,"p","Impossible de déchiffrer l'état local. Veuillez vous reconnecter lorsque le réseau est disponible.","desktop-offline-empty");
  dialog.showModal();
 }
}
button.addEventListener("click",showOffline);
})();
