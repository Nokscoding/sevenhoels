"use strict";
/* The updater runs only in Electron's trusted main process.
 * No update URL, package path, or installer command is accepted from a page.
 * GitHub Releases + electron-builder's SHA-512 manifest supply the update feed. */
function createUpdateController({app,updater,dialog,getWindow,platform=process.platform,logger=console}){
 if(!app||!updater||!dialog||typeof getWindow!=="function")throw Error("Updater dependencies missing");
 const supported=()=>platform==="win32"&&app.isPackaged===true;
 let status={phase:supported()?"idle":"disabled",currentVersion:app.getVersion(),nextVersion:null,percent:0};
 let checking=false,started=false,promptOpen=false;
 const clean=v=>String(v??"").slice(0,90);
 const send=(phase,extra={})=>{
  status={...status,...extra,phase};
  const win=getWindow();
  if(win&&!win.isDestroyed?.()&&!win.webContents.isDestroyed?.()){
   win.webContents.send("seven:update-status",{...status});
  }
 };
 const box=async options=>{
  const win=getWindow();
  if(!win||win.isDestroyed?.())return {response:1};
  return dialog.showMessageBox(win,{noLink:true,...options});
 };
 updater.autoDownload=false;
 updater.autoInstallOnAppQuit=false; // Only explicit acceptance installs.
 updater.allowDowngrade=false;
 updater.allowPrerelease=false;
 updater.on("checking-for-update",()=>send("checking"));
 updater.on("update-not-available",()=>{
  send("up-to-date",{percent:0,nextVersion:null});
 });
 updater.on("update-available",info=>{
  const version=clean(info?.version);
  send("available",{nextVersion:version,percent:0});
  void (async()=>{
   if(promptOpen)return;
   promptOpen=true;
   try{
    const decision=await box({
     type:"info",title:"Mise à jour de Seven Gestion",
     message:"Une nouvelle version de Seven Gestion est disponible.",
     detail:"Version installée : "+app.getVersion()+"\nNouvelle version : "+version+
      "\n\nTélécharger la mise à jour maintenant ? Le logiciel reste utilisable pendant le téléchargement.",
     buttons:["Télécharger","Plus tard"],defaultId:0,cancelId:1
    });
    if(decision.response!==0){send("deferred",{nextVersion:version});return;}
    send("downloading",{nextVersion:version,percent:0});
    try{await updater.downloadUpdate();}
    catch(err){logger.warn("Seven update download failed",clean(err?.message));send("error",{message:"Téléchargement impossible. Vérifiez votre connexion et réessayez."});}
   }finally{promptOpen=false;}
  })().catch(err=>logger.warn("Seven update prompt failed",clean(err?.message)));
 });
 updater.on("download-progress",info=>{
  const percent=Math.min(100,Math.max(0,Math.round(Number(info?.percent)||0)));
  send("downloading",{percent});
  const win=getWindow();
  if(win&&!win.isDestroyed?.())win.setProgressBar?.(percent/100);
 });
 updater.on("update-downloaded",info=>{
  const win=getWindow();
  if(win&&!win.isDestroyed?.())win.setProgressBar?.(-1);
  const version=clean(info?.version||status.nextVersion);
  send("ready",{nextVersion:version,percent:100});
  void (async()=>{
   // Don't interrupt the user's current workflow without asking.
   if(promptOpen){
    // Another modal is still closing. UI button remains available as fallback.
    return;
   }
   promptOpen=true;
   try{
    const decision=await box({
     type:"info",title:"Mise à jour prête à installer",
     message:"Seven Gestion "+version+" a été téléchargé.",
     detail:"Enregistrez vos modifications en cours. L'installation fermera Seven Gestion, appliquera la mise à jour et relancera le logiciel.\n\nVos données restent dans Supabase.",
     buttons:["Installer et redémarrer","Plus tard"],defaultId:0,cancelId:1
    });
    if(decision.response===0)install();
   }finally{promptOpen=false;}
  })().catch(err=>logger.warn("Seven install prompt failed",clean(err?.message)));
 });
 updater.on("error",err=>{
  logger.warn("Seven updater failed",clean(err?.message));
  send("error",{message:"La recherche de mises à jour a échoué. Vérifiez Internet puis réessayez."});
  const win=getWindow();
  if(win&&!win.isDestroyed?.())win.setProgressBar?.(-1);
 });
 const install=()=>{
  if(!supported()||status.phase!=="ready")return false;
  send("installing");
  updater.quitAndInstall(false,true);
  return true;
 };
 async function check(manual=false){
  if(!supported()){
   send("disabled",{message:"Les mises à jour sont disponibles uniquement après installation avec l'installateur Windows."});
   return {ok:false,reason:"not-installed"};
  }
  if(checking||["downloading","installing"].includes(status.phase))return {ok:false,reason:"busy"};
  checking=true;
  send("checking",{message:null});
  try{
   await updater.checkForUpdates();
   return {ok:true};
  }catch(err){
   logger.warn("Seven update check failed",clean(err?.message));
   send("error",{message:"Impossible de vérifier les mises à jour. Réessayez lorsque vous serez connecté."});
   if(manual)await box({type:"warning",title:"Seven Gestion — mises à jour",
     message:"La vérification des mises à jour a échoué.",detail:"Vérifiez votre connexion Internet, puis réessayez.",buttons:["Fermer"]});
   return {ok:false,reason:"network"};
  }finally{checking=false;}
 }
 function start(){
  if(started)return;
  started=true;
  if(supported())setTimeout(()=>{void check(false);},1800);
 }
 return {start,check,install,getState:()=>({...status})};
}
module.exports={createUpdateController};
