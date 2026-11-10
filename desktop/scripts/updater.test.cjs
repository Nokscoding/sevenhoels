"use strict";
const assert=require("node:assert/strict");
const {EventEmitter}=require("node:events");
const {createUpdateController}=require("../updates.cjs");
function harness(responses=[0,0],packaged=true){
 const updater=new EventEmitter();
 updater.downloads=0;updater.installs=0;
 updater.checkForUpdates=async()=>{};
 updater.downloadUpdate=async()=>{updater.downloads+=1;};
 updater.quitAndInstall=()=>{updater.installs+=1;};
 const dialogs=[];
 const ctl=createUpdateController({
  app:{isPackaged:packaged,getVersion:()=>"0.2.0"},updater,platform:"win32",
  dialog:{showMessageBox:async(_w,o)=>{dialogs.push(o);return {response:responses.shift()??1}}},
  getWindow:()=>({isDestroyed:()=>false,setProgressBar(){},webContents:{isDestroyed:()=>false,send(){}}}),
  logger:{warn(){}}
 });
 return {ctl,updater,dialogs};
}
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const h=harness();
 assert.equal(h.updater.autoDownload,false);
 assert.equal(h.updater.autoInstallOnAppQuit,false);
 assert.equal(h.updater.allowDowngrade,false);
 await h.ctl.check(true);
 h.updater.emit("update-available",{version:"0.2.1"});
 await tick();
 assert.equal(h.dialogs.length,1,"new version must ask for consent");
 assert.equal(h.updater.downloads,1,"download after consent");
 h.updater.emit("download-progress",{percent:42.7});
 assert.equal(h.ctl.getState().percent,43);
 h.updater.emit("update-downloaded",{version:"0.2.1"});
 await tick();
 assert.equal(h.dialogs.length,2,"installation must ask for consent");
 assert.equal(h.updater.installs,1,"only after confirmation does installer launch");
 const later=harness([1]);
 later.updater.emit("update-available",{version:"0.2.1"});
 await tick();
 assert.equal(later.updater.downloads,0,"defer must not download");
 assert.equal(later.ctl.getState().phase,"deferred");
 const dev=harness([],false);
 assert.equal((await dev.ctl.check()).reason,"not-installed");
 assert.equal(dev.updater.downloads,0);
 console.log("Seven auto-update tests: startup, explicit consent, progress, install and deferral — OK");
})().catch(e=>{console.error(e);process.exitCode=1});
