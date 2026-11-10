"use strict";
const assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {createUpdateController}=require("../updates.cjs");
function harness(packaged=true){
 const updater=new EventEmitter(),events=[],logs=[];
 updater.downloads=0;updater.installs=0;updater.checks=0;
 updater.checkForUpdates=async()=>{updater.checks++};
 updater.downloadUpdate=async()=>{updater.downloads++};
 updater.quitAndInstall=()=>{updater.installs++};
 const win={
  isDestroyed:()=>false,isVisible:()=>true,isMinimized:()=>false,
  setProgressBar(){},focus(){},webContents:{isDestroyed:()=>false,send:(_topic,state)=>events.push(state)}
 };
 const controller=createUpdateController({
  app:{isPackaged:packaged,getVersion:()=>"0.2.2"},
  updater,platform:"win32",getWindow:()=>win,logger:{warn:msg=>logs.push(msg)}
 });
 return {updater,events,logs,controller};
}
(async()=>{
 const h=harness();
 assert.equal(h.updater.autoDownload,false);
 assert.equal(h.updater.autoInstallOnAppQuit,false);
 assert.equal(h.updater.allowDowngrade,false);
 await h.controller.check();
 assert.equal(h.updater.checks,1);
 h.updater.emit("update-available",{version:"0.2.3",releaseNotes:"Fenêtre de mise à jour plus visible"});
 assert.equal(h.controller.getState().phase,"available");
 assert.equal(h.updater.downloads,0,"Aucune installation ni téléchargement sans clic");
 assert.equal(h.controller.getState().releaseNotes,"Fenêtre de mise à jour plus visible");
 assert.equal((await h.controller.download()).ok,true,"Le clic accepte le téléchargement");
 assert.equal(h.updater.downloads,1);
 h.updater.emit("download-progress",{percent:46.3,total:100000000,transferred:46300000,bytesPerSecond:2800000});
 const s=h.controller.getState();
 assert.equal(s.percent,46);
 assert.equal(s.transferred,46300000);
 assert.equal(s.total,100000000);
 assert.equal(s.bytesPerSecond,2800000);
 assert.equal(s.remainingSeconds,20);
 assert.equal(h.updater.installs,0);
 h.updater.emit("update-downloaded",{version:"0.2.3"});
 assert.equal(h.controller.getState().phase,"ready");
 assert.equal(h.updater.installs,0,"Installer seulement après une action explicite");
 assert.equal(h.controller.install(),true);
 assert.equal(h.updater.installs,1);
 assert.equal(h.controller.install(),false,"Pas de seconde installation");
 const later=harness();
 later.updater.emit("update-available",{version:"0.2.3"});
 assert.equal(later.updater.downloads,0,"Plus tard ne doit rien lancer");
 assert.equal(later.updater.installs,0);
 const dev=harness(false);
 assert.equal((await dev.controller.check()).reason,"not-installed");
 assert.equal((await dev.controller.download()).reason,"not-installed");
 const failed=harness();
 failed.updater.emit("update-available",{version:"0.2.3"});
 failed.updater.downloadUpdate=async()=>{throw Error("network")};
 assert.equal((await failed.controller.download()).reason,"network");
 assert.equal(failed.controller.getState().phase,"error");
 assert.equal((await failed.controller.check()).ok,true,"Retry search should be available");
 console.log("Seven updater: dialog-driven consent, progress metrics, defer, install and retry — OK");
})().catch(err=>{console.error(err);process.exitCode=1});
