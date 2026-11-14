"use strict";
const path=require("node:path");
const fs=require("node:fs/promises");
const crypto=require("node:crypto");
const {spawn,execFile}=require("node:child_process");

const PROUSB71_SHA256="ea255d6430db13e4f4557fee66c57c6f3d9485c1f6ddfe421805a8254e31dfd6";
const PRORFL_SHA256="a694dbde0338e5b72ac77a2df49871404b3c8f43a8d01b1ac4a3d6955dd96e44";
const DEFAULT_INSTALLS=[
 "D:\\LockV9.27C\\CardLock.Exe",
 "D:\\lock\\LockV9.27C\\CardLock.Exe",
 "D:\\LockV9.27C\\LockV9.27C\\CardLock.Exe",
 "C:\\LockV9.27C\\CardLock.Exe"
];
const clean=p=>path.win32.normalize(String(p||"").trim()).toLowerCase();
const distinctPaths=paths=>[...new Map(
 (Array.isArray(paths)?paths:[]).filter(p=>typeof p==="string"&&p.trim())
 .map(p=>[clean(p),p.trim()])
).values()];
async function fingerprint(file,files){
 const bytes=await files.readFile(file);
 return crypto.createHash("sha256").update(bytes).digest("hex");
}
async function verifyProUsb71(file,files=fs){
 const target=String(file||"");
 if(!path.win32.isAbsolute(target)||path.win32.basename(target).toLowerCase()!=="cardlock.exe")
  return {ok:false,message:"Sélectionnez l'application proUSB V9.27C (CardLock.Exe) de Seven 71."};
 try{
  if(await fingerprint(target,files)!==PROUSB71_SHA256)
   return {ok:false,message:"Ce fichier n'est pas le proUSB V9.27C fourni pour Seven 71. Il peut s'agir du logiciel de Seven 47."};
  const root=path.win32.dirname(target);
  if(await fingerprint(path.win32.join(root,"proRFL.dll"),files)!==PRORFL_SHA256)
   return {ok:false,message:"La bibliothèque proRFL.dll de cette installation ne correspond pas au logiciel de Seven 71."};
  for(const name of ["d12.dll","d12c.dll","System.ini","CardLock.MDB"]){
   if(!(await files.stat(path.win32.join(root,name))).isFile())
    return {ok:false,message:"Le dossier proUSB V9.27C est incomplet : "+name+" absent."};
  }
  return {ok:true,path:target};
 }catch{
  return {ok:false,message:"Impossible de lire le dossier complet de proUSB V9.27C. Décompressez LockV9.27C sans déplacer ses DLL."};
 }
}
function getCardLockProcessPaths(){
 return new Promise(resolve=>{
  const command='$ErrorActionPreference="Stop"; Get-CimInstance Win32_Process -Filter "Name=\'CardLock.exe\'" | ForEach-Object { $_.ExecutablePath }';
  execFile("powershell.exe",["-NoProfile","-NonInteractive","-Command",command],
   {windowsHide:true,timeout:5500,maxBuffer:65536},(error,stdout)=>{
    if(error)return resolve(null);
    resolve(String(stdout||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean));
   });
 });
}
function createProUsb71Launcher({app,layout,dialog,getWindow,
 platform=process.platform,files=fs,spawnProcess=spawn,
 runningPaths=getCardLockProcessPaths,verifyInstallation=verifyProUsb71,installPaths=DEFAULT_INSTALLS}){
 async function find({userId,hotelId,ask=false}){
  const stored=await layout.getVendorProgram({userId,hotelId});
  if(stored&&(await verifyInstallation(stored,files)).ok)return {ok:true,path:stored};
  for(const candidate of installPaths){
   if((await verifyInstallation(candidate,files)).ok){
    await layout.setVendorProgram({userId,hotelId,programPath:candidate});
    return {ok:true,path:candidate};
   }
  }
  if(!ask)return {ok:false,message:"proUSB V9.27C n'est pas configuré sur ce PC."};
  const picked=await dialog.showOpenDialog(getWindow(),{
   title:"Choisir le logiciel proUSB V9.27C du Seven 71",
   filters:[{name:"Application proUSB V9.27C (CardLock.Exe)",extensions:["exe"]}],
   properties:["openFile"]
  });
  if(picked.canceled||!picked.filePaths?.length)return {ok:false,cancelled:true};
  const verified=await verifyInstallation(picked.filePaths[0],files);
  if(!verified.ok)return verified;
  await layout.setVendorProgram({userId,hotelId,programPath:verified.path});
  return verified;
 }
 // Explicitly bind the already-working hotel database installation, not just an
 // executable with a matching version. Do not copy or edit System.ini / CardLock.MDB.
 async function choose({userId,hotelId}){
  if(platform!=="win32")return {ok:false,message:"La sélection du logiciel de serrures nécessite Windows."};
  const profile=await layout.getReaderProfile({userId,hotelId});
  if(profile?.driver!=="pro-usb-v9")
   return {ok:false,message:"Configurez d'abord le lecteur Seven 71 comme proUSB V9."};
  const selected=await dialog.showOpenDialog(getWindow(),{
   title:"Sélectionner le CardLock fonctionnel du Seven 71",
   filters:[{name:"Logiciel proUSB V9.27C",extensions:["exe"]}],
   properties:["openFile"]
  });
  if(selected.canceled||!selected.filePaths?.length)return {ok:false,cancelled:true,message:"Sélection annulée."};
  const verified=await verifyInstallation(selected.filePaths[0],files);
  if(!verified.ok)return verified;
  const processes=await runningPaths();
  if(processes===null)return {ok:false,message:"Impossible de vérifier le logiciel CardLock déjà ouvert. Fermez-le et réessayez."};
  const active=distinctPaths(processes);
  if(active.length>1)return {ok:false,message:"Plusieurs installations CardLock sont ouvertes. Fermez les autres instances avant de sélectionner celle de Seven 71."};
  if(active.length===1&&clean(active[0])!==clean(verified.path)){
   const running=await verifyInstallation(active[0],files);
   return running.ok
    ?{ok:false,message:"Le logiciel ouvert ne correspond pas au fichier choisi. Sélectionnez son chemin exact, ou utilisez « Associer le CardLock ouvert »."}
    :{ok:false,message:"Un autre CardLock non reconnu est ouvert. Fermez-le avant d'utiliser le Seven 71."};
  }
  await layout.setVendorProgram({userId,hotelId,programPath:verified.path});
  return {ok:true,configured:true,path:verified.path,
   message:"Installation fonctionnelle du Seven 71 enregistrée sur ce poste, sans modifier les données du fabricant."};
 }
 // Operator-confirmed recovery: the active CardLock may have been moved or
 // unpacked to a different folder than Seven stored previously. Only bind
 // one running, verified proUSB V9.27C installation; never read/write its DB.
 async function associateRunning({userId,hotelId,confirmWorkingInstallation=false}={}){
  if(platform!=="win32")return {ok:false,message:"Cette fonction nécessite Seven Gestion Windows."};
  const profile=await layout.getReaderProfile({userId,hotelId});
  if(profile?.driver!=="pro-usb-v9")
   return {ok:false,message:"Le lecteur Seven 71 doit être configuré comme proUSB V9."};
  if(confirmWorkingInstallation!==true)
   return {ok:false,message:"Confirmez que cette installation a réellement programmé les serrures de Seven 71."};
  const processes=await runningPaths();
  if(processes===null)return {ok:false,message:"Impossible de vérifier les processus CardLock actuellement ouverts."};
  const active=distinctPaths(processes);
  if(active.length!==1)return {ok:false,message:active.length===0
   ?"Ouvrez d'abord le CardLock fonctionnel du Seven 71, puis réessayez."
   :"Plusieurs CardLock sont ouverts. Fermez les autres instances avant de continuer."};
  const verified=await verifyInstallation(active[0],files);
  if(!verified.ok)return {ok:false,message:"Le CardLock ouvert ne correspond pas aux fichiers proUSB V9.27C vérifiés : "+verified.message};
  const again=await runningPaths();
  if(again===null||distinctPaths(again).length!==1||clean(distinctPaths(again)[0])!==clean(verified.path))
   return {ok:false,message:"Le logiciel CardLock ouvert a changé pendant la vérification. Réessayez."};
  await layout.setVendorProgram({userId,hotelId,programPath:verified.path});
  return {ok:true,configured:true,running:true,path:verified.path,
   message:"Le CardLock actuellement ouvert a été associé au Seven 71. Aucune base de données fabricant n'a été modifiée."};
 }
 async function state({userId,hotelId}){
  if(platform!=="win32")return {ok:false,message:"Disponible uniquement sous Windows."};
  const profile=await layout.getReaderProfile({userId,hotelId});
  if(profile?.driver!=="pro-usb-v9")return {ok:false,message:"Ce lecteur n'est pas configuré comme proUSB V9.27C."};
  const program=await find({userId,hotelId,ask:false});
  if(!program.ok)return {ok:false,configured:false,running:false,message:program.message};
  const processes=await runningPaths();
  if(processes===null)return {ok:false,configured:true,running:false,message:"Impossible de vérifier quel logiciel de serrures est ouvert sur Windows."};
  const active=distinctPaths(processes);
  if(active.length>1)return {ok:false,configured:true,running:false,conflict:true,
   message:"Plusieurs installations CardLock sont ouvertes. Fermez les autres instances avant de travailler avec le Seven 71."};
  if(active.length===1&&clean(active[0])!==clean(program.path)){
   const verified=await verifyInstallation(active[0],files);
   if(verified.ok)return {ok:false,configured:true,running:false,relinkRequired:true,
    message:"Le CardLock ouvert est une installation proUSB V9.27C valide, mais le chemin enregistré est différent. Cliquez sur « Associer le CardLock ouvert » pour choisir cette installation."};
   return {ok:false,configured:true,running:false,conflict:true,
    message:"Le CardLock ouvert n'a pas les fichiers constructeur vérifiés pour le Seven 71. Fermez-le ou choisissez l'installation correcte."};
  }
  return {ok:true,configured:true,running:active.length===1,path:program.path};
 }
 async function launch({userId,hotelId}){
  if(platform!=="win32")return {ok:false,message:"Le logiciel proUSB nécessite Windows."};
  const profile=await layout.getReaderProfile({userId,hotelId});
  if(profile?.driver!=="pro-usb-v9")return {ok:false,message:"Choisissez d'abord l'hôtel Seven 71 et son lecteur proUSB V9."};
  const program=await find({userId,hotelId,ask:true});
  if(!program.ok)return program;
  const processes=await runningPaths();
  if(processes===null)return {ok:false,message:"Seven ne peut pas vérifier si le logiciel du Seven 47 est ouvert. Vérifiez Windows avant de continuer."};
  const active=distinctPaths(processes);
  if(active.length>1)return {ok:false,message:"Plusieurs CardLock sont ouverts. Fermez les instances en double."};
  if(active.length===1&&clean(active[0])!==clean(program.path)){
   const verified=await verifyInstallation(active[0],files);
   return verified.ok
    ?{ok:false,relinkRequired:true,message:"Une installation proUSB V9.27C valide est déjà ouverte à un autre emplacement. Utilisez « Associer le CardLock ouvert » pour confirmer ce dossier."}
    :{ok:false,conflict:true,message:"Le CardLock de Seven 47 ou une version incompatible est ouvert. Fermez-le avant de démarrer Seven 71."};
  }
  if(active.length===1)
   return {ok:true,running:true,alreadyOpen:true,message:"proUSB V9.27C de Seven 71 est déjà ouvert."};
  try{
   await new Promise((resolve,reject)=>{
    const child=spawnProcess(program.path,[],{cwd:path.win32.dirname(program.path),
     windowsHide:false,detached:true,stdio:"ignore",shell:false});
    child.once("error",reject);
    child.once("spawn",()=>{child.unref();resolve();});
   });
   return {ok:true,launched:true,running:false,
    message:"proUSB V9.27C de Seven 71 est lancé. Ouvrez votre session dans ce logiciel, puis utilisez les cartes dans Seven."};
  }catch{return {ok:false,message:"Impossible de démarrer proUSB V9.27C. Vérifiez son installation sur ce PC."};}
 }
 // Do not allow a Seven 47 operation while the different Seven 71
 // manufacturer program has exclusive access to the USB encoder.
 async function guardLegacy(){
  const processes=await runningPaths();
  if(processes===null)return {ok:true,unverified:true}; // preserve the existing working 47 integration
  for(const file of processes){
   if((await verifyInstallation(file,files)).ok)
    return {ok:false,message:"Le logiciel proUSB V9.27C de Seven 71 est ouvert. Fermez-le avant d'utiliser le lecteur de Seven 47."};
  }
  return {ok:true};
 }
 async function ensureRunning(input){
  const result=await state(input);
  if(result.ok&&result.running)return {ok:true,running:true};
  if(result.conflict||result.relinkRequired)return result;
  if(!result.configured){
   const started=await launch(input);
   if(!started.ok)return started;
   return {ok:false,message:"Le logiciel proUSB V9.27C vient d'être ouvert. Connectez-vous dans sa fenêtre puis relancez l'opération RFID."};
  }
  if(result.ok&&!result.running)return {ok:false,message:"Ouvrez d'abord proUSB V9.27C de Seven 71 avec le bouton « Démarrer le lecteur », puis connectez-vous."};
  return result;
 }
 return {state,launch,choose,associateRunning,ensureRunning,guardLegacy};
}
module.exports={createProUsb71Launcher,verifyProUsb71,PROUSB71_SHA256,PRORFL_SHA256};
