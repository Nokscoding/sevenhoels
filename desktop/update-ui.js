/* Seven Gestion Windows: visible, accessible update experience. */
(function(){
"use strict";
const bridge=window.sevenDesktop;
if(!bridge||typeof bridge.getUpdateState!=="function"||typeof bridge.downloadUpdate!=="function")return;
function init(){
 if(document.getElementById("sevenUpdateDialog"))return;
 const bar=document.querySelector(".topbar-right");
 const group=document.createElement("div");
 group.className="seven-update-group";
 const button=document.createElement("button");
 button.id="sevenUpdateButton";button.type="button";button.className="seven-update-button";
 button.textContent="Mises à jour";button.setAttribute("aria-label","Ouvrir la fenêtre des mises à jour");
 const label=document.createElement("small");
 label.className="seven-update-label";label.setAttribute("aria-live","polite");
 group.append(button,label);
 if(bar)bar.prepend(group);
 const dialog=document.createElement("dialog");
 dialog.id="sevenUpdateDialog";dialog.className="seven-update-dialog";
 dialog.setAttribute("aria-labelledby","sevenUpdateTitle");
 dialog.setAttribute("aria-describedby","sevenUpdateDescription");
 dialog.innerHTML=[
 '<div class="seven-update-head">',
 '<span class="seven-update-mark" aria-hidden="true">↻</span>',
 '<div class="seven-update-heading"><span class="seven-update-eyebrow">SEVEN GESTION · MISES À JOUR</span><h2 id="sevenUpdateTitle"></h2></div>',
 '<button type="button" class="seven-update-close" id="sevenUpdateClose" aria-label="Fermer cette fenêtre">×</button>',
 '</div>',
 '<div class="seven-update-content">',
 '<p id="sevenUpdateDescription" class="seven-update-description"></p>',
 '<div class="seven-update-versions"><div><span>Version installée</span><strong id="sevenCurrentVersion"></strong></div><span class="seven-version-arrow" aria-hidden="true">→</span><div><span>Nouvelle version</span><strong id="sevenNextVersion"></strong></div></div>',
 '<section class="seven-update-notes" id="sevenUpdateNotesWrap" hidden><h3>Nouveautés</h3><p id="sevenUpdateNotes"></p></section>',
 '<div class="seven-update-progress-wrap" id="sevenUpdateProgressWrap" hidden>',
 '<div class="seven-update-progress-head"><span id="sevenUpdateStage"></span><strong id="sevenUpdatePercent">0 %</strong></div>',
 '<progress id="sevenUpdateProgress" max="100" value="0" aria-label="Progression du téléchargement">0 %</progress>',
 '<div class="seven-update-progress-details"><span id="sevenUpdateTransferred"></span><span id="sevenUpdateSpeed"></span></div>',
 '<div class="seven-update-remaining" id="sevenUpdateRemaining"></div>',
 '</div>',
 '<p id="sevenUpdateInfo" class="seven-update-info" role="status" aria-live="polite"></p>',
 '</div>',
 '<div class="seven-update-actions"><button class="seven-update-secondary" type="button" id="sevenUpdateLater">Plus tard</button><button class="seven-update-primary" type="button" id="sevenUpdatePrimary">Télécharger</button></div>',
 '<div class="seven-update-footer">SEVEN HOTELS & APARTMENTS · GESTION WINDOWS</div>'
 ].join("");
 document.body.append(dialog);
 const by=id=>dialog.querySelector("#"+id);
 const title=by("sevenUpdateTitle"),description=by("sevenUpdateDescription");
 const installed=by("sevenCurrentVersion"),latest=by("sevenNextVersion");
 const notesWrap=by("sevenUpdateNotesWrap"),notes=by("sevenUpdateNotes");
 const progressWrap=by("sevenUpdateProgressWrap"),progress=by("sevenUpdateProgress");
 const stage=by("sevenUpdateStage"),percent=by("sevenUpdatePercent");
 const transferred=by("sevenUpdateTransferred"),speed=by("sevenUpdateSpeed"),remaining=by("sevenUpdateRemaining");
 const info=by("sevenUpdateInfo"),primary=by("sevenUpdatePrimary"),later=by("sevenUpdateLater");
 const x=by("sevenUpdateClose");
 let state={phase:"idle"},actionBusy=false;
 function show(){if(!dialog.open)dialog.showModal();}
 function close(){if(dialog.open)dialog.close();}
 const asMB=n=>(Math.max(0,Number(n)||0)/1048576).toLocaleString("fr-FR",{maximumFractionDigits:1})+" Mo";
 function render(next){
  if(!next||typeof next!=="object")return;
  const oldPhase=state.phase;state={...state,...next};
  const phase=String(state.phase||"idle"),version=String(state.nextVersion||"—").slice(0,40);
  installed.textContent=String(state.currentVersion||"—").slice(0,40);
  latest.textContent=version;
  const noteText=String(state.releaseNotes||"").slice(0,1300);
  notesWrap.hidden=!noteText||!["available","downloading","ready"].includes(phase);
  notes.textContent=noteText;
  progressWrap.hidden=!["downloading","ready","installing"].includes(phase);
  const pct=Math.min(100,Math.max(0,Math.round(Number(state.percent)||0)));
  progress.value=phase==="ready"||phase==="installing"?100:pct;
  percent.textContent=progress.value+" %";
  transferred.textContent=Number(state.total)>0?asMB(state.transferred)+" / "+asMB(state.total):"Préparation du téléchargement…";
  speed.textContent=Number(state.bytesPerSecond)>0?asMB(state.bytesPerSecond)+"/s":"";
  const sec=state.remainingSeconds;
  remaining.textContent=sec!==null&&sec!==undefined&&Number.isFinite(Number(sec))&&phase==="downloading"?
    (Number(sec)<60?Math.ceil(sec)+" s restantes":Math.floor(sec/60)+" min "+Math.ceil(sec%60)+" s restantes"):"";
  info.textContent=String(state.message||"").slice(0,400);
  primary.disabled=actionBusy||["checking","downloading","installing"].includes(phase);
  later.disabled=phase==="installing";
  x.disabled=phase==="installing";
  later.textContent=phase==="downloading"?"Continuer en arrière-plan":"Plus tard";
  label.textContent="";
  button.disabled=phase==="installing";
  if(phase==="available"||phase==="deferred"){
   title.textContent="Mise à jour disponible";
   description.textContent="Une nouvelle version de Seven Gestion est disponible. Téléchargez-la sans interrompre votre travail.";
   primary.textContent="Télécharger maintenant";
   label.textContent="Version "+version+" disponible";
   button.textContent="Mise à jour "+version;
  }else if(phase==="downloading"){
   title.textContent="Téléchargement en cours";
   description.textContent="La nouvelle version est en cours de téléchargement. Vous pouvez continuer à utiliser Seven Gestion.";
   stage.textContent="Téléchargement de Seven Gestion "+version;
   primary.textContent="Téléchargement…";
   button.textContent="Téléchargement "+pct+" %";
   label.textContent=pct+" % téléchargés";
  }else if(phase==="ready"){
   title.textContent="Mise à jour prête";
   description.textContent="Téléchargement terminé. Enregistrez votre travail : le logiciel se fermera puis redémarrera.";
   stage.textContent="Téléchargement terminé";
   transferred.textContent="Nouvelle version téléchargée";
   speed.textContent="";
   primary.textContent="Installer et redémarrer";
   button.textContent="Installer "+version;
   label.textContent="Prête à installer";
  }else if(phase==="installing"){
   title.textContent="Installation en cours";
   description.textContent="Seven Gestion va se fermer et redémarrer pour installer cette version.";
   stage.textContent="Préparation de l’installation";
   transferred.textContent="Redémarrage en cours…";
   speed.textContent="";
   primary.textContent="Installation…";
   button.textContent="Installation…";
  }else if(phase==="error"){
   title.textContent="Mise à jour interrompue";
   description.textContent="Impossible de terminer la mise à jour. Aucune donnée de gestion n’a été modifiée.";
   primary.textContent="Réessayer";
   label.textContent="Erreur de mise à jour";
   button.textContent="Réessayer";
  }else if(phase==="checking"){
   title.textContent="Recherche de mises à jour";
   description.textContent="Seven Gestion recherche la dernière version disponible.";
   primary.textContent="Vérification…";
   button.textContent="Vérification…";
  }else if(phase==="up-to-date"){
   title.textContent="Votre logiciel est à jour";
   description.textContent="Vous utilisez la dernière version de Seven Gestion.";
   primary.textContent="Vérifier à nouveau";
   primary.disabled=false;
   label.textContent="À jour";
   button.textContent="Mises à jour";
  }else{
   title.textContent="Mises à jour Seven Gestion";
   description.textContent="Vérifiez les mises à jour du logiciel.";
   primary.textContent="Vérifier maintenant";
   button.textContent="Mises à jour";
  }
  if(phase!==oldPhase&&["available","downloading","ready"].includes(phase))show();
  if(phase==="error"&&phase!==oldPhase&&["checking","downloading"].includes(oldPhase))show();
  if(phase==="installing")show();
 }
 bridge.onUpdateStatus(render);
 bridge.getUpdateState().then(render).catch(()=>{});
 x.addEventListener("click",close);
 later.addEventListener("click",close);
 dialog.addEventListener("cancel",e=>{if(state.phase==="installing")e.preventDefault();});
 async function act(){
  if(actionBusy)return;
  const phase=state.phase;
  actionBusy=true;primary.disabled=true;
  try{
   if(["available","deferred"].includes(phase)){
    const r=await bridge.downloadUpdate();
    if(r?.ok===false&&r.reason!=="busy")throw Error(r.reason||"download");
   }else if(phase==="ready"){
    await bridge.installUpdate();
   }else{
    await bridge.checkForUpdates();
   }
  }catch(err){
   info.textContent="Action impossible pour le moment. Réessayez.";
   console.warn("Seven updater action failed",err?.message);
  }finally{
   actionBusy=false;
   primary.disabled=["checking","downloading","installing"].includes(state.phase);
  }
 }
 primary.addEventListener("click",act);
 button.addEventListener("click",()=>{
  const phase=state.phase;
  show();
  if(!["available","deferred","downloading","ready","error","checking"].includes(phase))void act();
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();