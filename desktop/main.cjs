"use strict";
const {app,BrowserWindow,ipcMain,protocol,net,session,safeStorage,dialog,shell} = require("electron");
const {autoUpdater}=require("electron-updater");
const {createUpdateController}=require("./updates.cjs");
const {createRfidStudioController}=require("./rfid-studio.cjs");
const {createRfidLayoutStore}=require("./rfid-layout.cjs");
const {createRfidNativeController}=require("./rfid-native.cjs");
const {createProUsb71Launcher}=require("./rfid-vendor71.cjs");
const fs = require("node:fs/promises");
const path = require("node:path");
const {pathToFileURL} = require("node:url");

const SCHEME="seven";
const HOST="app";
const ROOT=path.join(__dirname,"renderer");
const CACHE_FILENAME="seven-offline-summary.enc";
let mainWindow;
let updateController;
let rfidStudio;
let rfidLayout;
let rfidNative;
let rfidVendor71;

protocol.registerSchemesAsPrivileged([{
 scheme:SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}
}]);

function isLocalSender(event){
 const url=event.senderFrame?.url||"";
 return event.sender===mainWindow?.webContents && url.startsWith(SCHEME+"://"+HOST+"/");
}
function cacheFile(){return path.join(app.getPath("userData"),CACHE_FILENAME);}
function trim(value,n=120){return String(value??"").slice(0,n);}
function cleanSnapshot(data){
 if(!data || typeof data!=="object")throw Error("Invalid snapshot");
 const properties=Array.isArray(data.properties)?data.properties.slice(0,12):[];
 return {
  version:1,createdAt:new Date().toISOString(),
  userId:trim(data.userId,72),
  properties:properties.map(p=>({
   id:trim(p?.id,72),
   name:trim(p?.name,120),
   rooms:Array.isArray(p?.rooms)?p.rooms.slice(0,500).map(r=>({
    number:trim(r?.number,25),
    floor:trim(r?.floor,30),
    status:["available","occupied","cleaning","maintenance","out_of_service"].includes(r?.status)?
       r.status:"unknown"
   })):[]
  }))
 };
}
async function encryptionReady(){
 if(process.platform==="linux" && safeStorage.getSelectedStorageBackend?.()==="basic_text")
   return false;
 return safeStorage.isAsyncEncryptionAvailable();
}
async function saveSnapshot(event,payload){
 if(!isLocalSender(event))throw Error("Unauthorized");
 if(!await encryptionReady())throw Error("Secure local storage is not available");
 const sanitized=cleanSnapshot(payload);
 const plain=JSON.stringify(sanitized);
 if(plain.length>250000)throw Error("Snapshot too large");
 const encrypted=await safeStorage.encryptStringAsync(plain);
 await fs.mkdir(path.dirname(cacheFile()),{recursive:true});
 const tmp=cacheFile()+".tmp";
 await fs.writeFile(tmp,encrypted,{mode:0o600});
 await fs.rename(tmp,cacheFile());
 return {ok:true,createdAt:sanitized.createdAt};
}
async function loadSnapshot(event){
 if(!isLocalSender(event))throw Error("Unauthorized");
 if(!await encryptionReady())return null;
 try{
  const encrypted=await fs.readFile(cacheFile());
  if(encrypted.length>300000)return null;
  const decrypted=await safeStorage.decryptStringAsync(encrypted);
  const obj=JSON.parse(decrypted.result);
  if(!obj || obj.version!==1 || !Array.isArray(obj.properties))return null;
  if(decrypted.shouldReEncrypt){
   const updated=await safeStorage.encryptStringAsync(decrypted.result);
   await fs.writeFile(cacheFile(),updated,{mode:0o600});
  }
  return obj;
 }catch(error){
  if(error?.code!=="ENOENT")console.warn("Seven offline summary unavailable",error?.message);
  return null;
 }
}
async function clearSnapshot(event){
 if(!isLocalSender(event))throw Error("Unauthorized");
 await fs.rm(cacheFile(),{force:true});
 return true;
}
function createWindow(){
 mainWindow=new BrowserWindow({
  width:1440,height:900,minWidth:950,minHeight:650,
  title:"Seven Gestion",backgroundColor:"#f6f7f5",
  show:false,autoHideMenuBar:true,
  webPreferences:{
   preload:path.join(__dirname,"preload.cjs"),
   nodeIntegration:false,contextIsolation:true,sandbox:true,
   webSecurity:true,allowRunningInsecureContent:false
  }
 });
 mainWindow.once("ready-to-show",()=>mainWindow.show());
 mainWindow.webContents.setWindowOpenHandler(()=>({action:"deny"}));
 mainWindow.webContents.on("will-navigate",(event,url)=>{
  if(!url.startsWith(SCHEME+"://"+HOST+"/"))event.preventDefault();
 });
 mainWindow.loadURL(SCHEME+"://"+HOST+"/index.html");
}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on("second-instance",()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus();}});
 app.whenReady().then(()=>{
  protocol.handle(SCHEME,request=>{
   const url=new URL(request.url);
   if(url.host!==HOST)return new Response("Forbidden",{status:403});
   const name=decodeURIComponent(url.pathname).replace(/^\/+/,"")||"index.html";
   if(name.includes("\0") || name.split("/").includes(".."))return new Response("Forbidden",{status:403});
   const target=path.resolve(ROOT,name);
   if(!target.startsWith(ROOT+path.sep))return new Response("Forbidden",{status:403});
   return net.fetch(pathToFileURL(target).toString());
  });
  session.defaultSession.setPermissionRequestHandler((wc,permission,respond)=>{
   const authorized=wc===mainWindow?.webContents &&
     wc.getURL().startsWith(SCHEME+"://"+HOST+"/");
   respond(authorized && permission==="notifications");
  });
  ipcMain.handle("seven:cache-save",saveSnapshot);
  ipcMain.handle("seven:cache-read",loadSnapshot);
  ipcMain.handle("seven:cache-clear",clearSnapshot);
  ipcMain.handle("seven:app-version",event=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return app.getVersion();
  });
  updateController=createUpdateController({
   app,updater:autoUpdater,getWindow:()=>mainWindow
  });
  ipcMain.handle("seven:update-state",event=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return updateController.getState();
  });
  ipcMain.handle("seven:update-check",event=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return updateController.check(true);
  });
  ipcMain.handle("seven:update-download",event=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return updateController.download();
  });
  ipcMain.handle("seven:update-install",event=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return updateController.install();
  });
  rfidStudio=createRfidStudioController({app,dialog,getWindow:()=>mainWindow});
  rfidLayout=createRfidLayoutStore({app,safeStorage});
  ipcMain.handle("seven:rfid-layout-read",(event,payload)=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidLayout.get(payload);
  });
  ipcMain.handle("seven:rfid-layout-put",(event,payload)=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidLayout.put(payload);
  });
  ipcMain.handle("seven:rfid-profile-read",(event,payload)=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidLayout.getReaderProfile(payload);
  });
  ipcMain.handle("seven:rfid-profile-save",(event,payload)=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidLayout.setReaderProfile(payload);
  });
  rfidVendor71=createProUsb71Launcher({app,layout:rfidLayout,dialog,getWindow:()=>mainWindow});
  rfidNative=createRfidNativeController({app,studio:rfidStudio,layout:rfidLayout,manufacturer71:rfidVendor71});
  ipcMain.handle("seven:rfid-vendor71-open",(event,payload)=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidVendor71.launch(payload);
  });
  ipcMain.handle("seven:rfid-vendor71-status",(event,payload)=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidVendor71.state(payload);
  });
  ipcMain.handle("seven:rfid-native-status",event=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidNative.status();
  });
  ipcMain.handle("seven:rfid-native-run",(event,payload)=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidNative.execute(payload);
  });
  // Audible Windows fallback even when the S18 firmware does not expose its buzzer.
  // Limited to three fixed events: no arbitrary commands from the renderer.
  ipcMain.handle("seven:rfid-sound",(event,kind)=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   if(!["connected","read","written"].includes(kind))return {ok:false};
   try{
    shell.beep();
    if(kind==="written")setTimeout(()=>{try{shell.beep();}catch{}},220);
    return {ok:true};
   }catch{return {ok:false};}
  });
  ipcMain.handle("seven:rfid-vendor-read",(event,payload)=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidLayout.getVendorId(payload);
  });
  ipcMain.handle("seven:rfid-vendor-save",(event,payload)=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidLayout.setVendorId(payload);
  });
  ipcMain.handle("seven:rfid-studio-status",event=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidStudio.status();
  });
  ipcMain.handle("seven:rfid-studio-open",event=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidStudio.openStudio();
  });
  ipcMain.handle("seven:rfid-cardlock-open",event=>{
   if(!isLocalSender(event))throw Error("Unauthorized");
   return rfidStudio.openCardLock();
  });
  createWindow();
  updateController.start();
 });
 app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
}
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
