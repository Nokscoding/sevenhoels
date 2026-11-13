"use strict";
const path=require("node:path");
const fs=require("node:fs/promises");
const net=require("node:net");
const {spawn}=require("node:child_process");

function createRfidStudioController({app,dialog,getWindow,platform=process.platform,
 files=fs,spawnProcess=spawn,probe=probeService,pause=ms=>new Promise(r=>setTimeout(r,ms)),resourcesPath=process.resourcesPath}){
 const supported=()=>platform==="win32";
 const root=app.isPackaged?path.join(resourcesPath,"rfid-studio"):path.join(__dirname,"rfid-studio","runtime");
 const executable=path.join(root,"SevenRFIDStudio.exe");
 const configFile=()=>path.join(app.getPath("userData"),"seven-rfid-studio.json");
 let busy=false,studio=null,manufacturer=null;
 const exists=async p=>{try{return (await files.stat(p)).isFile();}catch{return false;}};
 async function configuredCardLock(){
  try{
   const text=await files.readFile(configFile(),"utf8");
   if(text.length>6000)return null;
   const file=JSON.parse(text).cardLockPath;
   return typeof file==="string"&&path.basename(file).toLowerCase()==="cardlock.exe"&&await exists(file)?file:null;
  }catch{return null;}
 }
 async function status(){
  if(!supported())return {supported:false,available:false,version:"2.2",requiresCardLock:true};
  return {supported:true,available:await exists(executable),version:"2.2",requiresCardLock:true,
   cardLockConfigured:!!await configuredCardLock(),servicePort:await probe()};
 }
 async function launch(file,args){
  return new Promise((resolve,reject)=>{
   const child=spawnProcess(file,args,{cwd:path.dirname(file),shell:false,windowsHide:false,detached:true,stdio:"ignore"});
   child.once("error",reject);
   child.once("spawn",()=>{child.unref();resolve(child);});
  });
 }
 async function startCardLock(){
  if(await probe())return {ok:true,alreadyOpen:true};
  if(manufacturer&&manufacturer.exitCode===null)return {ok:true,alreadyOpen:true};
  let file=await configuredCardLock();
  if(!file){
   const selected=await dialog.showOpenDialog(getWindow(),{title:"Choisir le CardLock.exe installé pour le lecteur Seven",filters:[{name:"CardLock.exe",extensions:["exe"]}],properties:["openFile"]});
   if(selected.canceled)return {ok:false,cancelled:true};
   file=selected.filePaths[0];
   if(typeof file!=="string"||path.basename(file).toLowerCase()!=="cardlock.exe"||!await exists(file))throw Error("Sélectionnez le fichier CardLock.exe de votre installation.");
   await files.mkdir(path.dirname(configFile()),{recursive:true});
   const tmp=configFile()+".tmp";
   await files.writeFile(tmp,JSON.stringify({cardLockPath:file}),{mode:0o600});
   await files.rename(tmp,configFile());
  }
  manufacturer=await launch(file,[]);
  manufacturer.once("exit",()=>{manufacturer=null;});
  return {ok:true};
 }
 async function openStudio(){
  if(!supported())return {ok:false,message:"Les outils S18 nécessitent Seven Gestion sur Windows."};
  if(busy)return {ok:false,message:"Ouverture RFID déjà en cours."};
  if(studio&&studio.exitCode===null)return {ok:true,alreadyOpen:true};
  busy=true;
  try{
   if(!await exists(executable))return {ok:false,message:"Module RFID 2.2 absent. Réinstallez la mise à jour Seven Gestion."};
   let port=await probe();
   if(!port){
    const started=await startCardLock();
    if(!started.ok)return started;
    for(let i=0;i<48&&!port;i++){await pause(250);port=await probe();}
   }
   if(!port)return {ok:false,message:"CardLock doit terminer son ouverture. Gardez sa fenêtre ouverte puis réessayez."};
   studio=await launch(executable,[]);
   studio.once("exit",()=>{studio=null;});
   return {ok:true,version:"2.2",requiresCardLock:true};
  }catch(error){return {ok:false,message:error?.message||"Ouverture du module RFID impossible."};}
  finally{busy=false;}
 }
 async function openCardLock(){
  if(!supported())return {ok:false,message:"CardLock nécessite Windows."};
  if(busy)return {ok:false,message:"Ouverture RFID déjà en cours."};
  busy=true;try{return await startCardLock();}catch(error){return {ok:false,message:error?.message||"Ouverture de CardLock impossible."};}finally{busy=false;}
 }
 return {status,openStudio,openCardLock};
}
async function probeService(){
 const ports=[10086];
 for(const port of ports){
  const listening=await new Promise(resolve=>{
   const socket=net.createConnection({host:"127.0.0.1",port});
   let settled=false;
   const done=ok=>{if(settled)return;settled=true;socket.destroy();resolve(ok);};
   socket.setTimeout(250,()=>done(false));socket.once("connect",()=>done(true));socket.once("error",()=>done(false));
  });
  if(listening)return port;
 }
 return null;
}
module.exports={createRfidStudioController};
