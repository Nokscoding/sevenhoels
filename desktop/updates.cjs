"use strict";
/* All update decisions occur through an explicit action in the trusted desktop UI.
 * The Electron main process owns the updater; the web UI never receives an update URL. */
function createUpdateController({app,updater,getWindow,platform=process.platform,logger=console}){
 if(!app||!updater||typeof getWindow!=="function")throw Error("Updater dependencies missing");
 const supported=()=>platform==="win32"&&app.isPackaged===true;
 let status={phase:supported()?"idle":"disabled",currentVersion:app.getVersion(),
  nextVersion:null,percent:0,transferred:0,total:0,bytesPerSecond:0,remainingSeconds:null,
  releaseNotes:"",message:null};
 let checking=false,downloading=false,started=false;
 const clean=(v,n=250)=>String(v??"").slice(0,n);
 const activeWindow=()=>{const win=getWindow();return win&&!win.isDestroyed?.()?win:null;};
 const send=(phase,extra={})=>{
  status={...status,...extra,phase};
  const win=activeWindow();
  if(win&&!win.webContents.isDestroyed?.())
   win.webContents.send("seven:update-status",{...status});
 };
 const signal=()=>{
  const win=activeWindow();
  if(!win)return;
  if(win.isMinimized?.())win.restore?.();
  if(!win.isVisible?.())win.show?.();
  win.focus?.();
 };
 const releaseNotes=info=>{
  const raw=Array.isArray(info?.releaseNotes)?
   info.releaseNotes.map(item=>typeof item==="string"?item:item?.note||"").join("\n"):
   typeof info?.releaseNotes==="string"?info.releaseNotes:"";
  return clean(raw.replace(/<[^>]*>/g," ").replace(/\s{2,}/g," ").trim(),1300);
 };
 updater.autoDownload=false;
 updater.autoInstallOnAppQuit=false;
 updater.allowDowngrade=false;
 updater.allowPrerelease=false;
 updater.on("checking-for-update",()=>send("checking"));
 updater.on("update-not-available",()=>{
  send("up-to-date",{percent:0,nextVersion:null,transferred:0,total:0,
   bytesPerSecond:0,remainingSeconds:null,releaseNotes:"",message:null});
 });
 updater.on("update-available",info=>{
  send("available",{nextVersion:clean(info?.version,42),percent:0,transferred:0,total:0,
   bytesPerSecond:0,remainingSeconds:null,releaseNotes:releaseNotes(info),message:null});
  signal();
 });
 updater.on("download-progress",info=>{
  const transferred=Math.max(0,Number(info?.transferred)||0);
  const total=Math.max(0,Number(info?.total)||0);
  const bytesPerSecond=Math.max(0,Number(info?.bytesPerSecond)||0);
  const percent=Math.min(100,Math.max(0,Math.round(Number(info?.percent)||
    (total?transferred/total*100:0))));
  const remainingSeconds=bytesPerSecond>0&&total>transferred?
    Math.max(0,Math.ceil((total-transferred)/bytesPerSecond)):null;
  send("downloading",{percent,transferred,total,bytesPerSecond,remainingSeconds});
  const win=activeWindow();win?.setProgressBar?.(percent/100);
 });
 updater.on("update-downloaded",info=>{
  const win=activeWindow();win?.setProgressBar?.(-1);
  downloading=false;
  send("ready",{nextVersion:clean(info?.version||status.nextVersion,42),percent:100,
   remainingSeconds:0,bytesPerSecond:0,message:null});
  signal();
 });
 updater.on("error",err=>{
  logger.warn("Seven update error",clean(err?.message));
  checking=false;downloading=false;
  activeWindow()?.setProgressBar?.(-1);
  send("error",{message:"Connexion ou téléchargement impossible. Vérifiez Internet puis réessayez."});
 });
 async function download(){
  if(!supported())return {ok:false,reason:"not-installed"};
  if(downloading||["checking","installing","ready"].includes(status.phase))
   return {ok:false,reason:"busy"};
  if(!["available","deferred"].includes(status.phase)||!status.nextVersion)
   return {ok:false,reason:"not-available"};
  downloading=true;
  send("downloading",{percent:0,transferred:0,total:0,bytesPerSecond:0,remainingSeconds:null,message:null});
  try{
   await updater.downloadUpdate();
   return {ok:true};
  }catch(err){
   downloading=false;
   logger.warn("Seven download failed",clean(err?.message));
   activeWindow()?.setProgressBar?.(-1);
   send("error",{message:"Téléchargement interrompu. Vérifiez votre connexion puis relancez la recherche."});
   return {ok:false,reason:"network"};
  }
 }
 function install(){
  if(!supported()||status.phase!=="ready")return false;
  send("installing",{message:"Installation et redémarrage en cours…"});
  updater.quitAndInstall(false,true);
  return true;
 }
 async function check(){
  if(!supported()){
   send("disabled",{message:"Les mises à jour nécessitent l'installation de Seven Gestion sur Windows."});
   return {ok:false,reason:"not-installed"};
  }
  if(checking||downloading||["installing","ready"].includes(status.phase))
   return {ok:false,reason:"busy"};
  checking=true;send("checking",{message:null});
  try{
   await updater.checkForUpdates();
   return {ok:true};
  }catch(err){
   logger.warn("Seven check failed",clean(err?.message));
   send("error",{message:"Impossible de vérifier les mises à jour. Vérifiez votre connexion."});
   return {ok:false,reason:"network"};
  }finally{checking=false;}
 }
 function start(){
  if(started)return;started=true;
  if(supported())setTimeout(()=>{void check();},1800);
 }
 return {start,check,download,install,getState:()=>({...status})};
}
module.exports={createUpdateController};
